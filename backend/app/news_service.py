import os
import re
import json
import asyncio
import aiohttp
import hashlib
import urllib.parse
from datetime import datetime
from redis import Redis
import html
import feedparser
from .nlp_engine import generate_news_explanation

# Environment Variables
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY", "")
USE_NEWSAPI_FALLBACK = os.getenv("USE_NEWSAPI_FALLBACK", "false").lower() == "true"
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



async def fetch_indian_news_rss(limit: int = 50) -> list[dict]:
    """Fetch high-quality Indian financial news from RSS feeds."""
    rss_urls = [
        "https://www.moneycontrol.com/rss/latestnews.xml",
        "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
        "https://news.google.com/rss/search?q=indian+stock+market+Nifty+Sensex&hl=en-IN&gl=IN&ceid=IN:en",
        "https://www.livemint.com/rss/markets",
        "https://www.business-standard.com/rss/markets-106.rss",
        "https://www.financialexpress.com/market/feed/"
    ]
    
    all_articles = []
    async with aiohttp.ClientSession() as session:
        for url in rss_urls:
            try:
                async with session.get(url, timeout=5) as resp:
                    if resp.status == 200:
                        content = await resp.text()
                        feed = feedparser.parse(content)
                        for entry in feed.entries:
                            # 1. RAW CONTENT EXTRACTION (Save for image regex before cleaning)
                            raw_desc = entry.get("description", entry.get("summary", ""))
                            raw_content = ""
                            if 'content' in entry:
                                raw_content = entry.content[0].get('value', '')
                            
                            # Combine and unescape for regex
                            full_html = html.unescape(raw_desc + " " + raw_content)
                            
                            # 2. IMAGE EXTRACTION (Primary)
                            image_url = None
                            
                            # - Check media:content
                            if 'media_content' in entry:
                                image_url = entry.media_content[0].get('url')
                            # - Check enclosure
                            if not image_url and 'enclosures' in entry:
                                for enc in entry.enclosures:
                                    if 'image' in enc.get('type', ''):
                                        image_url = enc.get('href')
                                        break
                            # - Extract <img> from RAW HTML (Crucial for Moneycontrol & ET)
                            if not image_url:
                                # Look for data-src or src in <img> tags
                                img_match = re.search(r'<img[^>]+(?:src|data-src)=["\']([^"\']+\.(?:jpg|png|jpeg|webp))["\']', full_html, re.IGNORECASE)
                                if img_match:
                                    image_url = img_match.group(1)
                            
                            # - Check for RSS enclosure (Standard)
                            if not image_url and 'links' in entry:
                                for l in entry.links:
                                    if 'image' in l.get('type', ''):
                                        image_url = l.get('href')
                                        break
                            
                            # 3. TEXT CLEANUP (Displayed to user)
                            title = html.unescape(entry.get("title", ""))
                            summary = re.sub(r'<[^>]+>', '', html.unescape(raw_desc))
                            published_at = entry.get("published", entry.get("updated", datetime.now().isoformat()))
                            

                            all_articles.append({
                                "id": hashlib.md5(entry.get("link", "").encode()).hexdigest(),
                                "title": title,
                                "description": summary[:250] + "..." if len(summary) > 250 else summary,
                                "source": feed.feed.get("title", "Indian Market News"),
                                "url": entry.get("link"),
                                "publishedAt": published_at,
                                "category": "indian",
                                "imageUrl": image_url
                            })
            except Exception as e:
                print(f"⚠️ RSS Fetch Error for {url}: {e}")
    
    # Sort by "published" if possible (feedparser published_parsed)
    # For simplicity, we just return the collected items
    return all_articles[:limit]

