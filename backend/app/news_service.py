import os
import re
import json
import asyncio
import aiohttp
import hashlib
import urllib.parse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import html
import feedparser
from typing import Any
from .nlp_engine import generate_news_explanation
from .redis_utils import get_redis_client

# Environment Variables
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY", "")
USE_NEWSAPI_FALLBACK = os.getenv("USE_NEWSAPI_FALLBACK", "false").lower() == "true"
redis_client = get_redis_client(log_prefix="Redis for news_service")

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

def _set_cache(key: str, value: Any, expire: int = 3600):
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
    
    async def fetch_single_rss(url: str, session: aiohttp.ClientSession) -> list[dict]:
        rows: list[dict] = []
        try:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return rows
                content = await resp.text()
                feed = feedparser.parse(content)
                for entry in feed.entries:
                    raw_desc = entry.get("description", entry.get("summary", ""))
                    raw_content = ""
                    if "content" in entry:
                        raw_content = entry.content[0].get("value", "")

                    full_html = html.unescape(raw_desc + " " + raw_content)

                    image_url = None
                    if "media_content" in entry and entry.media_content:
                        image_url = entry.media_content[0].get("url")
                    if not image_url and "enclosures" in entry:
                        for enc in entry.enclosures:
                            if "image" in enc.get("type", ""):
                                image_url = enc.get("href")
                                break
                    if not image_url:
                        img_match = re.search(
                            r'<img[^>]+(?:src|data-src)=["\']([^"\']+\.(?:jpg|png|jpeg|webp))["\']',
                            full_html,
                            re.IGNORECASE,
                        )
                        if img_match:
                            image_url = img_match.group(1)
                    if not image_url and "links" in entry:
                        for link_item in entry.links:
                            if "image" in link_item.get("type", ""):
                                image_url = link_item.get("href")
                                break

                    title = html.unescape(entry.get("title", "")).strip()
                    summary = re.sub(r"<[^>]+>", "", html.unescape(raw_desc or "")).strip()
                    published_at = entry.get("published", entry.get("updated", datetime.now().isoformat()))
                    link = entry.get("link", "")
                    if not title or not link:
                        continue

                    rows.append({
                        "id": hashlib.md5(link.encode(), usedforsecurity=False).hexdigest(),
                        "title": title,
                        "description": summary[:280] + "..." if len(summary) > 280 else summary,
                        "source": feed.feed.get("title", "Indian Market News"),
                        "url": link,
                        "publishedAt": published_at,
                        "category": "indian",
                        "imageUrl": image_url,
                    })
        except Exception as e:
            print(f"⚠️ RSS Fetch Error for {url}: {e}")
        return rows

    all_articles: list[dict] = []
    timeout = aiohttp.ClientTimeout(total=6, connect=2, sock_read=4)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        per_feed = await asyncio.gather(*(fetch_single_rss(url, session) for url in rss_urls))
        for feed_items in per_feed:
            all_articles.extend(feed_items)
    
    # Sort by "published" if possible (feedparser published_parsed)
    # For simplicity, we just return the collected items
    return all_articles[:limit]


FINANCIAL_KEYWORDS = (
    "stock", "market", "share", "equity", "nifty", "sensex", "nse", "bse", "rbi",
    "earnings", "revenue", "profit", "ipo", "inflation", "interest rate", "fed",
    "wall street", "bond", "yield", "bank", "finance", "economy", "gdp", "sebi",
)

INDIA_KEYWORDS = (
    "india", "indian", "nse", "bse", "sensex", "nifty", "rbi", "sebi", "mumbai",
    "rupee", "inr", "bombay stock exchange",
)

GLOBAL_KEYWORDS = (
    "global", "wall street", "nasdaq", "dow jones", "s&p", "federal reserve",
    "ecb", "boe", "boj", "us economy", "europe", "china market", "japan market",
)

INDIA_DOMAINS = (
    "moneycontrol.com",
    "economictimes.indiatimes.com",
    "livemint.com",
    "business-standard.com",
    "financialexpress.com",
    "ndtvprofit.com",
    "thehindubusinessline.com",
)

LOW_QUALITY_SOURCE_HINTS = (
    "reddit",
    "youtube",
    "facebook",
    "instagram",
    "x.com",
    "twitter",
)

HIGH_TRUST_DOMAINS = (
    "reuters.com",
    "bloomberg.com",
    "wsj.com",
    "ft.com",
    "economictimes.indiatimes.com",
    "moneycontrol.com",
    "livemint.com",
    "business-standard.com",
    "thehindubusinessline.com",
)


