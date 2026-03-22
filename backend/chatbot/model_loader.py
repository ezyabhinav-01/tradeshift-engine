import torch
from transformers import AutoModelForSeq2SeqLM, AutoModelForCausalLM, AutoTokenizer
from .config import config
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global cache
MODEL = None
TOKENIZER = None
CURRENT_DEVICE = None

def get_device():
    global CURRENT_DEVICE
    if CURRENT_DEVICE is not None:
        return CURRENT_DEVICE
        
    device_config = config.device.lower()
    if device_config in ["mps", "cuda", "cpu"]:
        CURRENT_DEVICE = device_config
    else:
        # Auto detect - prioritize CUDA, then Apple MPS, fallback CPU
        if torch.cuda.is_available():
            CURRENT_DEVICE = "cuda"
        elif torch.backends.mps.is_available():
            CURRENT_DEVICE = "mps"
        else:
            CURRENT_DEVICE = "cpu"
            
    logger.info(f"Resolved device string to: {CURRENT_DEVICE}")
    return CURRENT_DEVICE

def load_model():
    """
    Downloads and caches the model. 
    Applies memory saving quantizations/precisions based on the detected hardware.
    """
    global MODEL, TOKENIZER
    if MODEL is not None and TOKENIZER is not None:
        return MODEL, TOKENIZER
        
    device = get_device()
    model_name = config.model_name
    
    logger.info(f"Loading Tokenizer from: {model_name}")
    TOKENIZER = AutoTokenizer.from_pretrained(model_name)
    
    logger.info(f"Loading Model weights {model_name} onto {device}...")
    
    # Determine model class based on Hugging Face architecture conventions
    is_seq2seq = "t5" in model_name.lower() or "bart" in model_name.lower()
    model_class = AutoModelForSeq2SeqLM if is_seq2seq else AutoModelForCausalLM
    
    try:
        if device == "mps":
            # Apple Silicon works best with strict float16 mappings (no 8-bit support natively via bitsandbytes)
            MODEL = model_class.from_pretrained(model_name, torch_dtype=torch.float16).to(device)
            
        elif device == "cuda":
            # Linux + Nvidia path. Supports 8bit quantization natively if llama is huge
            load_kwargs = {"device_map": "auto", "torch_dtype": torch.float16}
            
            # Optional 8-bit optimization for 8B+ parameter models to save VRAM
            if "llama" in model_name.lower():
                try:
                    load_kwargs["load_in_8bit"] = True
                    load_kwargs.pop("torch_dtype")
                    logger.info("Engaging 8-bit Quantization via bitsandbytes...")
                except Exception as e:
                    logger.warning(f"8-bit quantization flag failed, adhering to fp16: {e}")
                    
            MODEL = model_class.from_pretrained(model_name, **load_kwargs)
            
        else:
            # Fallback to pure CPU float32
            MODEL = model_class.from_pretrained(model_name)
            
    except Exception as e:
        logger.error(f"Failed to load model optimally. Falling back to unsafe defaults. Error: {e}")
        MODEL = model_class.from_pretrained(model_name)
        if device != "cpu":
            MODEL = MODEL.to(device)

    logger.info("Model securely loaded to memory successfully.")
    return MODEL, TOKENIZER
