from pathlib import Path
import os
import aiohttp

# Ensure the app context is available for imports
import sys
base_dir = Path(__file__).resolve().parent.parent
if str(base_dir) not in sys.path:
    sys.path.append(str(base_dir))

from app.utils.gemini_pool import gemini_pool

GENERATION_ERROR_SENTINEL = "I am experiencing network latency reaching the Gemini API. Please try your request again."
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")
HF_MODEL_ID = os.getenv("CHATBOT_HF_MODEL_ID", "HuggingFaceH4/zephyr-7b-beta")


async def _generate_response_hf(prompt: str) -> str:
    if not HF_TOKEN:
        return ""

    url = "https://router.huggingface.co/v1/chat/completions"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    payload = {
        "model": HF_MODEL_ID,
        "messages": [
            {"role": "system", "content": "You are TradeGuide, an educational trading mentor."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 300,
        "temperature": 0.4,
    }
    timeout = aiohttp.ClientTimeout(total=15, connect=4, sock_read=9)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status != 200:
                return ""
            data = await resp.json()
            return (data.get("choices", [{}])[0].get("message", {}).get("content", "") or "").strip()

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
        hf_output = await _generate_response_hf(prompt)
        if hf_output:
            print("[HF Router] Fallback response received.")
            return hf_output
        return ""
    except Exception as e:
        print(f"Gemini API Inference Error: {e}")
        hf_output = await _generate_response_hf(prompt)
        if hf_output:
            print("[HF Router] Fallback response received after Gemini error.")
            return hf_output
        return GENERATION_ERROR_SENTINEL
