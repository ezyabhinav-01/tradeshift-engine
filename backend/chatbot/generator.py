from pathlib import Path

# Ensure the app context is available for imports
import sys
base_dir = Path(__file__).resolve().parent.parent
if str(base_dir) not in sys.path:
    sys.path.append(str(base_dir))

from app.utils.gemini_pool import gemini_pool

async def generate_response(prompt: str, history: list = None) -> str:
    """
    Sends the fully augmented system prompt (containing RAG context + user question) 
    to the Gemini API via the GeminiPool for high availability and automatic rotation.
    """
    try:
        print(f"[GeminiPool] Requesting generation for ChatBot...")
        response = await gemini_pool.generate_content(prompt, is_async=True)
            
        print(f"[GeminiPool] Response received successfully.")
        return response.text
    except Exception as e:
        print(f"Gemini API Inference Error: {e}")
        return "I am experiencing network latency reaching the Gemini API. Please try your request again."
