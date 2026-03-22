from fastapi import FastAPI, HTTPException, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import os
import sys
import uuid
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from .model_loader import load_model
from .bot import get_bot
from .config import config
from .database import log_conversation, update_feedback
from .ingest import ingest_data

# limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Local FinChatbot Backend")
# app.state.limiter = limiter
# app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

API_KEY = os.getenv("CHATBOT_API_KEY", "tradeshift-local-key")

async def verify_api_key(x_api_key: Optional[str] = Header(default=None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key: Permission Denied")

# Inject critical CORS boundary to accept external React ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistent In-Memory Session Dictionary holding [session_id: history] mappings
sessions: Dict[str, Any] = {}

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class FeedbackRequest(BaseModel):
    session_id: str
    rating: str 
    feedback: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    print("TradeGuide AI Startup: Initializing RAG Knowledge Base...")
    # Initialize the RAG bot (this loads sentence-transformers for embeddings)
    get_bot()
    print("AI Gateway ready. All local vector weights verified.")

@app.post("/api/chat")
# @limiter.limit("5/minute")
async def chat_endpoint(request: Request, req: ChatRequest, x_api_key: Optional[str] = Header(default=None)):
    # Verify API Key directly for speed and debugging
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key: Permission Denied")
    try:
        # Spin up new GUID for unassigned traffic
        session_id = req.session_id or str(uuid.uuid4())
        history = sessions.get(session_id, [])
        
        bot = get_bot()
        result = bot.get_response(req.message, history)
        
        # Append bi-directional communication to memory
        history.append({"role": "user", "content": req.message})
        history.append({"role": "assistant", "content": result["response"]})
        
        # Clamp memory buffer to 10 nodes to preserve LLM Ram Sequence Window
        sessions[session_id] = history[-10:]
        
        # Compile response with metadata
        result["session_id"] = session_id
        result["model"] = "gemini-2.5-flash"
        
        # Mock Contextual Auto-Suggestions mimicking dynamic GPT behaviors
        topic = req.message.lower()
        suggestions = ["What are some useful indicators?", "How do I backtest with Replay mode?"]
        if "macd" in topic or "indicator" in topic:
            suggestions = ["How is RSI different from MACD?", "Can you explain Bollinger Bands?"]
        elif "p/e" in topic or "roe" in topic or "fundamental" in topic:
            suggestions = ["What is considered a good ROE?", "How does P/E fluctuate across sectors?"]
        elif "drawing" in topic or "tool" in topic:
            suggestions = ["How do I use Fibonacci retracements?"]
            
        result["suggested_questions"] = suggestions
        
        # Log to local SQLite Analytics payload
        log_conversation(session_id, req.message, result["response"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference boundary error: {str(e)}")

@app.post("/api/chat/feedback")
async def feedback_endpoint(req: FeedbackRequest, api_key: str = Depends(verify_api_key)):
    update_feedback(req.session_id, req.rating, req.feedback)
    print(f"[REINFORCEMENT LEARNING] Feedback '{req.rating}' stored natively for Session '{req.session_id}'. Note: {req.feedback}")
    return {"status": "ingested"}

@app.post("/api/chat/reindex")
async def reindex_knowledge(api_key: str = Depends(verify_api_key)):
    try:
        # Call the standalone ingestion function
        ingest_data()
        return {"status": "success", "message": "ChromaDB Semantic Knowledge base successfully aggregated."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/suggestions/{topic}")
async def get_suggestions(topic: str):
    topic = topic.lower()
    if topic == "indicators":
        return {"suggestions": ["Explain MACD", "What is RSI?", "How to draw Fibonacci retracements?"]}
    elif topic == "screener":
        return {"suggestions": ["What defines a Multibagger stock?", "How do you calculate ROCE?"]}
    return {"suggestions": ["How do I use the drawing tools?", "What is Historical Replay Mode?"]}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "chatbot", "model": config.model_name}
