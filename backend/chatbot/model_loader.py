import logging

logger = logging.getLogger(__name__)

# Replaced heavy AutoModelForCausalLM downloads with minimal RAG pass-through
def load_model():
    logger.info("Local HuggingFace model loading disabled to save 9GB. Using Gemini API exclusively.")
    return None, None
