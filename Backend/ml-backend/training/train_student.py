"""
STUDENT TRAINING — legal-bert-base with Knowledge Distillation
Requires: ./teacher_model/best_model.pt to exist (run train_teacher.py first)

Distillation loss = alpha * CE(student, hard_labels)
                  + (1-alpha) * KL(student_soft, teacher_soft) * T^2
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import numpy as np
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModel, get_linear_schedule_with_warmup
from sklearn.metrics import classification_report
from sklearn.utils.class_weight import compute_class_weight
from data_prep import train_df, valid_df, test_df, category_map, severity_map

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
TEXT_COLUMN      = "text"
TEACHER_NAME     = "nlpaueb/legal-bert-base-uncased"   # must match train_teacher.py
STUDENT_NAME     = "nlpaueb/legal-bert-base-uncased"   # student: bert-base
TEACHER_DIR      = "./teacher_model"
SAVE_DIR         = "./student_model"
MAX_LEN          = 256
BATCH_SIZE       = 8
EPOCHS           = 5
LEARNING_RATE    = 2e-5
LOSS_WEIGHT_CAT  = 0.6
LOSS_WEIGHT_SEV  = 0.4

# Distillation hyperparameters
TEMPERATURE      = 4.0    # soften probabilities — higher = softer
ALPHA            = 0.5    # 0 = only distill, 1 = only hard labels, 0.5 = balanced

inv_category   = {v: k for k, v in category_map.items()}
inv_severity   = {v: k for k, v in severity_map.items()}
NUM_CATEGORIES = train_df["category_label"].nunique()
NUM_SEVERITIES = train_df["severity_label"].nunique()

# ─────────────────────────────────────────────
# CLASS WEIGHTS
# ─────────────────────────────────────────────
def get_class_weights(df, label_col, num_classes, device):
    labels  = df[label_col].values
    classes = np.arange(num_classes)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=labels)
    return torch.tensor(weights, dtype=torch.float).to(device)

# ─────────────────────────────────────────────
# DATASET
# ─────────────────────────────────────────────
class ClauseDataset(Dataset):
    def __init__(self, df, tokenizer, max_len=MAX_LEN):
        self.df        = df.reset_index(drop=True)
        self.tokenizer = tokenizer
        self.max_len   = max_len

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        enc = self.tokenizer(
            str(row[TEXT_COLUMN]),
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        return {
            "input_ids":      enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "category_label": torch.tensor(row["category_label"], dtype=torch.long),
            "severity_label": torch.tensor(row["severity_label"], dtype=torch.long),
        }

# ─────────────────────────────────────────────
# SHARED MODEL ARCHITECTURE
# (teacher and student have same structure, different weights)
# ─────────────────────────────────────────────
class MultiTaskModel(nn.Module):
    def __init__(self, model_name, num_categories, num_severity):
        super().__init__()
        self.encoder       = AutoModel.from_pretrained(model_name)
        hidden             = self.encoder.config.hidden_size
        self.category_head = nn.Linear(hidden, num_categories)
        self.severity_head = nn.Linear(hidden, num_severity)

    def forward(self, input_ids, attention_mask):
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        cls = outputs.last_hidden_state[:, 0]
        return self.category_head(cls), self.severity_head(cls)

# ─────────────────────────────────────────────
# DISTILLATION LOSS
# KL divergence between softened teacher and student logits
# ─────────────────────────────────────────────
def distillation_loss(student_logits, teacher_logits, temperature):
    student_soft = F.log_softmax(student_logits / temperature, dim=-1)
    teacher_soft = F.softmax(teacher_logits  / temperature, dim=-1)
    # KL loss scaled by T^2 to keep gradient magnitudes stable
    return F.kl_div(student_soft, teacher_soft, reduction="batchmean") * (temperature ** 2)

# ─────────────────────────────────────────────
# TRAIN EPOCH WITH DISTILLATION
# ─────────────────────────────────────────────
def train_epoch(student, teacher, loader, optimizer, scheduler,
                device, criterion_cat, criterion_sev):
    student.train()
    teacher.eval()   # teacher is always frozen
    total_loss = 0

    for batch in loader:
        input_ids      = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        cat_labels     = batch["category_label"].to(device)
        sev_labels     = batch["severity_label"].to(device)

        optimizer.zero_grad()

        # Student forward pass
        s_cat_logits, s_sev_logits = student(input_ids, attention_mask)

        # Teacher forward pass — no grad needed
        with torch.no_grad():
            t_cat_logits, t_sev_logits = teacher(input_ids, attention_mask)

        # Hard label loss (student vs ground truth)
        hard_loss = (LOSS_WEIGHT_CAT * criterion_cat(s_cat_logits, cat_labels) +
                     LOSS_WEIGHT_SEV * criterion_sev(s_sev_logits, sev_labels))

        # Soft label loss (student vs teacher)
        soft_loss = (LOSS_WEIGHT_CAT * distillation_loss(s_cat_logits, t_cat_logits, TEMPERATURE) +
                     LOSS_WEIGHT_SEV * distillation_loss(s_sev_logits, t_sev_logits, TEMPERATURE))

        # Combined distillation loss
        loss = ALPHA * hard_loss + (1 - ALPHA) * soft_loss

        loss.backward()
        torch.nn.utils.clip_grad_norm_(student.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        total_loss += loss.item()

    return total_loss / len(loader)

# ─────────────────────────────────────────────
# EVALUATE
# ─────────────────────────────────────────────
def evaluate(model, loader, device, criterion_cat, criterion_sev, label="Validation"):
    model.eval()
    total_loss = 0
    all_cat_preds, all_sev_preds = [], []
    all_cat_true,  all_sev_true  = [], []

    with torch.no_grad():
        for batch in loader:
            input_ids      = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            cat_labels     = batch["category_label"].to(device)
            sev_labels     = batch["severity_label"].to(device)

            cat_logits, sev_logits = model(input_ids, attention_mask)
            loss = (LOSS_WEIGHT_CAT * criterion_cat(cat_logits, cat_labels) +
                    LOSS_WEIGHT_SEV * criterion_sev(sev_logits, sev_labels))
            total_loss += loss.item()

            all_cat_preds += cat_logits.argmax(dim=1).cpu().tolist()
            all_sev_preds += sev_logits.argmax(dim=1).cpu().tolist()
            all_cat_true  += cat_labels.cpu().tolist()
            all_sev_true  += sev_labels.cpu().tolist()

    val_loss    = total_loss / len(loader)
    present_cat = sorted(set(all_cat_true) | set(all_cat_preds))
    present_sev = sorted(set(all_sev_true) | set(all_sev_preds))

    print(f"\n{'='*45}\n{label} Loss: {val_loss:.4f}\n{'='*45}")
    print(f"\n[{label}] Category Report")
    print(classification_report(all_cat_true, all_cat_preds,
                                 labels=present_cat,
                                 target_names=[inv_category[i] for i in present_cat],
                                 zero_division=0))
    print(f"[{label}] Severity Report")
    print(classification_report(all_sev_true, all_sev_preds,
                                 labels=present_sev,
                                 target_names=[inv_severity[i] for i in present_sev],
                                 zero_division=0))
    return val_loss

# ─────────────────────────────────────────────
# INFERENCE
# ─────────────────────────────────────────────
def predict(text, model, tokenizer, device):
    model.eval()
    enc = tokenizer(text, return_tensors="pt", truncation=True,
                    max_length=MAX_LEN, padding="max_length")
    input_ids      = enc["input_ids"].to(device)
    attention_mask = enc["attention_mask"].to(device)

    with torch.no_grad():
        cat_logits, sev_logits = model(input_ids, attention_mask)

    cat_pred  = cat_logits.argmax(dim=1).item()
    sev_pred  = sev_logits.argmax(dim=1).item()
    cat_probs = torch.softmax(cat_logits, dim=1).squeeze().cpu().tolist()
    sev_probs = torch.softmax(sev_logits, dim=1).squeeze().cpu().tolist()

    return {
        "category":            inv_category[cat_pred],
        "category_confidence": round(cat_probs[cat_pred], 4),
        "severity":            inv_severity[sev_pred],
        "severity_confidence": round(sev_probs[sev_pred], 4),
    }

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device} | Train: {len(train_df)} | Valid: {len(valid_df)} | Test: {len(test_df)}")
    print(f"Temperature: {TEMPERATURE} | Alpha: {ALPHA}")

    # Tokenizers
    teacher_tokenizer = AutoTokenizer.from_pretrained(TEACHER_DIR)
    student_tokenizer = AutoTokenizer.from_pretrained(STUDENT_NAME)

    # Loaders — use student tokenizer for training
    train_loader = DataLoader(ClauseDataset(train_df, student_tokenizer), batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    valid_loader = DataLoader(ClauseDataset(valid_df, student_tokenizer), batch_size=BATCH_SIZE, num_workers=0)
    test_loader  = DataLoader(ClauseDataset(test_df,  student_tokenizer), batch_size=BATCH_SIZE, num_workers=0)

    # Load frozen teacher
    print(f"\nLoading teacher from {TEACHER_DIR}...")
    teacher = MultiTaskModel(TEACHER_NAME, NUM_CATEGORIES, NUM_SEVERITIES).to(device)
    teacher.load_state_dict(torch.load(os.path.join(TEACHER_DIR, "best_model.pt"), map_location=device))
    teacher.eval()
    for param in teacher.parameters():
        param.requires_grad = False   # freeze teacher entirely
    print("  ✓ Teacher loaded and frozen")

    # Init student
    print(f"Initialising student ({STUDENT_NAME})...")
    student = MultiTaskModel(STUDENT_NAME, NUM_CATEGORIES, NUM_SEVERITIES).to(device)

    # Loss functions
    cat_weights   = get_class_weights(train_df, "category_label", NUM_CATEGORIES, device)
    sev_weights   = get_class_weights(train_df, "severity_label", NUM_SEVERITIES, device)
    criterion_cat = nn.CrossEntropyLoss(weight=cat_weights)
    criterion_sev = nn.CrossEntropyLoss(weight=sev_weights)

    # Optimizer + scheduler (only student params)
    total_steps  = len(train_loader) * EPOCHS
    optimizer    = optim.AdamW(student.parameters(), lr=LEARNING_RATE, weight_decay=0.01)
    scheduler    = get_linear_schedule_with_warmup(optimizer,
                       num_warmup_steps=total_steps // 10,
                       num_training_steps=total_steps)

    os.makedirs(SAVE_DIR, exist_ok=True)
    best_val_loss = float("inf")

    for epoch in range(EPOCHS):
        print(f"\n{'─'*45}\nEpoch {epoch+1}/{EPOCHS}\n{'─'*45}")
        train_loss = train_epoch(student, teacher, train_loader, optimizer, scheduler,
                                  device, criterion_cat, criterion_sev)
        print(f"Train Loss: {train_loss:.4f}")
        val_loss = evaluate(student, valid_loader, device, criterion_cat, criterion_sev)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(student.state_dict(), os.path.join(SAVE_DIR, "best_model.pt"))
            student_tokenizer.save_pretrained(SAVE_DIR)
            print(f"  ✓ Student saved (val_loss={best_val_loss:.4f})")

    # Final test evaluation
    print("\n" + "="*45 + "\nFINAL TEST EVALUATION")
    best_student = MultiTaskModel(STUDENT_NAME, NUM_CATEGORIES, NUM_SEVERITIES).to(device)
    best_student.load_state_dict(torch.load(os.path.join(SAVE_DIR, "best_model.pt"), map_location=device))
    best_student.eval()
    evaluate(best_student, test_loader, device, criterion_cat, criterion_sev, label="Test")

    # Inference demo
    print("\n--- Inference Demo ---")
    sample = "The company may share your personal data with third-party advertisers without your consent."
    result = predict(sample, best_student, student_tokenizer, device)
    print(f"Text    : {sample}")
    print(f"Category: {result['category']} ({result['category_confidence']*100:.1f}%)")
    print(f"Severity: {result['severity']} ({result['severity_confidence']*100:.1f}%)")


if __name__ == "__main__":
    main()