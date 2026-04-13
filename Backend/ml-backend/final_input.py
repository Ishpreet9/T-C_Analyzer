import re
def final(ai_output_text):
    lines = [line.strip() for line in ai_output_text.split('\n') if line.strip()]
    
    cleaned_clauses = []
    
    for line in lines:
        clean_clause = re.sub(r'^\d+\.\s*', '', line).strip()
        
        if clean_clause:
            cleaned_clauses.append(clean_clause)

    return cleaned_clauses
