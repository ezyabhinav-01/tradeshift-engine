import asyncio
import os
import sys
from unittest.mock import MagicMock, patch

# PRE-MOCK to avoid missing dependencies
sys.modules["chromadb"] = MagicMock()
sys.modules["sentence_transformers"] = MagicMock()

# Ensure we can import from the chatbot directory
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(base_dir)

from bot import TradeGuideBot

@patch("bot.generate_response")
def test_bot_persona_and_tags(mock_generate):
    """
    Tests that the bot is prompted with the correct persona and 
    extracts tags correctly.
    """
    print("\n🚀 Starting Chatbot Persona & Navigation Test...")
    
    # Mock the generator response to include a navigation tag and a friendly question
    mock_generate.return_value = (
        "MACD is a phenomenal tool for identifying momentum shifts! It stands for Moving Average Convergence Divergence. "
        "Would you like to explore how to trade using MACD in our Academy? [OPEN_LEARN: Market Mechanics] "
        "How do you usually decide when to enter a trade?"
    )
    
    # Mock the embedding and collection initialization
    with patch("bot.SentenceTransformer"), patch("bot.chromadb.PersistentClient"):
        bot = TradeGuideBot()
        
        user_query = "What is MACD?"
        print(f"📡 Sending query: '{user_query}'")
        
        # Mock _retrieve_context to skip RAG
        bot._retrieve_context = MagicMock(return_value=("No context for test.", []))
        
        result = bot.get_response(user_query)
        
        print("\n📝 Bot Response:")
        print(result['response'])
        
        print("\n🎬 Actions Extracted:")
        print(result['actions'])
        
        # Verification
        success = True
        if not result['actions'] or result['actions'][0]['payload'] != 'Market Mechanics':
            print("❌ FAILURE: Navigation tag not correctly extracted or payload mismatch.")
            success = False
        
        if "[OPEN_LEARN" in result['response']:
            print("❌ FAILURE: Raw tag still present in clean response.")
            success = False
            
        if "How do you usually" not in result['response']:
            print("❌ FAILURE: Curiosity-driven follow-up question missing.")
            success = False

        if success:
            print("\n✨ SUCCESS: Persona is friendly, curiosity-driven, and navigation tags are working!")
        else:
            print("\n❌ TEST FAILED.")

if __name__ == "__main__":
    test_bot_persona_and_tags()
