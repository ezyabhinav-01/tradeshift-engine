import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Ensure the app context is available for imports
import sys
base_dir = Path(__file__).resolve().parent.parent
if str(base_dir) not in sys.path:
    sys.path.append(str(base_dir))

from app.utils.gemini_pool import gemini_pool

def generate_response(prompt: str, history: list = None) -> str:
    """
    Sends the fully augmented system prompt (containing RAG context + user question) 
    to the Gemini API via the GeminiPool for high availability and automatic rotation.
    """
    # Note: TradeGuideBot uses this synchronously in its current structure
    # We wrap the async call to the pool using asyncio.run()
    # If this is called within another event loop, we might need a better bridging strategy
    
    try:
        print(f"[GeminiPool] Requesting generation for ChatBot...")
        
        # Determine if we're already in an async context
        try:
            loop = asyncio.get_running_loop()
            # If in an async loop, we need to handle this differently
            # For now, let's try to run it directly if possible, or use a separate thread
            # But usually, it's called from a sync FastAPI worker.
            
            # Simple wrapper for when we have a loop
            if loop.is_running():
                future = asyncio.run_coroutine_threadsafe(
                    gemini_pool.generate_content(prompt, is_async=True), 
                    loop
                )
                response = future.result()
            else:
                response = asyncio.run(gemini_pool.generate_content(prompt, is_async=True))
        except RuntimeError:
            # No running event loop, safe to use asyncio.run
            response = asyncio.run(gemini_pool.generate_content(prompt, is_async=True))
            
        print(f"[GeminiPool] Response received successfully.")
        return response.text
    except Exception as e:
        print(f"Gemini API Inference Error: {e}")
        return "I am experiencing network latency reaching the Gemini API. Please try your request again."
