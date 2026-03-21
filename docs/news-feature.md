# News & AI Insights Feature Documentation

## Overview
The TradeShift News & AI Insights feature provides full market context through real-time global news fetching, overlaid with AI-generated explanations and sentiment analysis tailored to the user's trading knowledge level.

---

## Architecture & Data Flow

### 1. How News is Fetched
- The frontend initiates a request to the FastApi backend (`/api/news`) specifying a `category` (`all`, `indian`, or `global`) and a `limit`.
- The backend aggregates data from primary sources (such as **NewsAPI** and potentially **Alpha Vantage** for sentiment).
- The fetching logic handles deduplication of articles based on titles and URLs to ensure clean feeds.

### 2. Caching Strategy
- **Redis Integration**: To minimize API usage and improve response times, fetched news articles are aggressively cached in Redis.
- **Caching Duration**: By default, news feeds are cached for **15 to 30 minutes** depending on the volatility of the session.
- **Fallback Mechanism**: If Redis is unavailable or the connection drops, the system falls back to a limited in-memory cache or direct API execution.

---

## Categories and Sources

The feature currently segregates news into the following categories:
- **`indian`**: Focuses on NSE/BSE specific news, fetching primarily from regional Indian news sources.
- **`global`**: Broad global macroeconomic news, US markets, Forex, and Crypto news.
- **`all`**: A chronological mix of both.

**Sources**: The backend relies heavily on `NewsAPI` using standard domains (Reuters, Bloomberg, CNBC, Economic Times, Mint, etc.).

---

## Configuration & API Keys

To enable the news feature, ensure the following environment variables are correctly populated in your `backend/.env` file:

```env
# Required for fetching market news
NEWSAPI_KEY=your_newsapi_key

# Optional, but recommended for deep market indicators and asset-specific sentiment
ALPHA_VANTAGE_KEY=your_alpha_vantage_key 

# Required to store the cache; use standard syntax
REDIS_URL=redis://localhost:6379

# Endpoint URL for the AI Explainer engine
FIN_GPT_URL=http://localhost:8000/generate
```
*Note: Make sure to restart your Docker containers or your local uvicorn server after updating `.env`.*

---

## AI Explainer (FinGPT)

The real USP of the news feature is the AI Explainer. This allows users to click on complex financial news headlines and receive simplified, jargon-free explanations.

### How it Works
1. When a user clicks "Explain this to me" on the frontend, the `explainNews` function in `newsApi.ts` sends a `POST` request to `/api/news/explain`.
2. The payload contains the `news_id` and the `user_level` (e.g., "Beginner", "Advanced").
3. The backend retrieves the full news context from the Redis cache using the `news_id`.
4. It crafts a prompt mapping the news content against the `user_level` and sends it to the `FIN_GPT_URL`.
5. The generated explanation is streamed or returned back to the UI.

### Customizing the Prompt
Developers can easily customize the behavior, persona, and tone of the AI explainer by modifying the prompt template in the backend `news_service.py` (or the respective router).
Look for the `generate_explanation_prompt` string block to adjust the system message (e.g., instructing it to act like a specific investor or focusing on options trading impact).

---

## Limitations and Trade-offs

1. **Rate Limits**: 
   - **NewsAPI Developer tier** allows only 100 requests per day. The 30-minute Redis caching is critical here. In a multi-user environment, a commercial key is highly recommended.
   - **Alpha Vantage** free tier limits to 25 requests per day. Use it sparingly, only for deep dives rather than feed generation.
2. **FinGPT Cold Starts**: If using a locally hosted LLM or serverless GPU for FinGPT, the very first explanation request might take a few seconds longer due to model load times.
3. **Data Freshness vs. API Cost**: The caching duration presents a trade-off. News older than 30 minutes might miss critical flash crashes. For live algorithmic paper trading, consider upgrading the API tier and reducing the cache TTL to 1-5 minutes.
