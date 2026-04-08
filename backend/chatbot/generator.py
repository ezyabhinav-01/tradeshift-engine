from pathlib import Path

# Ensure the app context is available for imports
import sys
base_dir = Path(__file__).resolve().parent.parent
if str(base_dir) not in sys.path:
    sys.path.append(str(base_dir))

from app.utils.gemini_pool import gemini_pool

GENERATION_ERROR_SENTINEL = "I am experiencing network latency reaching the Gemini API. Please try your request again."

def _extract_response_text(response) -> str:
    text = getattr(response, "text", None)
    if text:
        return text

    try:
        candidates = getattr(response, "candidates", None) or []
        parts_text = []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            parts = getattr(content, "parts", None) or []
            for part in parts:
                value = getattr(part, "text", None)
                if value:
                    parts_text.append(value)
        return "\n".join(parts_text).strip()
    except Exception:
        return ""

async def generate_response(prompt: str, history: list = None) -> str:
    """
    Sends the fully augmented system prompt (containing RAG context + user question) 
    to the Gemini API via the GeminiPool for high availability and automatic rotation.
    """
    try:
        print(f"[GeminiPool] Requesting generation for ChatBot...")
        response = await gemini_pool.generate_content(prompt, is_async=True)

        output_text = _extract_response_text(response)
        if output_text:
            print(f"[GeminiPool] Response received successfully.")
            return output_text

        print("[GeminiPool] Response received but no text content was found.")
        return ""
    except Exception as e:
        print(f"Gemini API Inference Error: {e}")
        return GENERATION_ERROR_SENTINEL