def _parse_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.min
    raw = value.strip()
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        pass
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        pass
    for fmt in ("%Y%m%dT%H%M%S", "%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            continue
    return datetime.min


def _normalize_published_at(value: str | None) -> str | None:
    dt = _parse_datetime(value)
    if dt == datetime.min:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe_text(item: dict) -> str:
    title = (item.get("title") or "").strip()
    desc = (item.get("description") or "").strip()
    source = (item.get("source") or "").strip()
    return f"{title} {desc} {source}".lower()


def _get_domain(url: str | None) -> str:
    if not url:
        return ""
    try:
        return urllib.parse.urlparse(url).netloc.lower()
    except Exception:
        return ""


def _is_financially_relevant(item: dict) -> bool:
    text = _safe_text(item)
    return any(keyword in text for keyword in FINANCIAL_KEYWORDS)


def _is_source_reliable(item: dict) -> bool:
    source = (item.get("source") or "").lower()
    domain = _get_domain(item.get("url"))
    haystack = f"{source} {domain}"
    return not any(noise in haystack for noise in LOW_QUALITY_SOURCE_HINTS)

def _source_trust_level(item: dict) -> str:
    domain = _get_domain(item.get("url"))
    source = (item.get("source") or "").lower()
    if any(d in domain for d in HIGH_TRUST_DOMAINS):
        return "high"
    if any(name in source for name in ("reuters", "bloomberg", "mint", "economic times", "moneycontrol")):
        return "high"
    return "medium"


def _infer_geo(item: dict) -> str:
    text = _safe_text(item)
    domain = _get_domain(item.get("url"))
    source = (item.get("source") or "").lower()

    if any(india_domain in domain for india_domain in INDIA_DOMAINS):
        return "indian"

    indian_hits = sum(1 for k in INDIA_KEYWORDS if k in text)
    global_hits = sum(1 for k in GLOBAL_KEYWORDS if k in text)

    if indian_hits > global_hits and indian_hits > 0:
        return "indian"
    if global_hits > indian_hits and global_hits > 0:
        return "global"

    if "india" in source or "indian" in source:
        return "indian"
    return "unknown"


def _default_image_for(item: dict) -> str:
    title = (item.get("title") or "financial market news").strip()
    safe_title = urllib.parse.quote(title)
    return f"https://tse1.mm.bing.net/th?q={safe_title}+news&w=800&h=500&c=7&rs=1&p=0"

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
                            "id": hashlib.md5(a.get("url", "").encode(), usedforsecurity=False).hexdigest(),
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
                            "id": hashlib.md5(item.get("url", "").encode(), usedforsecurity=False).hexdigest(),
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
                            "id": hashlib.md5(url.encode(), usedforsecurity=False).hexdigest(),
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
    # Mild over-fetching for dedupe while keeping latency low.
    fetch_limit = min(max(limit + 20, 40), 100)

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
        elif category == "indian":
            tasks.append(fetch_newsapi("indian", fetch_limit))
        else:
            tasks.append(fetch_newsapi("all", fetch_limit))
    
    results = await asyncio.gather(*tasks)
    
    merged = []
    seen_urls = set()
    for res_list in results:
        for item in res_list:
            url = item.get("url")
            if not url:
                continue
            if url not in seen_urls:
                merged.append(item)
                seen_urls.add(url)

    filtered: list[dict] = []
    for item in merged:
        if not item.get("title"):
            continue
        if not _is_source_reliable(item):
            continue
        if not _is_financially_relevant(item):
            continue

        geo = _infer_geo(item)
        if category == "indian" and geo != "indian":
            continue
        if category == "global" and geo == "indian":
            continue

        if not item.get("imageUrl"):
            item["imageUrl"] = _default_image_for(item)
        item["sourceTrust"] = _source_trust_level(item)
        normalized_published_at = _normalize_published_at(item.get("publishedAt"))
        if normalized_published_at:
            item["publishedAt"] = normalized_published_at

        filtered.append(item)

    # Graceful fallback: if strict filters return nothing, still surface relevant feed
    # instead of hard empty state.
    if not filtered and merged:
        for item in merged:
            if not item.get("title") or not item.get("url"):
                continue
            if not _is_source_reliable(item):
                continue
            if not item.get("imageUrl"):
                item["imageUrl"] = _default_image_for(item)
            item["sourceTrust"] = _source_trust_level(item)
            normalized_published_at = _normalize_published_at(item.get("publishedAt"))
            if normalized_published_at:
                item["publishedAt"] = normalized_published_at
            filtered.append(item)

    filtered.sort(key=lambda x: _parse_datetime(x.get("publishedAt")), reverse=True)
    final_news = filtered[:limit]

    _set_cache(cache_key, final_news, expire=120) # 2 min high-frequency cache
    return final_news

async def explain_news(news_id: str, user_level: str = "Beginner", title: str = None, description: str = None) -> str:
    """Calls FinGPT logic for news explanation."""
    cache_key = f"news_explain_{news_id}_{user_level}".lower()
    cached_explanation = _get_cache(cache_key)
    if cached_explanation:
        return cached_explanation

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
        explanation = await generate_news_explanation(final_title, final_desc or "", user_level)
        if explanation:
            _set_cache(cache_key, explanation, expire=600)
            return explanation
        fallback = "Explanation is temporarily unavailable. Please retry in a few seconds."
        _set_cache(cache_key, fallback, expire=60)
        return fallback
    except Exception as e:
        print(f"⚠️ explain_news Error: {e}")
        fallback = (
            "The AI explanation service is under load right now. "
            "Use the headline and source context for now, and retry shortly for a full breakdown."
        )
        _set_cache(cache_key, fallback, expire=60)
        return fallback

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