async def fetch_newsapi(category: str, limit: int = 50) -> list[dict]:
    """Fetch news from NewsAPI. Categories: 'indian', 'global', 'all'."""
    if not NEWSAPI_KEY:
        print("⚠️ NEWSAPI_KEY missing")
        return []

    async with aiohttp.ClientSession() as session:
        try:
            # Map categories to search queries/endpoints
            if category == "indian":
                # USE TOP-HEADLINES FOR INDIAN BUSINESS - MUCH MORE RELIABLE
                url = f"https://newsapi.org/v2/top-headlines?country=in&category=business&pageSize={limit}&apiKey={NEWSAPI_KEY}"
            else:
                queries = {
                    "global": "global stock market OR Wall Street OR Fed interest rates OR NASDAQ OR S&P 500",
                    "all": "stock market OR finance OR economy"
                }
                q = queries.get(category, "stock market")
                url = f"https://newsapi.org/v2/everything?q={q}&language=en&sortBy=publishedAt&pageSize={limit}&apiKey={NEWSAPI_KEY}"

            async with session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    articles = data.get("articles", [])
                    
                    # IF INDIAN TOP-HEADLINES IS EMPTY, FALLBACK TO EVERYTHING SEARCH
                    if category == "indian" and not articles:
                        print("ℹ️ Indian top-headlines empty, falling back to everything search...")
                        fallback_q = "Indian stock market OR Nifty 50 OR Sensex OR NSE India OR BSE India"
                        fallback_url = f"https://newsapi.org/v2/everything?q={fallback_q}&language=en&sortBy=publishedAt&pageSize={limit}&apiKey={NEWSAPI_KEY}"
                        async with session.get(fallback_url, timeout=10) as fb_resp:
                            if fb_resp.status == 200:
                                fb_data = await fb_resp.json()
                                articles = fb_data.get("articles", [])

                    return [
                        {
                            "id": hashlib.md5(a.get("url", "").encode()).hexdigest(),
                            "title": a.get("title"),
                            "description": a.get("description"),
                            "source": a.get("source", {}).get("name", "NewsAPI"),
                            "url": a.get("url"),
                            "publishedAt": a.get("publishedAt"),
                            "category": category,
                            "imageUrl": a.get("urlToImage")
                        }
                        for a in articles if a.get("title")
                    ]
                else:
                    print(f"⚠️ NewsAPI error: {resp.status} for {url}")
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
                            "category": "global",
                            "imageUrl": item.get("banner_image")
                        }
                        for item in feed
                    ]
        except Exception as e:
            print(f"⚠️ Alpha Vantage Error: {e}")
    return []

async def fetch_newsdata(category: str, limit: int = 50) -> list[dict]:
    """
    Fetch news from NewsData.io.
    Acts as an additional reliable provider beside RSS baseline.
    """
    if not NEWSDATA_API_KEY:
        return []

    base_url = "https://newsdata.io/api/1/news"
    params = {
        "apikey": NEWSDATA_API_KEY,
        "language": "en",
    }

    if category == "indian":
        params.update({
            "country": "in",
            "category": "business",
            "q": "NSE OR BSE OR Nifty OR Sensex OR Indian stock market",
        })
    elif category == "global":
        params.update({
            "category": "business",
            "q": "global stock market OR wall street OR fed rates OR inflation",
        })
    else:
        params.update({
            "category": "business",
            "q": "stock market OR economy OR finance",
        })

    all_items: list[dict] = []
    next_page = None

    async with aiohttp.ClientSession() as session:
        # Fetch up to two pages to avoid excessive API use.
        for _ in range(2):
            req_params = dict(params)
            if next_page:
                req_params["page"] = next_page
            try:
                async with session.get(base_url, params=req_params, timeout=12) as resp:
                    if resp.status != 200:
                        print(f"⚠️ NewsData error: {resp.status}")
                        break
                    data = await resp.json()
                    results = data.get("results", []) or []
                    for item in results:
                        url = item.get("link") or ""
                        title = item.get("title") or ""
                        if not url or not title:
                            continue
                        all_items.append({
                            "id": hashlib.md5(url.encode()).hexdigest(),
                            "title": title,
                            "description": item.get("description"),
                            "source": item.get("source_id", "NewsData"),
                            "url": url,
                            "publishedAt": item.get("pubDate"),
                            "category": category,
                            "imageUrl": item.get("image_url")
                        })
                    next_page = data.get("nextPage")
                    if not next_page or len(all_items) >= limit:
                        break
            except Exception as e:
                print(f"⚠️ NewsData Fetch Error: {e}")
                break

    return all_items[:limit]

