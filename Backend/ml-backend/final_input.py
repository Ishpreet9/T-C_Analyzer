import re
import os
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

def final(ai_output_text):
    lines = [line.strip() for line in ai_output_text.split('\n') if line.strip()]
    
    cleaned_clauses = []
    
    for line in lines:
        clean_clause = re.sub(r'^\d+\.\s*', '', line).strip()
        
        if clean_clause:
            cleaned_clauses.append(clean_clause)

    return cleaned_clauses



from openai import OpenAI
def generate_summary(fairness,redFlags,yellowFlags,greenFlags):
    prompt = f"""
You are a consumer protection assistant.

Analyze the following Terms & Conditions risk report and generate a concise summary for a normal user.

INPUT:

* Fairness level: {fairness}
* Red Flags (high risk): {redFlags}
* Yellow Flags (moderate risk): {yellowFlags}
* Green Flags (low/no risk): {greenFlags}

INSTRUCTIONS:

* Write a clear 2–3 sentence summary
* Highlight the most serious risks first
* Use simple, non-legal language
* Do NOT repeat all clauses
* Do NOT include bullet points
* Focus on what the user should be cautious about

OUTPUT:
Return only the summary text.

"""

    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=GROQ_API_KEY
    )

    response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content


def json_format(predictions):
    redFlags = []
    yellowFlags = []
    greenFlags = []

    n_high, n_medium, n_low = 0, 0, 0

    for p in predictions:
        text = p["text"]
        category = p["category"]
        severity = p["severity"].lower()

        formatted = f"{text} ({category})"

        if severity == "high":
            n_high += 1
            if len(redFlags) < 5:
                redFlags.append(formatted)

        elif severity == "medium":
            n_medium += 1
            if len(yellowFlags) < 5:
                yellowFlags.append(formatted)

        elif severity == "low":
            n_low += 1
            if len(greenFlags) < 5:
                greenFlags.append(formatted)

    score = (n_high * 3) + (n_medium * 2) + (n_low * 1)

    if score == 0:
        fairness = "Safe"
    elif score <= 3:
        fairness = "Standard"
    elif score <= 6:
        fairness = "Suspicious"
    else:
        fairness = "Predatory"

    return {
        "fairness": fairness,
        "redFlags": redFlags,
        "yellowFlags": yellowFlags,
        "greenFlags": greenFlags,
        "summary":generate_summary(fairness,redFlags,yellowFlags,greenFlags)    
        }