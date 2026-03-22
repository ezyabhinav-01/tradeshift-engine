import os
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

_model = None

def get_gemini_model():
    global _model
    if _model is not None:
        return _model
        
    load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / '.env', override=True)
    load_dotenv(dotenv_path=Path(__file__).resolve().parent / '.env', override=True)
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel('gemini-2.5-flash')
        return _model
        
    print("WARNING: GEMINI_API_KEY not found in environment variables!")
    return None

def generate_response(prompt: str, history: list = None) -> str:
    """
    Sends the fully augmented system prompt (containing RAG context + user question) 
    directly to the Gemini frontier model for absolute intelligence and speed.
    """
    model = get_gemini_model()
    if model is None:
        return "CRITICAL ERROR: Gemini API Key is missing from the environment. Inference halted."
        
    try:
        print(f"[Gemini] Sending request to models/gemini-2.5-flash...")
        response = model.generate_content(prompt)
        print(f"[Gemini] Response received successfully.")
        return response.text
    except Exception as e:
        print(f"Gemini API Inference Error: {e}")
        return "I am experiencing network latency reaching the Gemini API. Please try your request again."
