import os
import re
import json
import asyncio
import aiohttp
import hashlib
from datetime import datetime, timedelta
from redis import Redis
from .nlp_engine import is_market_relevant

# Environment Variables
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")
FIN_GPT_URL = os.getenv("FIN_GPT_URL", "http://fingpt:8001/explain") # Default if not set
REDIS_HOST = os.getenv("REDIS_HOST", "redis")

# Redis Setup
try:
    redis_client = Redis(host=REDIS_HOST, port=6379, decode_responses=True)
except Exception:
    redis_client = None
    print("⚠️ Redis not connected for news_service, using in-memory fallback pending.")

# Fallback Cache
_IN_MEMORY_CACHE = {}

def _get_cache(key: str):
    if redis_client:
        try:
            val = redis_client.get(key)
            return json.loads(val) if val else None
        except Exception:
            return _IN_MEMORY_CACHE.get(key)
    return _IN_MEMORY_CACHE.get(key)

def _set_cache(key: str, value: any, expire: int = 3600):
    if redis_client:
        try:
            redis_client.setex(key, expire, json.dumps(value))
        except Exception:
            _IN_MEMORY_CACHE[key] = value
    else:
        _IN_MEMORY_CACHE[key] = value

async def fetch_newsapi(category: str, limit: int = 50) -> list[dict]:
    """Fetch news from NewsAPI. Categories: 'indian', 'global', 'all'."""
    if not NEWSAPI_KEY:
        print("⚠️ NEWSAPI_KEY missing")
        return []

    # Map categories to search queries
    queries = {
        "indian": "Indian stock market OR Nifty 50 OR Sensex",
        "global": "global stock market OR Wall Street OR Fed interest rates",
        "all": "stock market OR finance OR economy"
    }
    
    q = queries.get(category, is_market_relevant)
    url = f"https://newsapi.org/v2/everything?q={q}&language=en&sortBy=publishedAt&pageSize={limit}&apiKey={NEWSAPI_KEY}"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    articles = data.get("articles", [])
                    return [
                        {
                            "id": hashlib.md5(a.get("url", "").encode()).hexdigest(),
                            "title": a.get("title"),
                            "description": a.get("description"),
                            "source": a.get("source", {}).get("name", "NewsAPI"),
                            "url": a.get("url"),
                            "publishedAt": a.get("publishedAt"),
                            "category": category
                        }
                        for a in articles if a.get("title")
                    ]
                else:
                    print(f"⚠️ NewsAPI error: {resp.status}")
        except Exception as e:
            print(f"⚠️ NewsAPI Fetch Error: {e}")
    return []

async def fetch_alpha_vantage_sentiment() -> list[dict]:
    """Fetch top news and sentiment from Alpha Vantage."""
    if not ALPHA_VANTAGE_KEY:
        return []

    url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=20&apikey={ALPHA_VANTAGE_KEY}"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    feed = data.get("feed", [])
                    return [
                        {
                            "id": hashlib.md5(item.get("url", "").encode()).hexdigest(),
                            "title": item.get("title"),
                            "description": item.get("summary"),
                            "source": item.get("source"),
                            "url": item.get("url"),
                            "publishedAt": item.get("time_published"),
                            "sentiment": item.get("overall_sentiment_label"),
                            "category": "global"
                        }
                        for item in feed
                    ]
        except Exception as e:
            print(f"⚠️ Alpha Vantage Error: {e}")
    return []

async def get_news(category: str = "all", limit: int = 50) -> list[dict]:
    """Merged, deduplicated, and sorted news."""
    cache_key = f"news_feed_{category}_{limit}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    # Fetch tasks
    tasks = [fetch_newsapi(category, limit)]
    if category in ["all", "global"]:
        tasks.append(fetch_alpha_vantage_sentiment())
    
    results = await asyncio.gather(*tasks)
    
    merged = []
    seen_urls = set()
    for res_list in results:
        for item in res_list:
            if item["url"] not in seen_urls:
                merged.append(item)
                seen_urls.add(item["url"])
    
    # Sort by publishedAt (assumes standard ISO format)
    merged.sort(key=lambda x: x.get("publishedAt", ""), reverse=True)
    
    # Take limit
    final_news = merged[:limit]
    _set_cache(cache_key, final_news, expire=1800) # 30 min cache
    return final_news

async def explain_news(news_id: str, user_level: str = "Beginner") -> str:
    """Calls FinGPT for news explanation."""
    # Find the news item from cache or fetch list
    # For now, we expect the frontend to pass the title/desc if possible, 
    # but here we'll try to find it in the 'all' news cache.
    news_item = None
    for cat in ["all", "indian", "global"]:
        cached = _get_cache(f"news_feed_{cat}_50")
        if cached:
            news_item = next((item for item in cached if item["id"] == news_id), None)
            if news_item:
                break
    
    if not news_item:
        return "Could not find the news article to explain. Please try again."

    prompt = f"""
    Explain this financial news article for a {user_level} trader.
    Title: {news_item['title']}
    Description: {news_item['description']}
    
    Break it down into:
    1. What happened?
    2. Why does it matter?
    3. Potential market impact.
    Keep it concise and easy to understand.
    """
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(FIN_GPT_URL, json={"prompt": prompt}, timeout=30) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("explanation", "AI was unable to generate an explanation at this moment.")
                else:
                    return f"AI Explanation service is currently unavailable (Status: {resp.status})."
        except Exception as e:
            print(f"⚠️ FinGPT Error: {e}")
            return "Failed to connect to AI Explanation service."

# Compatibility helper for existing simulation pipeline
async def fetch_news_for_date(symbol: str, target_date: str) -> list[dict]:
    """Legacy/Simulation helper to maintain backwards compatibility."""
    # Implementation can remain similar to the previous one or use NewsAPI with 'from' param if available
    # For now, let's keep it simple or call the new get_news if date matches today.
    # (Simplified for now to avoid breaking the simulation)
    return await get_news("all", 10)
