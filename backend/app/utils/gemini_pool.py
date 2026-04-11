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
        self.per_model_timeout_seconds = float(os.getenv("GEMINI_PER_MODEL_TIMEOUT_SECONDS", "7"))
        self.max_keys_per_request = int(os.getenv("GEMINI_MAX_KEYS_PER_REQUEST", "3"))
        
        if not self.keys:
            print("⚠️ [GeminiPool] No API keys found! Gemini features will be disabled.")
        else:
            print(f"✅ [GeminiPool] Initialized with {len(self.keys)} API keys.")

    def _get_model_for_key(self, key_index: int, model_name: str):
        """
        Creates or retrieves a GenerativeModel instance for a specific key.
        Uses per-request API key configuration to stay compatible with the
        currently installed Gemini SDK.
        """
        cache_key = (key_index, model_name)
        if cache_key in self.models:
            return self.models[cache_key]
        
        key = self.keys[key_index]
        try:
            genai.configure(api_key=key)
            model = genai.GenerativeModel(model_name=model_name)
            self.models[cache_key] = model
            return model
        except Exception as e:
            print(f"❌ [GeminiPool] Error creating model for key index {key_index}: {e}")
            return None

    def _is_retryable_generation_error(self, error_msg: str) -> bool:
        return (
            "429" in error_msg
            or "resource_exhausted" in error_msg
            or "quota" in error_msg
            or "503" in error_msg
            or "unavailable" in error_msg
            or "overloaded" in error_msg
            or "deadline exceeded" in error_msg
            or "timed out" in error_msg
            or "timeout" in error_msg
            or "connection reset" in error_msg
        )

    def _is_rate_limited_error(self, error_msg: str) -> bool:
        return "429" in error_msg or "resource_exhausted" in error_msg or "quota" in error_msg

    async def generate_content(self, prompt: str, model_name: str = "models/gemini-2.5-flash", is_async: bool = False):
        """
        Generates content using one of the available keys.
        If a key fails with 429 (Resource Exhausted), it automatically tries the next one.
        """
        if not self.keys:
            raise Exception("No Gemini API keys configured.")

        # Try up to N times (once for each key), and allow model fallbacks to reduce outages.
        num_keys = len(self.keys)
        start_index = self.current_index
        model_candidates = list(dict.fromkeys([
            model_name,
            "models/gemini-2.5-flash",
            "models/gemini-2.0-flash",
            "models/gemini-flash-latest",
        ]))
        max_key_attempts = max(1, min(num_keys, self.max_keys_per_request))
        
        for attempt in range(max_key_attempts):
            idx = (start_index + attempt) % num_keys
            last_error = None

            for candidate_model in model_candidates:
                model = self._get_model_for_key(idx, candidate_model)
                if not model:
                    continue

                try:
                    if is_async:
                        response = await asyncio.wait_for(
                            model.generate_content_async(prompt),
                            timeout=self.per_model_timeout_seconds,
                        )
                    else:
                        # For sync calls, we still wrap in executor if needed by caller,
                        # but here we just call the method.
                        response = model.generate_content(prompt)

                    # If we succeeded, update the pool index to the next one for next time (Round Robin)
                    self.current_index = (idx + 1) % num_keys
                    return response
                except asyncio.TimeoutError as e:
                    last_error = e
                    print(
                        f"⚠️ [GeminiPool] Timeout on key {idx+1}, model {candidate_model} "
                        f"after {self.per_model_timeout_seconds}s. Trying next model/key..."
                    )
                    continue
                except Exception as e:
                    last_error = e
                    error_msg = str(e).lower()

                    if "api_key_invalid" in error_msg or "403" in error_msg:
                        print(f"❌ [GeminiPool] Key {idx+1} is invalid or unauthorized. Rotating...")
                        break

                    if self._is_rate_limited_error(error_msg):
                        print(f"⚠️ [GeminiPool] Key {idx+1} is rate limited/quota exhausted. Rotating key...")
                        break

                    if "not found" in error_msg or "unsupported" in error_msg:
                        print(f"⚠️ [GeminiPool] Model {candidate_model} unavailable for key {idx+1}. Trying fallback model...")
                        continue

                    if self._is_retryable_generation_error(error_msg):
                        print(
                            f"⚠️ [GeminiPool] Temporary failure on key {idx+1}, model {candidate_model}: "
                            f"{str(e)[:160]}. Trying next model/key..."
                        )
                        continue

                    # Non-retryable error
                    print(f"❌ [GeminiPool] Error with key {idx+1}, model {candidate_model}: {e}")
                    raise e

            if last_error:
                print(f"⚠️ [GeminiPool] Rotating key after failures on key {idx+1}: {last_error}")
        
        raise Exception("All Gemini API keys in the pool are currently exhausted or invalid.")

    async def get_embeddings_async(self, texts: list, model_name: str = "models/gemini-embedding-001"):
        """
        Generates embeddings for a list of strings using the pool's keys.
        Supports automatic rotation on rate limits.
        """
        if not self.keys:
            raise Exception("No Gemini API keys configured.")

        num_keys = len(self.keys)
        start_index = self.current_index
        model_candidates = [
            model_name,
            "models/gemini-embedding-001",
            "models/gemini-embedding-2-preview",
            "models/embedding-001",
            "embedding-001",
            "models/text-embedding-004",
            "text-embedding-004",
        ]
        
        for attempt in range(num_keys):
            idx = (start_index + attempt) % num_keys
            key = self.keys[idx]
            
            try:
                genai.configure(api_key=key)
                last_error = None

                for candidate in model_candidates:
                    try:
                        response = await genai.embed_content_async(
                            model=candidate,
                            content=texts,
                            task_type="retrieval_document" if len(texts) > 1 else "retrieval_query"
                        )
                        self.current_index = (idx + 1) % num_keys
                        if 'embeddings' in response:
                            return response['embeddings']
                        if 'embedding' in response:
                            return [response['embedding']]
                        raise KeyError("embedding")
                    except Exception as model_error:
                        last_error = model_error
                        error_msg = str(model_error).lower()
                        if "not found" in error_msg or "not supported" in error_msg:
                            continue
                        raise model_error

                raise last_error or Exception("No compatible embedding model available.")
            except Exception as e:
                error_msg = str(e).lower()
                if "429" in error_msg or "resource_exhausted" in error_msg:
                    print(f"⚠️ [GeminiPool-Embed] Key {idx+1} rate limited. Rotating...")
                    continue
                else:
                    print(f"❌ [GeminiPool-Embed] Error with key {idx+1}: {e}")
                    raise e
                    
        raise Exception("All Gemini API keys are exhausted for embeddings.")

# Singleton instance
gemini_pool = GeminiPool()