async def get_news(category: str = "all", limit: int = 50) -> list[dict]:
    """Merged, deduplicated, and sorted news."""
    cache_key = f"news_feed_{category}_{limit}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    # Fetch tasks
    tasks = []
    # Increase the base limit to ensure we reach 3-day history
    fetch_limit = limit * 2 

    if category == "indian":
        # Baseline: Indian RSS + NewsData.
        tasks.append(fetch_indian_news_rss(fetch_limit))
        tasks.append(fetch_newsdata("indian", fetch_limit))
    elif category == "global":
        # Global: NewsData (+ AlphaVantage if available)
        tasks.append(fetch_newsdata("global", fetch_limit))
        if ALPHA_VANTAGE_KEY:
            tasks.append(fetch_alpha_vantage_sentiment())
    else:  # "all"
        # Primary flow without NewsAPI hard dependency.
        tasks.append(fetch_indian_news_rss(fetch_limit))
        tasks.append(fetch_newsdata("all", fetch_limit))
        if ALPHA_VANTAGE_KEY:
            tasks.append(fetch_alpha_vantage_sentiment())

    # Optional NewsAPI fallback only if explicitly enabled.
    if USE_NEWSAPI_FALLBACK and NEWSAPI_KEY:
        if category == "global":
            tasks.append(fetch_newsapi("global", fetch_limit))
        else:
            tasks.append(fetch_newsapi("all", fetch_limit))
    
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

    # Dynamically fetch image from Reddit / Pollinations AI based on article content/title
    async with aiohttp.ClientSession() as session:
        async def enrich_image(article):
            if article.get("imageUrl"):
                return  # Use primary source image
                
            clean_title = article.get("title", "").replace('"', '').replace("'", "").strip()
            if not clean_title:
                return

            safe_title = urllib.parse.quote(clean_title)
            
            # Step 1: Scrape relevant image from Reddit
            reddit_url = f"https://www.reddit.com/search.json?q={safe_title}&type=link&sort=relevance"
            try:
                headers = {'User-Agent': 'Tradeshift-News-Service/1.0'}
                async with session.get(reddit_url, headers=headers, timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for child in data.get("data", {}).get("children", []):
                            post = child.get("data", {})
                            if "preview" in post and "images" in post["preview"]:
                                article["imageUrl"] = html.unescape(post["preview"]["images"][0]["source"]["url"])
                                return
                            elif post.get("url", "").endswith((".jpg", ".png", ".jpeg")):
                                article["imageUrl"] = post["url"]
                                return
            except Exception:
                pass
                
            # Step 2: Use Bing Thumbnail Search based on article content
            article["imageUrl"] = f"https://tse1.mm.bing.net/th?q={safe_title}+news&w=800&h=500&c=7&rs=1&p=0"
            
        await asyncio.gather(*(enrich_image(a) for a in final_news))

    _set_cache(cache_key, final_news, expire=120) # 2 min high-frequency cache
    return final_news

async def explain_news(news_id: str, user_level: str = "Beginner", title: str = None, description: str = None) -> str:
    """Calls FinGPT logic for news explanation."""
    # 1. Try to find the news item from cache or fetch list
    news_item = None
    if news_id:
        for cat in ["all", "indian", "global"]:
            cached = _get_cache(f"news_feed_{cat}_50")
            if cached:
                news_item = next((item for item in cached if item["id"] == news_id), None)
                if news_item:
                    break
    
    # 2. Use provided title and description as fallback
    final_title = title
    final_desc = description
    
    if news_item:
        final_title = news_item['title']
        final_desc = news_item['description']
    
    if not final_title:
        return "Could not find the news article content to explain. Please provide title and description."

    # 3. DIRECTLY CALL NLP ENGINE - NO EXTERNAL HTTP CALLS TO FAILING SERVICES
    try:
        return await generate_news_explanation(final_title, final_desc or "", user_level)
    except Exception as e:
        print(f"⚠️ explain_news Error: {e}")
        return f"AI Explanation engine failed: {str(e)}"

# Enhanced simulation helper with Timestamp Shifting
async def fetch_news_for_date(symbol: str, target_date: str) -> list[dict]:
    """
    Backward-compatible shim.
    Replay news scheduling is now handled by the Market Clock Engine
    (publish_time + configured delay, deterministic and DB-backed).
    """
    try:
        from .market_clock_news import get_replay_news_schedule, DEFAULT_DELAY_SECONDS, DEFAULT_POLICY
        return await get_replay_news_schedule(
            symbol=symbol,
            target_date=target_date,
            delay_seconds=DEFAULT_DELAY_SECONDS,
            replay_policy=DEFAULT_POLICY,
        )

    except Exception as e:
        print(f"⚠️ Error in fetch_news_for_date: {e}")
        return []
