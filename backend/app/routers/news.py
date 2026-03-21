from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from ..news_service import get_news, explain_news

router = APIRouter(prefix="/api/news", tags=["News"])

class NewsItem(BaseModel):
    id: str
    title: str
    description: Optional[str]
    source: str
    url: str
    publishedAt: str
    sentiment: Optional[str] = None
    category: str

class ExplainRequest(BaseModel):
    news_id: str
    user_level: str = "Beginner"

class ExplainResponse(BaseModel):
    news_id: str
    explanation: str

@router.get("/", response_model=List[NewsItem])
async def fetch_news_endpoint(
    category: str = Query("all", enum=["all", "indian", "global"]),
    limit: int = Query(50, ge=1, le=100)
):
    """Fetch recent news articles based on category."""
    try:
        news = await get_news(category, limit)
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch news: {str(e)}")

@router.post("/explain", response_model=ExplainResponse)
async def explain_news_endpoint(request: ExplainRequest):
    """Get an AI-powered explanation for a specific news article."""
    try:
        explanation = await explain_news(request.news_id, request.user_level)
        return {"news_id": request.news_id, "explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate explanation: {str(e)}")
