git clone git clone https://github.com/Ishpreet9/T-C_Analyzer.git

cd T-C_Analyzer

cd Backend/ml-backend

python -m venv .venv

pip install -r requirements.txt

uvicorn main:app --reload

Wait for the app to load model and then send json requests wiith text document text(string)

request template:
"{"text": {file_contents}}"