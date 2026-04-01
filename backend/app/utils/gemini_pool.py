import os
import random
import asyncio
import google.generativeai as genai
from google.ai import generativelanguage as glm
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()

class GeminiPool:
    """
    Manages a pool of Gemini API keys and provides automatic rotation 
    and failover if a key hits its daily limit.
    """
    def __init__(self):
        self.keys = []
        # Primary key
        primary_key = os.getenv("GEMINI_API_KEY")
        if primary_key:
            self.keys.append(primary_key)
            
        # Additional keys
        for i in range(1, 6):
            key = os.getenv(f"GEMINI_API_KEY_{i}")
            if key and key not in self.keys:
                self.keys.append(key)
        
        self.current_index = 0
        self.models = {} # Cache for (key_index, model_name) -> model instance
        
        if not self.keys:
            print("⚠️ [GeminiPool] No API keys found! Gemini features will be disabled.")
        else:
            print(f"✅ [GeminiPool] Initialized with {len(self.keys)} API keys.")

    def _get_model_for_key(self, key_index: int, model_name: str):
        """
        Creates or retrieves a GenerativeModel instance for a specific key.
        Uses the low-level client to avoid global configuration conflicts.
        """
        cache_key = (key_index, model_name)
        if cache_key in self.models:
            return self.models[cache_key]
        
        key = self.keys[key_index]
        try:
            # Create a dedicated client for this specific API key
            client = glm.GenerativeServiceClient(client_options={'api_key': key})
            model = genai.GenerativeModel(model_name=model_name, client=client)
            self.models[cache_key] = model
            return model
        except Exception as e:
            print(f"❌ [GeminiPool] Error creating model for key index {key_index}: {e}")
            return None

    async def generate_content(self, prompt: str, model_name: str = "gemini-1.5-flash", is_async: bool = False):
        """
        Generates content using one of the available keys.
        If a key fails with 429 (Resource Exhausted), it automatically tries the next one.
        """
        if not self.keys:
            raise Exception("No Gemini API keys configured.")

        # Try up to N times (once for each key)
        num_keys = len(self.keys)
        start_index = self.current_index
        
        for attempt in range(num_keys):
            idx = (start_index + attempt) % num_keys
            model = self._get_model_for_key(idx, model_name)
            
            if not model:
                continue
                
            try:
                if is_async:
                    response = await model.generate_content_async(prompt)
                else:
                    # For sync calls, we still wrap in executor if needed by caller,
                    # but here we just call the method.
                    response = model.generate_content(prompt)
                
                # If we succeeded, update the pool index to the next one for next time (Round Robin)
                self.current_index = (idx + 1) % num_keys
                return response
            except Exception as e:
                error_msg = str(e).lower()
                if "429" in error_msg or "resource_exhausted" in error_msg or "quota" in error_msg:
                    print(f"⚠️ [GeminiPool] Key {idx+1} rate limited. Rotating to next key...")
                    continue
                elif "api_key_invalid" in error_msg or "403" in error_msg:
                     print(f"❌ [GeminiPool] Key {idx+1} is invalid or unauthorized. Rotating...")
                     continue
                else:
                    # Other errors (like network or prompt issues) should probably be raised
                    print(f"❌ [GeminiPool] Error with key {idx+1}: {e}")
                    raise e
        
        raise Exception("All Gemini API keys in the pool are currently exhausted or invalid.")

# Singleton instance
gemini_pool = GeminiPool()
