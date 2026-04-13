import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModel

category_map = {
    'Policy change risk': 0,
    'Personal data usage': 1,
    'Data security and Liability': 2,
    'Rule usage enforcement': 3,
    'Account responsibility': 4,
    'Account termination risk': 5,
    'Third party dependency risk': 6,
    'Legal remedy limitation': 7,
    'Change of service risk': 8,
    'Access restriction': 9,
    'Financial commitment risk': 10,
    'User content rights risk': 11,
    'Future scope expansion': 12,
    'Irrevocable rights': 13,
    'Jurisdiction risk': 14,
}
severity_map = {
    "none": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
}
inv_category = {v: k for k, v in category_map.items()}
inv_severity  = {v: k for k, v in severity_map.items()}

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


class ClauseClassifier:
    def __init__(
        self,
        model_dir="./student_model",    
        base_model="nlpaueb/legal-bert-base-uncased",
        num_categories=15,                  
        num_severities=4,
        max_len=256,
        device=None,
    ):
        self.max_len = max_len
        self.device  = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load tokenizer saved during training
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)

        # Rebuild model and load weights
        self.model = MultiTaskModel(base_model, num_categories, num_severities)
        self.model.load_state_dict(
            torch.load(f"{model_dir}/best_model.pt", map_location=self.device)
        )
        self.model.to(self.device)
        self.model.eval()
        print(f"✓ Model loaded from '{model_dir}' on {self.device}")

    def predict(self, text: str) -> dict:
        enc = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=self.max_len,
            padding="max_length",
        )
        input_ids      = enc["input_ids"].to(self.device)
        attention_mask = enc["attention_mask"].to(self.device)

        with torch.no_grad():
            cat_logits, sev_logits = self.model(input_ids, attention_mask)

        cat_pred  = cat_logits.argmax(dim=1).item()
        sev_pred  = sev_logits.argmax(dim=1).item()

        return {
            "category":            inv_category[cat_pred],
            "severity":            inv_severity[sev_pred],
        }

    def predict_batch(self, texts: list[str]) -> list[dict]:
        enc = self.tokenizer(
            texts,
            return_tensors="pt",
            truncation=True,
            max_length=self.max_len,
            padding="max_length",
        )
        input_ids      = enc["input_ids"].to(self.device)
        attention_mask = enc["attention_mask"].to(self.device)

        with torch.no_grad():
            cat_logits, sev_logits = self.model(input_ids, attention_mask)

        cat_preds  = cat_logits.argmax(dim=1).cpu().tolist()
        sev_preds  = sev_logits.argmax(dim=1).cpu().tolist()

        return [
            {
                "text":                texts[i],
                "category":            inv_category[cat_preds[i]],
                "severity":            inv_severity[sev_preds[i]],
            }
            for i in range(len(texts))
        ]
