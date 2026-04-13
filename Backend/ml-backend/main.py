from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from input_cleaning import clean_text
from clause_classifier import ClauseClassifier
from final_input import final
from huggingface_hub import snapshot_download


app = FastAPI(title="T&C Risk Classifier")


global clf
snapshot_download(
    repo_id="Doctor-psy/TOS",
    local_dir="./student_model"
    )
clf = ClauseClassifier(model_dir="./student_model")

_ = clf.predict("We respect your privacy")

class AnalyzeRequest(BaseModel):
    text: str

@app.get("/")
def root():
    return {"status": "ok", "message": "ML server running"}

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    cleaned_clauses = clean_text(request.text)
    clauses= final(cleaned_clauses)
    predictions = clf.predict_batch(clauses)
    return {
        "results":predictions
    }


