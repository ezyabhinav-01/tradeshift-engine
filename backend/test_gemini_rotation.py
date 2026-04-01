import asyncio
import os
from unittest.mock import MagicMock, AsyncMock, patch
from app.utils.gemini_pool import GeminiPool

# Mocking the google-generativeai and google-ai-generativelanguage
@patch("app.utils.gemini_pool.glm.GenerativeServiceClient")
@patch("app.utils.gemini_pool.genai.GenerativeModel")
async def test_rotation_on_429(mock_model_class, mock_client_class):
    """
    Tests that if a key returns a 429 error, the pool rotates to the next key.
    """
    print("\n🚀 Starting Gemini Rotation Test (429 Scenario)...")
    
    # Setup the pool with 3 dummy keys
    with patch.dict(os.environ, {
        "GEMINI_API_KEY": "key_1",
        "GEMINI_API_KEY_1": "key_2",
        "GEMINI_API_KEY_2": "key_3"
    }):
        pool = GeminiPool()
        print(f"✅ Pool initialized with {len(pool.keys)} keys.")

        # Create mock responses
        # First call fails with 429
        # Second call succeeds
        mock_model_1 = MagicMock()
        mock_model_1.generate_content_async = AsyncMock(side_effect=Exception("429 Too Many Requests: Resource Exhausted"))
        
        mock_model_2 = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Success from Key 2"
        mock_model_2.generate_content_async = AsyncMock(return_value=mock_response)

        # Configure pool._get_model_for_key to return our mocks based on index
        def get_model_side_effect(idx, name):
            if idx == 0: return mock_model_1
            if idx == 1: return mock_model_2
            return None
            
        pool._get_model_for_key = MagicMock(side_effect=get_model_side_effect)

        print("📡 Sending request 1 (should fail on key 1, then try key 2)...")
        result = await pool.generate_content("Hello", is_async=True)
        
        print(f"📝 Result: {result.text}")
        
        if result.text == "Success from Key 2":
            print("✨ SUCCESS: Rotated from Key 1 to Key 2 after 429 error.")
        else:
            print("❌ FAILURE: Did not get expected success message from Key 2.")

        # Check if the index updated correctly
        print(f"🔄 Current Pool Index: {pool.current_index} (Should be 2 if started at 0 and rotated once)")
        
if __name__ == "__main__":
    asyncio.run(test_rotation_on_429())
