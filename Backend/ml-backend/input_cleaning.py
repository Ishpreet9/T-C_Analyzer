import re
import unicodedata
import os
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv('GROQ_API_KEY')


def clean_text(raw_text:str):
    if not raw_text:
        return ""

    text = unicodedata.normalize('NFKC', raw_text)

    replacements = {
        r'[“”]': '"',          # Smart double quotes
        r'[‘’]': "'",          # Smart single quotes
        r'[—–]': '-',          # Em and En dashes
        r'…': '...',           # Ellipses
        r'\xad': '',           # Soft hyphens (invisible mid-word breaks)
        r'\xa0': ' '           # Non-breaking spaces
    }
    for pattern, replacement in replacements.items():
        text = re.sub(pattern, replacement, text)

    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    text = text.replace('\t', ' ')        
    text = re.sub(r' {2,}', ' ', text) 

    text = re.sub(r'([a-z,;-])\n\s*([a-z])', r'\1 \2', text)
    
    text = re.sub(r'\n\s*(and|or|but|with|to|in|for)\b', r' \1', text, flags=re.IGNORECASE)

    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    
    text = re.sub(r'\n{3,}', '\n\n', text)

    my_prompt=f"""
    You are an expert legal data analyst. Your task is to process the following sanitized legal text and extract every distinct legal obligation, right, restriction, or statement into a plain text list.

    Follow these strict rules for extraction:
    1. Granularity: One legal idea equals one clause. If a sentence contains multiple obligations joined by conjunctions (e.g., "and", "or", "nor"), split them into separate, distinct clauses.
    2. Contextual Completeness: Many bullet points in legal texts lack a subject. You must resolve the implicit subject based on the section header or introductory sentence so each clause makes sense on its own. For example, change a bullet point that says "Not share your password" to "The user shall not share their password."
    3. Accuracy: Preserve the original legal intent and terminology. Do not summarize, generalize, or paraphrase the core meaning.
    4. Output Format: Output EXACTLY a numbered list of the extracted clauses.
    5. Formatting Restrictions: Do NOT use any Markdown formatting (no bolding, no italics, no code blocks).
    6. Conversational Filler: Do NOT include any introductory greetings, concluding remarks, or any text other than the numbered list itself.
    7. If two ideas have the same effect and meaning but with different keywords eg. not violate any applicable local law and not violate any applicable local law. Then do not seperate them.

    {text.strip()}
    """


    from openai import OpenAI
    import os
    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=GROQ_API_KEY
    )

    response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": my_prompt}]
    )
    return response.choices[0].message.content