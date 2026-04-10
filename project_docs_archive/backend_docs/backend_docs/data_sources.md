# Tradeshift Engine Market Data Sources

This document details the data sources and strategies used for populating the Markets interface `/markets`.

## 1. Live Index Streaming (Shoonya WebSocket)
To provide real-time ticking for the top indices (Nifty 50, Bank Nifty, Sensex), we utilize the **Shoonya API (Finvasia)**.
- **Backend Service:** `app/live_market.py`
- **Library:** `NorenRestApiPy` with `pyotp`
- **Architecture:** 
  1. FastAPI starts the `shoonya_live` connection as a background task.
  2. The service logs into Shoonya via API Key and TOTP, then establishes a persistent WebSocket connection to Shoonya's servers.
  3. We subscribe to specific tokens (e.g. `NSE|26000` for NIFTY 50).
  4. Incoming ticks are parsed and stored in `latest_data`.
  5. The frontend connects to `ws://localhost:8000/ws/live_indices`. Whenever Shoonya pushes a tick to the backend, the backend relays the entire `latest_data` dictionary to the connected frontend clients.

*Note: Shoonya credentials must be correctly populated in the `.env` file.*

## 2. Market Movers and Sectors (yfinance + Redis)
Due to the difficulty in finding a free, reliable, and comprehensive API that provides real-time "Top Gainers" and "Top Losers" across the entire NSE, we use a hybrid approach heavily reliant on `yfinance`:
- **Backend Service:** `app/market_service.py`
- **Caching:** Redis.
- **Background Cron Job:** `apscheduler` is configured in `main.py` to refresh this data every 15 minutes.
- **Strategy:**
  1. We maintain a curated list of Nifty 50 symbols (e.g., `RELIANCE.NS`, `TCS.NS`) and fetch batch histories from Yahoo Finance.
  2. We calculate percent changes, sort them, and bucket them into "Gainers", "Losers", and "Most Active".
  3. The result is cached in Redis for 5 minutes (`cache_ttl`).
  4. Sector performance is handled identically via specific Yahoo Finance sector indices (e.g., `^CNXIT`, `^NSEBANK`).

## 3. Options Chain data (yfinance)
When the user requests F&O data for Nifty or Bank Nifty, we query `yfinance.Ticker().options`. 
- **Metrics Calculated:** Open Interest (OI), Implied Volatility (IV), Put-Call Ratio (PCR), and Max Pain.
- **Caching:** Saved in Redis for 5 minutes.
- **Fallback:** If Yahoo Finance fails to return options data (which it sometimes does for Indian indices), a mock deterministic engine in `MarketService._generate_mock_option_chain` supplies realistic approximations based on the underlying ATM strike.
