"""
TEACHER TRAINING — legal-bert-large
Multi-task: risk_category (N classes) + risk_severity (4 classes)
Run this first. Saves best_model.pt to ./teacher_model/
"""

import os
import torch
import torch.nn as nn
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
TEXT_COLUMN     = "text"
MODEL_NAME      = "nlpaueb/legal-bert-base-uncased"   # large variant
SAVE_DIR        = "./teacher_model"
MAX_LEN         = 256
BATCH_SIZE      = 4          # large model — smaller batch for RTX 4050 6GB
EPOCHS          = 5
LEARNING_RATE   = 2e-5
LOSS_WEIGHT_CAT = 0.6
LOSS_WEIGHT_SEV = 0.4

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
# MODEL
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
# TRAIN EPOCH
# ─────────────────────────────────────────────
def train_epoch(model, loader, optimizer, scheduler, device, criterion_cat, criterion_sev):
    model.train()
    total_loss = 0
    for batch in loader:
        input_ids      = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        cat_labels     = batch["category_label"].to(device)
        sev_labels     = batch["severity_label"].to(device)

        optimizer.zero_grad()
        cat_logits, sev_logits = model(input_ids, attention_mask)

        loss = (LOSS_WEIGHT_CAT * criterion_cat(cat_logits, cat_labels) +
                LOSS_WEIGHT_SEV * criterion_sev(sev_logits, sev_labels))

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
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

    val_loss = total_loss / len(loader)

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
# MAIN
# ─────────────────────────────────────────────
def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device} | Train: {len(train_df)} | Valid: {len(valid_df)} | Test: {len(test_df)}")
    print(f"Categories: {NUM_CATEGORIES} | Severities: {NUM_SEVERITIES}")

    tokenizer    = AutoTokenizer.from_pretrained(MODEL_NAME)
    train_loader = DataLoader(ClauseDataset(train_df, tokenizer), batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    valid_loader = DataLoader(ClauseDataset(valid_df, tokenizer), batch_size=BATCH_SIZE, num_workers=0)
    test_loader  = DataLoader(ClauseDataset(test_df,  tokenizer), batch_size=BATCH_SIZE, num_workers=0)

    cat_weights   = get_class_weights(train_df, "category_label", NUM_CATEGORIES, device)
    sev_weights   = get_class_weights(train_df, "severity_label", NUM_SEVERITIES, device)
    criterion_cat = nn.CrossEntropyLoss(weight=cat_weights)
    criterion_sev = nn.CrossEntropyLoss(weight=sev_weights)

    model        = MultiTaskModel(MODEL_NAME, NUM_CATEGORIES, NUM_SEVERITIES).to(device)
    total_steps  = len(train_loader) * EPOCHS
    optimizer    = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=0.01)
    scheduler    = get_linear_schedule_with_warmup(optimizer,
                       num_warmup_steps=total_steps // 10,
                       num_training_steps=total_steps)

    os.makedirs(SAVE_DIR, exist_ok=True)
    best_val_loss = float("inf")

    for epoch in range(EPOCHS):
        print(f"\n{'─'*45}\nEpoch {epoch+1}/{EPOCHS}\n{'─'*45}")
        train_loss = train_epoch(model, train_loader, optimizer, scheduler,
                                  device, criterion_cat, criterion_sev)
        print(f"Train Loss: {train_loss:.4f}")
        val_loss = evaluate(model, valid_loader, device, criterion_cat, criterion_sev)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), os.path.join(SAVE_DIR, "best_model.pt"))
            tokenizer.save_pretrained(SAVE_DIR)
            print(f"  ✓ Teacher saved (val_loss={best_val_loss:.4f})")

    print("\n" + "="*45 + "\nFINAL TEST EVALUATION")
    best_model = MultiTaskModel(MODEL_NAME, NUM_CATEGORIES, NUM_SEVERITIES).to(device)
    best_model.load_state_dict(torch.load(os.path.join(SAVE_DIR, "best_model.pt"), map_location=device))
    best_model.eval()
    evaluate(best_model, test_loader, device, criterion_cat, criterion_sev, label="Test")

if __name__ == "__main__":
    main()