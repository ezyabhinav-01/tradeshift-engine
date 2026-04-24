# File: backend/main.py
# Trigger reload: 2026-03-27 15:22

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from sqlalchemy import create_engine, text, select, update, insert
from sqlalchemy.ext.asyncio import AsyncSession
import pandas as pd
import numpy as np
import io
import os
import json
import asyncio
import datetime
import time
import glob
import random
import re
import uuid
import aiohttp
import functools
from dataclasses import dataclass
from redis import Redis
from prometheus_client import Counter, Gauge
from prometheus_fastapi_instrumentator import Instrumentator
from concurrent.futures import ThreadPoolExecutor
from app.oms import OrderManager
from app import auth
from app.routers import portfolio, history, trading, news, community, analytics, notifications, user, learn, admin
from app.tasks.scheduler import setup_scheduler
from app.websocket_manager import order_manager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.fundamental_service import FundamentalService
from app.models import User, UserEvent, UserSession
from app.database import Base, get_db, get_optional_db, get_session, connect_to_database, connect_to_database_sync, get_db_sync, get_schema_gaps, is_local_database_url
import jwt
from app.config import SECRET_KEY, ALGORITHM

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
engine_sync = None

ISO_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}')
DMY_DATE_RE = re.compile(r'^\d{2}-\d{2}-\d{4}')

def parse_market_datetime(value):
    """
    Parse market timestamps safely:
    - Keep ISO (YYYY-MM-DD...) as year-month-day
    - Use day-first only for DD-MM-YYYY strings
    """
    s = str(value).replace('Ok ', '').strip()
    if ISO_DATE_RE.match(s):
        return pd.to_datetime(s, dayfirst=False, errors='coerce')
    if DMY_DATE_RE.match(s):
        return pd.to_datetime(s, dayfirst=True, errors='coerce')
    return pd.to_datetime(s, errors='coerce')


def _assert_runtime_database_ready_for_beta() -> None:
    app_env = (os.getenv("APP_ENV") or "development").strip().lower()
    if app_env != "beta":
        return
    raw_db_url = (os.getenv("DATABASE_URL") or "").strip()
    db_url = raw_db_url.lower()
    enforce_beta_postgres = os.getenv("ENFORCE_BETA_POSTGRES", "true").lower() in ("1", "true", "yes", "on")
    if not enforce_beta_postgres:
        return
    if not raw_db_url:
        raise RuntimeError("DATABASE_URL must be set when APP_ENV=beta.")
    if db_url.startswith("sqlite"):
        raise RuntimeError("Beta runtime must use PostgreSQL/TimescaleDB. SQLite is blocked for APP_ENV=beta.")


def _is_beta_runtime() -> bool:
    return (os.getenv("APP_ENV") or "development").strip().lower() == "beta"


def _has_shoonya_credentials() -> bool:
    required = [
        "SHOONYA_USER_ID",
        "SHOONYA_PASSWORD",
        "SHOONYA_VENDOR_CODE",
        "SHOONYA_API_SECRET",
        "SHOONYA_TOTP_SECRET",
    ]
    return all((os.getenv(name) or "").strip() for name in required)

# --- DB INITIALIZATION ---
# Explicitly import models to ensure they are registered with Base.metadata
import app.models

# Connect and Create Tables using the cached connection pattern
try:
    _assert_runtime_database_ready_for_beta()
    if is_local_database_url():
        engine_sync = connect_to_database_sync()
        Base.metadata.create_all(bind=engine_sync)
        logger.info("✅ Database Tables Created/Verified")

        try:
            schema_gaps = get_schema_gaps(engine_sync)
            if schema_gaps:
                logger.warning(
                    "⚠️ Legacy schema gaps detected: %s. Apply explicit DB migrations; startup hot-patch is now opt-in only.",
                    ", ".join(schema_gaps),
                )
            else:
                logger.info("✅ Database Schema Check Passed")
        except Exception as schema_err:
            logger.warning(f"⚠️ Schema verification failed: {schema_err}")
    else:
        logger.info("⏭️ Skipping eager schema sync for remote database to keep API boot non-blocking.")

    logger.info(f"Registered Tables: {Base.metadata.tables.keys()}")
except Exception as e:
    logger.error(f"❌ Database Initialization Failed: {e}")

def ensure_sync_engine():
    global engine_sync
    if engine_sync is None:
        engine_sync = connect_to_database_sync()
    return engine_sync


# --- 1. ROBUST IMPORT FOR SIMULATION ---
try:
    from app.simulation import TickSynthesizer
    logger.info("✅ Brownian Bridge Engine Loaded")
except ImportError:
    logger.warning("⚠️ Warning: simulation.py not found. Using Mock Fallback.")
    class TickSynthesizer:
        def generate_ticks(self, o, h, l, c, num_ticks=60):
            return [o] * num_ticks

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.datetime.utcnow()}

# Instrumentator (Monitoring)
Instrumentator().instrument(app).expose(app)

# Global Exception Handler for debugging 500s
from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

from apscheduler.schedulers.background import BackgroundScheduler
from app.market_service import market_service
from app.live_market import shoonya_live
from app.dependencies import admin_or_internal
from app.runtime_guards import ProcessFileLock, TTLCache, RollingSuccessTracker, parse_cors_origins, should_record_activity
from app.auth_side_effects import start_auth_side_effect_worker, stop_auth_side_effect_worker
from app.session_store import get_cached_session_identity, cache_session_identity

# Background workload controls.
RUN_BACKGROUND_JOBS = os.getenv("RUN_BACKGROUND_JOBS", "true").lower() in ("1", "true", "yes", "on")
ENABLE_COMMUNITY_SEED = os.getenv("ENABLE_COMMUNITY_SEED", "true").lower() in ("1", "true", "yes", "on")
MARKET_REFRESH_MINUTES = int(os.getenv("MARKET_REFRESH_MINUTES", "5"))
FUND_SYNC_SYMBOL_LIMIT = int(os.getenv("FUND_SYNC_SYMBOL_LIMIT", "200"))
FUND_SYNC_DAILY_HOUR = int(os.getenv("FUND_SYNC_DAILY_HOUR_IST", "18"))
FUND_SYNC_DAILY_MINUTE = int(os.getenv("FUND_SYNC_DAILY_MINUTE_IST", "10"))
FUND_SYNC_EXTRA_HOUR = int(os.getenv("FUND_SYNC_EXTRA_HOUR_IST", "12"))
FUND_SYNC_EXTRA_MINUTE = int(os.getenv("FUND_SYNC_EXTRA_MINUTE_IST", "30"))
FUND_SYNC_WEEKLY_HOUR = int(os.getenv("FUND_SYNC_WEEKLY_HOUR_IST", "9"))
FUND_SYNC_WEEKLY_MINUTE = int(os.getenv("FUND_SYNC_WEEKLY_MINUTE_IST", "30"))
FUND_SYNC_FALLBACK_SYMBOLS = [
    s.strip().upper() for s in os.getenv("FUND_SYNC_FALLBACK_SYMBOLS", "").split(",") if s.strip()
]
MARKET_REFRESH_MINUTES = min(max(MARKET_REFRESH_MINUTES, 1), 59)
HTTP_REQUEST_TIMEOUT_SECONDS = max(float(os.getenv("HTTP_REQUEST_TIMEOUT_SECONDS", "25")), 1.0)
ACTIVITY_WRITE_DEBOUNCE_SECONDS = max(int(os.getenv("ACTIVITY_WRITE_DEBOUNCE_SECONDS", "45")), 0)
SECURE_HEADERS_ENABLED = os.getenv("SECURE_HEADERS_ENABLED", "true").lower() in ("1", "true", "yes", "on")
HSTS_ENABLED = os.getenv("HSTS_ENABLED", "false").lower() in ("1", "true", "yes", "on")
REPLAY_MAX_CONCURRENT_SESSIONS = max(int(os.getenv("REPLAY_MAX_CONCURRENT_SESSIONS", "2")), 1)
REPLAY_MAX_THREAD_WORKERS = max(int(os.getenv("REPLAY_MAX_THREAD_WORKERS", "4")), 2)
REPLAY_AI_MAX_CONCURRENCY = max(int(os.getenv("REPLAY_AI_MAX_CONCURRENCY", "2")), 1)
WS_SEND_TIMEOUT_SECONDS = max(float(os.getenv("WS_SEND_TIMEOUT_SECONDS", "0.8")), 0.1)
ENABLE_SHOONYA_BACKGROUND_CONNECT = os.getenv("ENABLE_SHOONYA_BACKGROUND_CONNECT", "false").lower() in ("1", "true", "yes", "on")
ENFORCE_BETA_POSTGRES = os.getenv("ENFORCE_BETA_POSTGRES", "true").lower() in ("1", "true", "yes", "on")
REPLAY_START_SUCCESS_THRESHOLD = max(min(float(os.getenv("REPLAY_START_SUCCESS_THRESHOLD", "0.95")), 1.0), 0.0)
REPLAY_BOOTSTRAP_CACHE_TTL_SECONDS = max(int(os.getenv("REPLAY_BOOTSTRAP_CACHE_TTL_SECONDS", "900")), 60)
REPLAY_BOOTSTRAP_CACHE_MAX_ENTRIES = max(int(os.getenv("REPLAY_BOOTSTRAP_CACHE_MAX_ENTRIES", "256")), 16)
REPLAY_START_ROLLING_WINDOW = max(int(os.getenv("REPLAY_START_ROLLING_WINDOW", "200")), 20)
_activity_write_tracker = {}
DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://0.0.0.0:5173",
    "https://tradeshift-india.netlify.app",
    "https://20.40.42.232.nip.io",
]
ALLOWED_CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ALLOWED_ORIGINS"), DEFAULT_CORS_ORIGINS)

# --- BACKGROUND JOBS ---
scheduler = BackgroundScheduler()
async_scheduler = None
job_run_state = {}
replay_session_semaphore = asyncio.Semaphore(REPLAY_MAX_CONCURRENT_SESSIONS)
replay_ai_semaphore = asyncio.Semaphore(REPLAY_AI_MAX_CONCURRENCY)
replay_executor = ThreadPoolExecutor(
    max_workers=REPLAY_MAX_THREAD_WORKERS,
    thread_name_prefix="replay-worker",
)
replay_bootstrap_cache = TTLCache(
    ttl_seconds=REPLAY_BOOTSTRAP_CACHE_TTL_SECONDS,
    max_entries=REPLAY_BOOTSTRAP_CACHE_MAX_ENTRIES,
)
replay_available_dates_cache = TTLCache(
    ttl_seconds=REPLAY_BOOTSTRAP_CACHE_TTL_SECONDS,
    max_entries=REPLAY_BOOTSTRAP_CACHE_MAX_ENTRIES,
)
replay_start_tracker = RollingSuccessTracker(window_size=REPLAY_START_ROLLING_WINDOW)
REPLAY_START_ATTEMPTS = Counter("tradeshift_replay_start_attempts_total", "Replay websocket start attempts")
REPLAY_START_SUCCESSES = Counter("tradeshift_replay_start_successes_total", "Replay websocket starts acknowledged with SPEED_ACK")
REPLAY_START_FAILURES = Counter("tradeshift_replay_start_failures_total", "Replay websocket start failures before SPEED_ACK")
REPLAY_START_SUCCESS_RATIO = Gauge("tradeshift_replay_start_success_ratio", "Rolling replay websocket SPEED_ACK success ratio")


async def _run_blocking(fn, *args, **kwargs):
    loop = asyncio.get_running_loop()
    call = functools.partial(fn, *args, **kwargs)
    return await loop.run_in_executor(replay_executor, call)


async def _safe_ws_send(websocket: WebSocket, payload: dict):
    await asyncio.wait_for(websocket.send_json(payload), timeout=WS_SEND_TIMEOUT_SECONDS)


def _schedule_ws_send(websocket: WebSocket, payload: dict):
    async def _sender():
        try:
            await _safe_ws_send(websocket, payload)
        except Exception:
            pass
    asyncio.create_task(_sender())


def _build_ticks_for_rows(synthesizer: TickSynthesizer, rows: dict, default_ticks: int = 60) -> dict:
    ticks = {}
    for sym, row in rows.items():
        ticks[sym] = synthesizer.generate_ticks(
            float(row.get('open', 0)),
            float(row.get('high', 0)),
            float(row.get('low', 0)),
            float(row.get('close', 0)),
            num_ticks=default_ticks,
        )
    return ticks


@dataclass
class ReplayBootstrapPayload:
    symbol: str
    target_date: str
    candles: list[dict]
    backfill: list[dict]
    index_candles: dict[str, list[dict]]
    session_open: float
    index_opens: dict[str, float]


def _normalize_candles_frame(df: pd.DataFrame, date_col: str) -> pd.DataFrame:
    normalized = df.copy()
    if date_col != "datetime":
        normalized = normalized.rename(columns={date_col: "datetime"})
        date_col = "datetime"
    if not pd.api.types.is_datetime64_any_dtype(normalized[date_col]):
        normalized[date_col] = normalized[date_col].apply(parse_market_datetime)
    if normalized[date_col].dt.tz is not None:
        normalized[date_col] = normalized[date_col].dt.tz_localize(None)
    return normalized.sort_values(by=date_col)


def _records_from_frame(df: pd.DataFrame) -> list[dict]:
    return df.to_dict(orient="records")


def _candle_payload_from_frame(df: pd.DataFrame, date_col: str) -> list[dict]:
    candles: list[dict] = []
    for _, row in df.iterrows():
        ts_val = row[date_col]
        if ts_val.tzinfo is None:
            ts_val = ts_val.tz_localize("UTC")
        candles.append(
            {
                "time": int(ts_val.timestamp()),
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row.get("volume", 0) or 0),
            }
        )
    return candles


def _to_naive_timestamp(value) -> pd.Timestamp:
    ts = pd.to_datetime(value)
    return ts.tz_localize(None) if getattr(ts, "tzinfo", None) is not None else ts


def _get_available_dates_cached(base_symbol: str) -> list[str]:
    cached = replay_available_dates_cache.get(base_symbol)
    if cached is not None:
        return list(cached)
    dates = _available_dates_sync(base_symbol)
    replay_available_dates_cache.set(base_symbol, list(dates))
    return dates


def _build_replay_bootstrap_sync(symbol: str, target_date: str) -> ReplayBootstrapPayload:
    cache_key = f"{symbol}:{target_date}"
    cached = replay_bootstrap_cache.get(cache_key)
    if cached is not None:
        return cached

    base_symbol = symbol.split("-")[0] if "-" in symbol else symbol
    df_sym, _, _ = load_market_data_tiered(base_symbol, target_date, True)
    date_col = next((c for c in ["datetime", "date", "time"] if c in df_sym.columns), None)
    if not date_col:
        raise FileNotFoundError(f"No timestamp column found for {base_symbol} on {target_date}")

    target_dt = pd.to_datetime(target_date).date()
    normalized_main = _normalize_candles_frame(df_sym, date_col)
    date_col = "datetime"
    same_day_mask = (
        (normalized_main[date_col].dt.date == target_dt)
        & (normalized_main[date_col].dt.time <= datetime.time(15, 30))
    )
    session_df = normalized_main[same_day_mask]
    if session_df.empty:
        raise FileNotFoundError(f"No replay rows found for {base_symbol} on {target_date}")

    session_open = float(session_df.iloc[0].get("open", 0) or 0)

    backfill_dfs = []
    available_dates = _get_available_dates_cached(base_symbol)
    if target_date in available_dates:
        idx = available_dates.index(target_date)
        preceding = []
        for candidate in available_dates[idx + 1 :]:
            candidate_dt = pd.to_datetime(candidate).date()
            if (target_dt - candidate_dt).days <= 10:
                preceding.append(candidate)
                if len(preceding) >= 2:
                    break
        for candidate in reversed(preceding):
            try:
                df_prev, _, _ = load_market_data_tiered(base_symbol, candidate, True)
                prev_col = next((c for c in ["datetime", "date", "time"] if c in df_prev.columns), None)
                if prev_col:
                    backfill_dfs.append(_normalize_candles_frame(df_prev, prev_col))
            except Exception:
                continue
    backfill_dfs.append(session_df)

    backfill = []
    if backfill_dfs:
        backfill_frame = pd.concat(backfill_dfs, ignore_index=True)
        backfill = _candle_payload_from_frame(backfill_frame.tail(2000), date_col)

    index_aliases = {
        "NIFTY": ["NIFTY", "NIFTY 50", "^NSEI"],
        "BANKNIFTY": ["BANKNIFTY", "BANK NIFTY", "NIFTY BANK", "^NSEBANK"],
        "SENSEX": ["SENSEX", "BSE SENSEX", "^BSESN"],
    }
    index_candles: dict[str, list[dict]] = {}
    index_opens: dict[str, float] = {}
    for idx_name in ["NIFTY", "BANKNIFTY", "SENSEX"]:
        for idx_symbol in index_aliases.get(idx_name, [idx_name]):
            try:
                idx_df, _, _ = load_market_data_tiered(idx_symbol, target_date, True)
                idx_col = next((c for c in ["datetime", "date", "time"] if c in idx_df.columns), None)
                if not idx_col:
                    continue
                normalized_idx = _normalize_candles_frame(idx_df, idx_col)
                mask_idx = (
                    (normalized_idx[idx_col].dt.date == target_dt)
                    & (normalized_idx[idx_col].dt.time >= datetime.time(9, 15))
                    & (normalized_idx[idx_col].dt.time <= datetime.time(15, 30))
                )
                filtered_idx = normalized_idx[mask_idx]
                if filtered_idx.empty:
                    continue
                index_candles[idx_name] = _records_from_frame(filtered_idx)
                index_opens[idx_name] = float(filtered_idx.iloc[0].get("open", 0) or 0)
                break
            except Exception:
                continue

    payload = ReplayBootstrapPayload(
        symbol=base_symbol,
        target_date=target_date,
        candles=_records_from_frame(session_df),
        backfill=backfill,
        index_candles=index_candles,
        session_open=session_open,
        index_opens=index_opens,
    )
    replay_bootstrap_cache.set(cache_key, payload)
    return payload


def _record_replay_start_result(success: bool) -> float:
    snapshot = replay_start_tracker.record(success)
    REPLAY_START_SUCCESS_RATIO.set(snapshot.success_ratio)
    if success:
        REPLAY_START_SUCCESSES.inc()
    else:
        REPLAY_START_FAILURES.inc()
    if snapshot.attempts >= min(REPLAY_START_ROLLING_WINDOW, 20) and snapshot.success_ratio < REPLAY_START_SUCCESS_THRESHOLD:
        logger.warning(
            "🚫 Replay start success ratio %.2f%% is below launch threshold %.2f%% (%s/%s in rolling window).",
            snapshot.success_ratio * 100.0,
            REPLAY_START_SUCCESS_THRESHOLD * 100.0,
            snapshot.successes,
            snapshot.attempts,
        )
    return snapshot.success_ratio

def _mark_job_started(job_name: str):
    state = job_run_state.get(job_name, {})
    state["last_started_at"] = datetime.datetime.utcnow().isoformat()
    state["last_status"] = "running"
    state.setdefault("run_count", 0)
    state.setdefault("last_success_at", None)
    state.setdefault("last_error", None)
    job_run_state[job_name] = state

def _mark_job_finished(job_name: str, success: bool, error: str = None):
    state = job_run_state.get(job_name, {})
    state["last_finished_at"] = datetime.datetime.utcnow().isoformat()
    state["run_count"] = int(state.get("run_count", 0)) + 1
    if success:
        state["last_status"] = "success"
        state["last_success_at"] = state["last_finished_at"]
        state["last_error"] = None
    else:
        state["last_status"] = "failed"
        state["last_error"] = error
    job_run_state[job_name] = state

def refresh_market_cache():
    """Background job to refresh Redis cache for market data."""
    job_name = "refresh_market_cache"
    lock = ProcessFileLock(job_name)
    if not lock.acquire():
        logger.info("⏭️ Skipping refresh_market_cache (another process already running it).")
        return
    _mark_job_started(job_name)
    try:
        logger.info("Running scheduled market data refresh...")
        market_service.get_indices()
        market_service.get_top_movers()
        market_service.get_sector_performance()
        market_service.get_option_chain("^NSEI")
        market_service.get_option_chain("^NSEBANK")
        logger.info("Market data refresh complete.")
        _mark_job_finished(job_name, success=True)
    except Exception as e:
        logger.error(f"Error in background market refresh: {e}")
        _mark_job_finished(job_name, success=False, error=str(e))
    finally:
        lock.release()

def rolling_market_refresh():
    """Daily job to refresh the 7-day rolling market data files."""
    job_name = "rolling_market_refresh"
    lock = ProcessFileLock(job_name)
    if not lock.acquire():
        logger.info("⏭️ Skipping rolling_market_refresh (another process already running it).")
        return
    _mark_job_started(job_name)
    try:
        logger.info("🔄 Running daily 7-day rolling market data refresh...")
        from scripts.fetch_last_7_days import fetch_rolling_7days
        fetch_rolling_7days()
        logger.info("✅ Daily market data refresh complete.")
        _mark_job_finished(job_name, success=True)
    except Exception as e:
        logger.error(f"❌ Error in daily market data refresh: {e}")
        _mark_job_finished(job_name, success=False, error=str(e))
    finally:
        lock.release()

def _load_fundamental_symbols_query(limit: int) -> str:
    return f"""
    WITH ranked AS (
      SELECT DISTINCT UPPER(symbol) AS sym
      FROM instruments_master
      WHERE symbol IS NOT NULL
        AND symbol <> ''
        AND UPPER(COALESCE(instrument_type, '')) IN ('EQUITY', 'STOCK')
        AND UPPER(COALESCE(exchange, '')) IN ('NSE', 'BSE')
      LIMIT {max(limit, 1)}
    )
    SELECT sym FROM ranked
    """

def scheduled_fundamental_sync(limit: int = FUND_SYNC_SYMBOL_LIMIT, reason: str = "scheduled"):
    """Sync stock fundamentals and financials for NSE/BSE symbols."""
    job_name = f"scheduled_fundamental_sync:{reason}"
    lock = ProcessFileLock(job_name)
    if not lock.acquire():
        logger.info(f"⏭️ Skipping {job_name} (another process already running it).")
        return
    _mark_job_started(job_name)
    try:
        logger.info(f"📅 Running fundamentals sync ({reason}) for up to {limit} symbols...")
        from app.database import get_session
        from sqlalchemy import text
        from app.services.fundamental_fetcher import FundamentalFetcherService
        import asyncio

        async def run_sync():
            async with await get_session() as db:
                symbols = []
                try:
                    result = await db.execute(text(_load_fundamental_symbols_query(limit)))
                    symbols = [row[0] for row in result.all()]
                except Exception as query_err:
                    logger.warning(f"⚠️ instruments_master lookup failed: {query_err}")

                if not symbols:
                    try:
                        result = await db.execute(
                            text("SELECT DISTINCT UPPER(instrument) FROM index_metadata LIMIT :limit"),
                            {"limit": max(limit, 1)},
                        )
                        symbols = [row[0] for row in result.all() if row[0]]
                    except Exception as idx_err:
                        logger.warning(f"⚠️ index_metadata lookup failed: {idx_err}")

                if not symbols:
                    symbols = FUND_SYNC_FALLBACK_SYMBOLS

                if not symbols:
                    logger.warning("⚠️ No symbols found for fundamentals sync. Set FUND_SYNC_FALLBACK_SYMBOLS if needed.")
                    return

                await FundamentalFetcherService.sync_stock_data(db, symbols)
                logger.info(f"✅ Fundamentals sync completed for {len(symbols)} symbols.")

        # BackgroundScheduler runs in a separate thread, so we can use asyncio.run
        asyncio.run(run_sync())
        _mark_job_finished(job_name, success=True)
    except Exception as e:
        logger.error(f"❌ Error in fundamentals sync ({reason}): {e}")
        _mark_job_finished(job_name, success=False, error=str(e))
    finally:
        lock.release()

if RUN_BACKGROUND_JOBS:
    # Run market cache refresh during market days/hours for more real-time freshness.
    scheduler.add_job(
        refresh_market_cache,
        'cron',
        day_of_week='mon-fri',
        hour='9-15',
        minute=f'*/{max(MARKET_REFRESH_MINUTES, 1)}',
        timezone='Asia/Kolkata',
        id='refresh_market_cache',
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Rolling data refresh: Every day at 17:00 IST (5:00 PM)
    # This handles the daily fetch of today's data and pruning of the oldest day.
    scheduler.add_job(
        rolling_market_refresh,
        'cron',
        day_of_week='mon-fri',
        hour=17,
        minute=0,
        timezone='Asia/Kolkata',
        id='rolling_market_refresh',
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Daily post-market fundamentals sync.
    scheduler.add_job(
        scheduled_fundamental_sync,
        'cron',
        day_of_week='mon-fri',
        hour=FUND_SYNC_DAILY_HOUR,
        minute=FUND_SYNC_DAILY_MINUTE,
        timezone='Asia/Kolkata',
        kwargs={"limit": FUND_SYNC_SYMBOL_LIMIT, "reason": "daily_post_market"},
        id='scheduled_fundamental_sync_daily',
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Mid-day top-up sync for earnings season drift.
    scheduler.add_job(
        scheduled_fundamental_sync,
        'cron',
        day_of_week='mon-fri',
        hour=FUND_SYNC_EXTRA_HOUR,
        minute=FUND_SYNC_EXTRA_MINUTE,
        timezone='Asia/Kolkata',
        kwargs={"limit": max(25, FUND_SYNC_SYMBOL_LIMIT // 2), "reason": "midday_topup"},
        id='scheduled_fundamental_sync_midday',
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Weekly broader sync on Saturday.
    scheduler.add_job(
        scheduled_fundamental_sync,
        'cron',
        day_of_week='sat',
        hour=FUND_SYNC_WEEKLY_HOUR,
        minute=FUND_SYNC_WEEKLY_MINUTE,
        timezone='Asia/Kolkata',
        kwargs={"limit": max(300, FUND_SYNC_SYMBOL_LIMIT), "reason": "weekly_reconciliation"},
        id='scheduled_fundamental_sync_weekly',
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
else:
    logger.info("⏸️ Background jobs disabled via RUN_BACKGROUND_JOBS=false")

@app.on_event("startup")
async def startup_event():
    global async_scheduler
    await start_auth_side_effect_worker()
    REPLAY_START_SUCCESS_RATIO.set(1.0)
    app_env = (os.getenv("APP_ENV") or "development").strip().lower()
    if app_env == "beta":
        try:
            await connect_to_database()
            logger.info("✅ Beta startup database check passed.")
        except Exception as e:
            logger.critical(f"🛑 Beta startup: database unavailable: {e}. App will retry on first request.")
    async_scheduler_enabled = not (app_env == "test" and "RUN_ASYNC_SCHEDULER" not in os.environ)
    if async_scheduler is None and async_scheduler_enabled:
        try:
            async_scheduler = setup_scheduler()
        except Exception as e:
            logger.warning(f"⚠️ Async scheduler startup skipped: {e}")
    elif not async_scheduler_enabled:
        logger.info("⏭️ Async scheduler skipped for test runtime.")
    # Attempt to connect to Shoonya Live WS in the background
    if ENABLE_SHOONYA_BACKGROUND_CONNECT:
        if _has_shoonya_credentials():
            try:
                asyncio.create_task(shoonya_live.connect())
            except Exception as e:
                logger.warning(f"⚠️ Shoonya background connect skipped: {e}")
        else:
            logger.info("⏭️ Shoonya background connect skipped: credentials not configured.")
    else:
        logger.info("⏭️ Shoonya background connect disabled by environment.")
    
    # Seed community channels
    if ENABLE_COMMUNITY_SEED:
        if is_local_database_url():
            try:
                asyncio.create_task(seed_community_channels())
            except Exception as e:
                logger.warning(f"⚠️ Community seed skipped due to startup DB pressure: {e}")
        else:
            logger.info("⏭️ Skipping community seed during startup for remote DB deployments.")


@app.on_event("shutdown")
async def shutdown_event():
    global async_scheduler
    await stop_auth_side_effect_worker()
    try:
        if async_scheduler is not None:
            async_scheduler.shutdown(wait=False)
            async_scheduler = None
    except Exception:
        pass
    try:
        replay_executor.shutdown(wait=False, cancel_futures=True)
    except Exception:
        pass

async def seed_community_channels():
    """Ensure default community channels exist."""
    from app.database import get_session
    from app.models import CommunityChannel
    from sqlalchemy import select

    defaults = [
        {"name": "general", "description": "General discussion for everyone."},
        {"name": "news", "description": "Breaking market and macro news discussion."},
        {"name": "trading-strategies", "description": "Share setups, entries, and strategy ideas."},
        {"name": "module-discussion", "description": "Discuss course modules and learning content."},
        {"name": "market-insights", "description": "Market trends, sentiment, and observations."},
    ]

    async with await get_session() as db:
        result = await db.execute(select(CommunityChannel.name))
        existing = {name for (name,) in result.all()}
        missing = [channel for channel in defaults if channel["name"] not in existing]
        if missing:
            logger.info("🌱 Ensuring default community channels...")
            for ch_data in missing:
                db.add(CommunityChannel(**ch_data))
            await db.commit()
            logger.info("✅ Added %s missing default channels.", len(missing))

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"🔥 UNHANDLED EXCEPTION: {str(exc)}\n{traceback.format_exc()}"
    logger.error(error_msg)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error"},
    )


async def _resolve_ws_user_id(websocket: WebSocket) -> int | None:
    """
    Resolve authenticated user for websocket connections.
    Uses server-side cookies/headers only, never client-sent user_id payloads.
    """
    session_token = websocket.cookies.get("session_id")
    token = websocket.cookies.get("access_token")
    auth_header = websocket.headers.get("authorization")
    if (not token) and auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]

    try:
        db = await get_session()
        try:
            if session_token:
                cached_identity = get_cached_session_identity(session_token)
                if cached_identity:
                    return cached_identity.user_id
                result = await db.execute(
                    select(UserSession, User)
                    .join(User, User.id == UserSession.user_id)
                    .filter(UserSession.session_token == session_token)
                    .filter(UserSession.expires_at > datetime.datetime.utcnow())
                    .limit(1)
                )
                row = result.first()
                if row:
                    session, user = row
                    cache_session_identity(session.session_token, user.id, user.email, session.expires_at)
                    return session.user_id

            if token:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                email = payload.get("sub")
                if email:
                    result = await db.execute(select(User).filter(User.email == email))
                    user = result.scalars().first()
                    if user:
                        return user.id
        finally:
            await db.close()
    except Exception as e:
        logger.warning(f"WS auth resolution failed: {e}")

    return None

# --- 2. SECURITY (CORS) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/user/heartbeat")
async def user_heartbeat():
    """
    Lightweight endpoint to trigger 'last_active_at' updates via middleware.
    """
    return {"status": "alive", "timestamp": datetime.datetime.utcnow()}

@app.get("/api/admin/scheduler/status")
async def scheduler_status(_: None = Depends(admin_or_internal)):
    """
    Operational endpoint to verify scheduler health and recent job runs.
    """
    jobs = []
    try:
        for j in scheduler.get_jobs():
            jobs.append({
                "id": j.id,
                "name": j.name,
                "next_run_time": j.next_run_time.isoformat() if j.next_run_time else None,
                "trigger": str(j.trigger),
            })
    except Exception as e:
        logger.warning(f"⚠️ Unable to enumerate scheduler jobs: {e}")

    return {
        "scheduler_running": bool(getattr(scheduler, "running", False)),
        "timezone": "Asia/Kolkata",
        "jobs": jobs,
        "job_run_state": job_run_state,
        "checked_at": datetime.datetime.utcnow().isoformat(),
    }


@app.get("/api/admin/replay/status")
async def replay_status(_: None = Depends(admin_or_internal)):
    snapshot = replay_start_tracker.snapshot()
    return {
        "rolling_attempts": snapshot.attempts,
        "rolling_successes": snapshot.successes,
        "rolling_success_ratio": round(snapshot.success_ratio, 4),
        "success_threshold": REPLAY_START_SUCCESS_THRESHOLD,
        "launch_ready": snapshot.success_ratio >= REPLAY_START_SUCCESS_THRESHOLD,
        "checked_at": datetime.datetime.utcnow().isoformat(),
    }

@app.middleware("http")
async def runtime_hardening_middleware(request: Request, call_next):
    try:
        response = await asyncio.wait_for(call_next(request), timeout=HTTP_REQUEST_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.warning(f"⏱️ Request timeout: {request.method} {request.url.path}")
        return JSONResponse(status_code=504, content={"detail": "Request timed out"})

    if SECURE_HEADERS_ENABLED:
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        if HSTS_ENABLED and request.url.scheme == "https":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

    return response

@app.middleware("http")
async def log_user_activity(request: Request, call_next):
    """
    Middleware to track real-time user activity for the Admin Dashboard.
    Updates 'last_active_at' and logs to 'user_events' table.
    """
    try:
        # 1. Skip activity logging for static/docs/health
        if request.url.path.startswith(("/static", "/docs", "/openapi.json", "/favicon.ico", "/health", "/metrics", "/api/market/indices")):
            return await call_next(request)

        # 2. Extract user from cookie
        token = request.cookies.get("access_token")
        if not token:
            # Also check Authorization header as fallback
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if token:
            try:
                # Use pyjwt
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                email = payload.get("sub")
                
                if email and should_record_activity(
                    _activity_write_tracker,
                    email,
                    time.monotonic(),
                    ACTIVITY_WRITE_DEBOUNCE_SECONDS,
                ):
                    logger.info(f"📍 Logging activity for user: {email} on {request.url.path}")
                    # 3. Log activity in background to avoid blocking request
                    async def record_activity(user_email: str):
                        try:
                            async with await get_session() as db:
                                # Update User timestamp
                                await db.execute(
                                    update(User)
                                    .where(User.email == user_email)
                                    .values(last_active_at=text("CURRENT_TIMESTAMP"))
                                )
                                await db.commit()
                            
                            # Log discrete event - DISABLED as per user request to keep events for trades only
                            # async with await get_session() as db:
                            #     await db.execute(
                            #         insert(UserEvent).values(
                            #             user_id=select(User.id).where(User.email == user_email).scalar_subquery(),
                            #             event_name="page_view",
                            #             event_data={"path": path},
                            #             created_at=text("CURRENT_TIMESTAMP")
                            #         )
                            #     )
                            #     await db.commit()
                        except Exception as e:
                            logger.error(f"⚠️ Activity Log DB Error: {e}")

                    asyncio.create_task(record_activity(email))
            except jwt.ExpiredSignatureError:
                logger.warning("📍 Token expired in activity logging")
            except jwt.InvalidTokenError:
                logger.warning("📍 Invalid token in activity logging")
            except Exception as e:
                logger.error(f"📍 Auth error in activity logging: {e}")

        return await call_next(request)
    except Exception as e:
        logger.error(f"⚠️ Middleware Critical Error: {e}")
        return await call_next(request)

app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(history.router)
app.include_router(trading.router)
app.include_router(user.router)
app.include_router(news.router)
app.include_router(community.router)
app.include_router(learn.router)
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(admin.router)

# --- 3. INFRASTRUCTURE CONNECTIONS ---


# --- 3. INFRASTRUCTURE CONNECTIONS ---
# Database connection is now handled by app.database module (above)

# Redis Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/0")
REDIS_SOCKET_TIMEOUT_SECONDS = max(float(os.getenv("REDIS_SOCKET_TIMEOUT_SECONDS", "1.5")), 0.1)
REDIS_CONNECT_TIMEOUT_SECONDS = max(float(os.getenv("REDIS_CONNECT_TIMEOUT_SECONDS", "1.5")), 0.1)
REDIS_HEALTH_CHECK_INTERVAL_SECONDS = max(int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL_SECONDS", "30")), 5)
REDIS_CONFIGURED = "REDIS_URL" in os.environ or "REDIS_HOST" in os.environ

if _is_beta_runtime() and not REDIS_CONFIGURED:
    logger.warning("⚠️ Redis disabled in beta: REDIS_URL/REDIS_HOST not set explicitly.")
    redis_client = None
else:
    try:
        redis_client = Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_timeout=REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_connect_timeout=REDIS_CONNECT_TIMEOUT_SECONDS,
            health_check_interval=REDIS_HEALTH_CHECK_INTERVAL_SECONDS,
            retry_on_timeout=True,
        )
        redis_client.ping() # Verify connection
        logger.info(f"✅ Redis connected via {REDIS_URL}")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        redis_client = None

# --- 4. HELPER FUNCTION: Load Parquet by Symbol ---
def load_market_data_tiered(symbol: str, target_date: str = None, allow_fallback: bool = True):
    """
    Production-grade tiered data loader:
    1. Level 1 (Redis): Check for cached pre-processed data.
    2. Level 2 (MinIO): Primary storage. Fetch Parquet using metadata resolution.
    3. Level 3 (PostgreSQL): Fallback to market_candles table for the rolling backup.
    """
    base_symbol = symbol.split('-')[0] if '-' in symbol else symbol
    # Default to today if no date provided
    date_str = target_date if target_date else datetime.date.today().strftime('%Y-%m-%d')
    cache_key = f"market_data_v3:{base_symbol}:{date_str}"

    df = None
    source_info = "unknown"

    # --- LEVEL 1: REDIS CACHE ---
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                data = json.loads(cached)
                df = pd.DataFrame(data)
                source_info = f"cache:{cache_key}"
                # Fall through to post-processing to ensure datetime type conversion
        except Exception as e:
            logger.warning(f"⚠️ Redis read error: {e}")

    # --- LEVEL 2: LOCAL PARQUET STORAGE (Fallback before DB) ---
    if df is None:
        # Assuming parquet files are in backend/data/
        local_path = os.path.join(os.path.dirname(__file__), "data", f"{base_symbol}_{date_str}.parquet")
        if os.path.exists(local_path):
            try:
                df = pd.read_parquet(local_path)
                source_info = f"local:{local_path}"
                logger.info(f"📦 Fetching from local disk: {local_path}")
            except Exception as e:
                logger.warning(f"⚠️ Local Parquet Load Failed for {base_symbol}/{date_str}: {e}")

    # --- LEVEL 3: POSTGRESQL (Primary DB Fallback) ---
    if df is None:
        logger.info(f"🔄 Cache Miss. Attempting DB Fetch for {base_symbol} on {date_str}...")
        try:
            query = text("""
                SELECT timestamp, open, high, low, close, volume 
                FROM market_candles 
                WHERE symbol = :s AND DATE(timestamp) = :d
                ORDER BY timestamp ASC
            """)
            with ensure_sync_engine().connect() as conn:
                result = conn.execute(query, {"s": base_symbol, "d": date_str})
                rows = result.fetchall()
                if rows:
                    df = pd.DataFrame(rows, columns=['datetime', 'open', 'high', 'low', 'close', 'volume'])
                    source_info = "db_backup"
                    logger.info(f"✅ DB Fallback Success: {len(df)} candles found")
        except Exception as e:
            logger.error(f"❌ DB Fallback Error: {e}")

    # --- POST-PROCESSING & CACHING ---
    if df is not None and not df.empty:
        # Standardize columns
        df.columns = df.columns.str.lower()
        column_map = {
            'into': 'open', 'inth': 'high', 'intl': 'low', 'intc': 'close',
            'intv': 'volume', 'intoi': 'oi', 'v': 'volume', 'oi': 'oi', 'time': 'datetime'
        }
        df = df.rename(columns=column_map)
        
        # Ensure datetime type and fix potential Month/Day swaps from parquet auto-loaders
        if 'datetime' in df.columns:
            # Parse datetimes without corrupting ISO strings.
            # Root bug: dayfirst=True on "YYYY-MM-DD" can flip month/day.
            def aggressive_parse(ts):
                return parse_market_datetime(ts)

            df['datetime'] = df['datetime'].apply(aggressive_parse)
        
        # Cleanup numeric and missing
        for col in ['open', 'high', 'low', 'close']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        df = df.dropna(subset=['open', 'high', 'low', 'close'])
        df = df.sort_values('datetime')

        # Buffer into Redis for 24h
        if redis_client:
            try:
                # We store as JSON records
                redis_client.setex(cache_key, 86400, df.to_json(orient='records', date_format='iso'))
                logger.info(f"💾 Buffered to Redis: {cache_key}")
            except Exception as e:
                logger.warning(f"⚠️ Redis write failed: {e}")

        return df, source_info, base_symbol

    raise FileNotFoundError(f"Failed to load data for {symbol} on {date_str} from all available tiers.")

# Keep the old name as an alias for backward compatibility or just replace usage
load_parquet_for_symbol = load_market_data_tiered

def _search_instruments_sync(query: str) -> list[dict]:
    search_query = text("""
        SELECT token, symbol, name, instrument_type
        FROM instruments_master
        WHERE LOWER(symbol) LIKE LOWER(:query)
           OR LOWER(name) LIKE LOWER(:query)
        ORDER BY symbol
        LIMIT 10
    """)
    with ensure_sync_engine().connect() as conn:
        rows = conn.execute(search_query, {"query": f"%{query}%"}).fetchall()
    return [
        {
            "token": row[0],
            "symbol": row[1],
            "name": row[2] if len(row) > 2 else None,
            "instrument_type": row[3] if len(row) > 3 else None,
        }
        for row in rows
    ]


def _available_symbols_sync() -> list[dict]:
    query = text("SELECT DISTINCT instrument FROM index_metadata ORDER BY instrument")
    with ensure_sync_engine().connect() as conn:
        rows = conn.execute(query).fetchall()
    available_symbols = []
    for row in rows:
        symbol_part = row[0]
        if symbol_part == 'NIFTY':
            name = 'NIFTY 50'
        elif symbol_part == 'BANKNIFTY':
            name = 'BANKNIFTY'
        elif symbol_part == 'SENSEX':
            name = 'SENSEX'
        elif symbol_part == 'HDFCBANK':
            name = 'HDFC BANK'
        elif symbol_part == 'RELIANCE':
            name = 'RELIANCE'
        else:
            name = symbol_part.replace('_', ' ')

        available_symbols.append({
            "symbol": symbol_part,
            "token": "0",
            "name": name,
            "instrument_type": "INDEX" if symbol_part in ["NIFTY", "BANKNIFTY", "SENSEX"] else "EQUITY",
        })
    return available_symbols


def _available_dates_sync(base_symbol: str) -> list[str]:
    """
    Returns sorted list of dates (DESC) where data is available for a symbol.
    Strategy: 1) Scan local parquet files, 2) Fallback to index_metadata table.
    """
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    local_dates = []
    if os.path.isdir(data_dir):
        for fname in os.listdir(data_dir):
            if fname.endswith(".parquet") and fname.startswith(f"{base_symbol}_"):
                # Filename: HDFCBANK_2026-04-07.parquet → date = 2026-04-07
                date_part = fname.replace(f"{base_symbol}_", "").replace(".parquet", "")
                # Validate it's a proper date
                try:
                    pd.to_datetime(date_part)
                    local_dates.append(date_part)
                except Exception:
                    pass
    if local_dates:
        return sorted(local_dates, reverse=True)

    # Fallback to DB metadata only if no local files found
    try:
        engine = ensure_sync_engine()
        if engine.dialect.name == "sqlite":
            query = text("""
                SELECT strftime('%Y-%m-%d', start_date) as date_str
                FROM index_metadata
                WHERE instrument = :symbol
                ORDER BY start_date DESC
            """)
        else:
            query = text("""
                SELECT TO_CHAR(start_date, 'YYYY-MM-DD') as date_str
                FROM index_metadata
                WHERE instrument = :symbol
                ORDER BY start_date DESC
            """)
        with engine.connect() as conn:
            rows = conn.execute(query, {"symbol": base_symbol}).fetchall()
        return [row[0] for row in rows]
    except Exception as e:
        logger.warning(f"⚠️ DB dates lookup failed for {base_symbol}: {e}")
        return []



@app.get("/api/search")
async def search_instruments(query: str):
    """
    Search for instruments in the instruments_master table.
    
    Args:
        query (str): Search query string
        
    Returns:
        list: Top 10 matching instruments with symbol and token
    """
    if not query or len(query) < 1:
        return {"results": []}
    
    try:
        instruments = await _run_blocking(_search_instruments_sync, query)
        return {"results": instruments}
        
    except Exception as e:
        logger.error(f"❌ Search error: {e}")
        raise HTTPException(status_code=500, detail="Search failed")

@app.get("/api/available-symbols")
async def get_available_symbols():
    """
    Get list of symbols that have Parquet data files available (from Supabase Metadata).
    """
    try:
        available_symbols = await _run_blocking(_available_symbols_sync)
        return {"symbols": available_symbols}
    except Exception as e:
        logger.error(f"❌ Error getting available symbols from Supabase: {e}")
        raise HTTPException(status_code=500, detail="Failed to get symbols")

@app.get("/api/available-dates/{symbol}")
async def get_available_dates(symbol: str):
    """
    Get list of available dates for a specific symbol based on Supabase metadata.
    """
    try:
        # Extract the base symbol if it comes with a date suffix like RELIANCE-03-04
        base_symbol = symbol.split('-')[0] if '-' in symbol else symbol
        
        dates = await _run_blocking(_get_available_dates_cached, base_symbol)
        # logger.info(f"📅 Found {len(dates)} dates for {base_symbol} in metadata.")
        
        return {"symbol": symbol, "dates": dates}
    except Exception as e:
        logger.error(f"❌ Error getting available dates for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get dates")


@app.get("/api/historical/{symbol}")
async def get_historical_candles(
    symbol: str, 
    limit: int = 500, 
    date: str = None, 
    interval: str = "1min",
    lookback_days: int = 0
):
    """
    Return historical OHLC candles from MinIO storage with Redis caching.
    """
    # 1. Redis Cache Check
    cache_key = f"hist:v2:{symbol}:{date or 'latest'}:{interval}:{lookback_days}:{limit}"
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                logger.info(f"⚡ Redis Cache Hit: {cache_key}")
                return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"⚠️ Redis read error: {e}")

    # Map interval strings to pandas resample rules
    INTERVAL_MAP = {
        '1min': '1min', '3min': '3min', '5min': '5min',
        '15min': '15min', '30min': '30min', '1hr': '1h',
    }
    
    resample_rule = INTERVAL_MAP.get(interval)
    if resample_rule is None:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'.")

    try:
        base_symbol = symbol.split('-')[0] if '-' in symbol else symbol
        
        # 2. Resolve Target Dates (Using our new API logic)
        target_dates = []
        available_dates = await _run_blocking(_get_available_dates_cached, base_symbol)
        
        if lookback_days == -1:
            target_dates = available_dates
        elif date and lookback_days > 0:
            target_dt = pd.to_datetime(date).date()
            if date in available_dates:
                idx = available_dates.index(date)
                # Filter candidates that are within 10 days of target to avoid months-old gaps
                candidates = available_dates[idx+1:]
                preceding_trading_days = []
                for cand in candidates:
                    cand_dt = pd.to_datetime(cand).date()
                    # Only take days within a 10-day calendar window to find the most recent 2 trading days
                    if (target_dt - cand_dt).days <= 10:
                        preceding_trading_days.append(cand)
                        if len(preceding_trading_days) >= lookback_days:
                            break
                target_dates = [date] + preceding_trading_days
            else:
                target_dates = [date]
        elif date:
            target_dates = [date]
        
        # 3. Fetch Data from Storage
        all_dfs = []
        loaded_files = set()
        
        if not target_dates and not date:
            # Fallback to most recent data
            df, fpath, _ = await _run_blocking(load_market_data_tiered, base_symbol, None, True)
            all_dfs.append(df)
            loaded_files.add(fpath)
        else:
            for d in reversed(target_dates): # Oldest first
                try:
                    df, fpath, _ = await _run_blocking(load_market_data_tiered, base_symbol, d, True)
                    all_dfs.append(df)
                    loaded_files.add(fpath)
                except:
                    continue
            
            # If lookback_days was -1, also try to add the base file (the most recent data)
            if lookback_days == -1:
                try:
                    df_base, fpath, _ = await _run_blocking(load_market_data_tiered, base_symbol, None, True)
                    # Check if this df_base has new data not in all_dfs
                    if fpath not in loaded_files:
                        all_dfs.append(df_base)
                        loaded_files.add(fpath)
                except: pass

        if not all_dfs:
            return {"symbol": symbol, "candles": [], "interval": interval}
            
        combined_df = pd.concat(all_dfs)
        time_col = 'datetime'
        
        # Ensure it's sorted
        combined_df = combined_df.sort_values(time_col)

        # 4. Resample
        if interval != '1min':
            combined_df = combined_df.set_index(time_col)
            combined_df = combined_df.resample(resample_rule).agg({
                'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'
            }).dropna(subset=['open'])
            combined_df = combined_df.reset_index()
            time_col = combined_df.columns[0]

        # 5. Format to JSON
        final_limit = 50000 if lookback_days == -1 else limit
        combined_df = combined_df.tail(final_limit)

        candles = []
        for _, row in combined_df.iterrows():
            # Force naive to be treated as UTC to match the browser's view
            # This fixes the "gap" and the 5:30 hour shift between history and ticker
            ts_val = row[time_col]
            if isinstance(ts_val, str):
                ts_val = parse_market_datetime(ts_val)
            
            if ts_val.tzinfo is None:
                ts_val = ts_val.tz_localize('UTC')
            ts = int(ts_val.timestamp())

            candles.append({
                "time": ts,
                "open":  float(row["open"]),
                "high":  float(row["high"]),
                "low":   float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row.get("volume", 0)),
            })

        response_data = {"symbol": symbol, "candles": candles, "interval": interval}
        
        # 6. Save to Redis Cache (TTL: 24 Hours)
        if redis_client:
            try:
                redis_client.setex(cache_key, 86400, json.dumps(response_data))
                logger.info(f"✅ Redis Cache Set: {cache_key}")
            except Exception as e:
                logger.warning(f"⚠️ Redis write error: {e}")

        return response_data

    except Exception as e:
        logger.error(f"❌ Error fetching historical data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch historical data")

# --- 7. STOCK RESEARCH HUB ENDPOINTS ---
from app.fundamental_service import FundamentalService
from app.screener_service import ScreenerService
from app.nlp_engine import (
    analyze_stock_fundamentals, 
    explain_in_layman, 
    chat_about_stock,
    analyze_news_impact,
    generate_news_explainer,
    ask_news_question
)
from app.market_clock_news import get_replay_news_schedule, DEFAULT_DELAY_SECONDS, DEFAULT_POLICY
from app.trade_engine import TradeEngine
from pydantic import BaseModel

class StockChatRequest(BaseModel):
    question: str
    history: list = []


class TradeGuideRequest(BaseModel):
    message: str
    session_id: str | None = None


class TradeGuideFeedbackRequest(BaseModel):
    session_id: str
    rating: str
    feedback: str | None = None


CHATBOT_SERVICE_URL = os.getenv("CHATBOT_SERVICE_URL", "http://chatbot:8001")
CHATBOT_API_KEY = os.getenv("CHATBOT_API_KEY", "tradeshift-local-key")


def _chatbot_base_urls() -> list[str]:
    configured = [u.strip().rstrip("/") for u in CHATBOT_SERVICE_URL.split(",") if u.strip()]
    fallbacks = [
        "http://chatbot:8001",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://host.docker.internal:8001",
    ]
    seen = set()
    ordered = []
    for base in configured + fallbacks:
        if base not in seen:
            seen.add(base)
            ordered.append(base)
    return ordered


def _local_trading_guide_fallback(query: str) -> str:
    q = (query or "").lower()
    if "macd" in q:
        return (
            "MACD compares a fast and slow moving average to show momentum shifts. "
            "When MACD crosses above the signal line, momentum is improving; below it, momentum is weakening."
        )
    if "rsi" in q:
        return (
            "RSI measures how stretched price is on a 0-100 scale. "
            "Above 70 can indicate overbought conditions, below 30 can indicate oversold conditions."
        )
    if "replay" in q:
        return (
            "Replay mode lets you simulate trades candle-by-candle on historical sessions. "
            "Choose a symbol/date, start replay, and practice entries, exits, and risk control."
        )
    if "screener" in q or "multibagger" in q:
        return (
            "Use Screener to shortlist quality stocks by ROCE, growth, and valuation. "
            "Then open Research Hub to get AI thesis, layman explanation, and Q&A."
        )
    if "scalping" in q:
        return (
            "Scalping is a short-term strategy where traders take many quick trades to capture small price movements. "
            "It demands tight stop-loss discipline, lower fees/slippage, and fast execution."
        )
    return (
        "TradeGuide is running in fallback mode right now. I can still help with platform navigation, "
        "replay workflow, indicators, and research interpretation."
    )


async def _chatbot_proxy(
    method: str,
    path: str,
    payload: dict | None = None,
    timeout_seconds: float = 10.0,
) -> dict | None:
    timeout = aiohttp.ClientTimeout(
        total=timeout_seconds,
        connect=min(2.0, max(0.8, timeout_seconds * 0.25)),
        sock_read=max(4.0, timeout_seconds * 0.7),
    )
    headers = {"x-api-key": CHATBOT_API_KEY}
    for base in _chatbot_base_urls():
        url = f"{base}{path}"
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                if method.upper() == "GET":
                    async with session.get(url, headers=headers) as resp:
                        if resp.status == 200:
                            return await resp.json()
                        logger.warning("Chatbot proxy non-200 GET %s -> %s (url=%s)", path, resp.status, base)
                        continue
                async with session.post(url, json=payload or {}, headers=headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    logger.warning("Chatbot proxy non-200 POST %s -> %s (url=%s)", path, resp.status, base)
                    continue
        except Exception as exc:
            logger.warning("Chatbot proxy request failed for %s %s (url=%s): %s", method, path, base, exc)
            continue
    return None

@app.get("/api/screener/multibagger")
async def get_multibagger_screener(db: AsyncSession = Depends(get_optional_db)):
    """
    Returns a list of potential multi-bagger stocks based on fundamental screeners.
    """
    try:
        candidates = await ScreenerService.get_multibagger_candidates(db)
        return {"candidates": candidates}
    except Exception as e:
        logger.error(f"❌ Screener Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch screener")

@app.get("/api/stock/{symbol}/profile")
async def get_stock_profile(symbol: str, db: AsyncSession = Depends(get_optional_db)):
    """
    Returns fundamental metrics and yearly financials for a stock.
    """
    try:
        profile = await FundamentalService.get_stock_profile(db, symbol.upper())
        return profile
    except Exception as e:
        logger.error(f"Error fetching profile for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock profile")

@app.post("/api/stock/{symbol}/analyze")
async def get_stock_analysis(symbol: str, db: AsyncSession = Depends(get_optional_db)):
    """
    Triggers FinGPT deep professional analysis.
    """
    try:
        profile = await FundamentalService.get_stock_profile(db, symbol.upper())
        # We pass the fundamentals part of the profile to the AI
        analysis = await analyze_stock_fundamentals(symbol.upper(), profile["fundamentals"])
        return {"symbol": symbol, "analysis": analysis}
    except Exception as e:
        logger.error(f"Error analyzing stock {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze stock")

@app.post("/api/stock/{symbol}/explain")
async def get_layman_explanation(symbol: str, request: Request):
    """
    Converts professional analysis into Layman Mode.
    """
    try:
        data = await request.json()
        complex_info = data.get("text", "")
        if not complex_info:
            raise HTTPException(status_code=400, detail="Missing text to explain")
            
        explanation = await explain_in_layman(symbol.upper(), complex_info)
        return {"symbol": symbol, "explanation": explanation}
    except Exception as e:
        logger.error(f"Error generating layman explanation for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate explanation")

@app.post("/api/stock/{symbol}/chat")
async def chat_about_stock_endpoint(symbol: str, request: StockChatRequest, db: AsyncSession = Depends(get_optional_db)):
    """
    Interactive chat for users to ask questions about a stock's fundamentals.
    """
    try:
        profile = await FundamentalService.get_stock_profile(db, symbol.upper())
        answer = await chat_about_stock(symbol.upper(), profile["fundamentals"], request.question, request.history)
        return {"symbol": symbol, "answer": answer}
    except Exception as e:
        logger.error(f"Error chatting about stock {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process stock chat")


@app.post("/api/chat")
async def chat_endpoint_proxy(req: TradeGuideRequest):
    """
    Deployment-safe TradeGuide endpoint.
    Proxies to chatbot service when reachable; otherwise serves deterministic fallback.
    """
    proxied = await _chatbot_proxy("POST", "/api/chat", payload=req.model_dump(), timeout_seconds=24.0)
    if proxied:
        return proxied

    session_id = req.session_id or str(uuid.uuid4())
    text = _local_trading_guide_fallback(req.message)
    suggestions = ["Explain MACD", "How to use Replay mode?", "How to read ROCE and PE together?"]
    topic = (req.message or "").lower()
    if "indicator" in topic or "macd" in topic or "rsi" in topic:
        suggestions = ["How is RSI different from MACD?", "When does MACD fail?", "How to avoid false signals?"]
    elif "screener" in topic:
        suggestions = ["What defines a multibagger?", "How to analyze debt-to-equity quickly?", "How to validate growth quality?"]

    return {
        "session_id": session_id,
        "response": text,
        "actions": [],
        "sources": [],
        "suggested_questions": suggestions,
        "model": "fallback-local",
    }


@app.get("/api/chat/health")
async def chat_health_proxy():
    proxied = await _chatbot_proxy("GET", "/api/chat/health", timeout_seconds=5.0)
    if proxied:
        return proxied
    return {"status": "ok", "service": "chatbot-fallback", "model": "fallback-local"}


@app.get("/api/chat/suggestions/{topic}")
async def chat_suggestions_proxy(topic: str):
    proxied = await _chatbot_proxy("GET", f"/api/chat/suggestions/{topic}", timeout_seconds=5.0)
    if proxied:
        return proxied
    topic_l = topic.lower()
    if topic_l == "indicators":
        return {"suggestions": ["Explain MACD", "What is RSI?", "How to draw Fibonacci retracements?"]}
    if topic_l == "screener":
        return {"suggestions": ["What defines a Multibagger stock?", "How do you calculate ROCE?"]}
    return {"suggestions": ["How do I use replay mode?", "How to read risk/reward before entry?"]}


@app.post("/api/chat/feedback")
async def chat_feedback_proxy(req: TradeGuideFeedbackRequest):
    proxied = await _chatbot_proxy("POST", "/api/chat/feedback", payload=req.model_dump(), timeout_seconds=6.0)
    if proxied:
        return proxied
    return {"status": "accepted"}

# --- Market Data Endpoints ---
from app.market_service import market_service

@app.get("/api/market/indices")
async def get_market_indices():
    """Fetch live data for major indices via yfinance and Redis cache."""
    try:
        return market_service.get_indices()
    except Exception as e:
        logger.error(f"Error fetching indices: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch market indices")

@app.get("/api/market/gainers")
async def get_market_gainers():
    try:
        data = market_service.get_top_movers()
        return data.get("gainers", [])
    except Exception as e:
        logger.error(f"Error fetching gainers: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch market gainers")

@app.get("/api/market/losers")
async def get_market_losers():
    try:
        data = market_service.get_top_movers()
        return data.get("losers", [])
    except Exception as e:
        logger.error(f"Error fetching losers: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch market losers")

@app.get("/api/market/most-active")
async def get_market_active():
    try:
        data = market_service.get_top_movers()
        return data.get("active", [])
    except Exception as e:
        logger.error(f"Error fetching most active: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch most active stocks")

@app.get("/api/market/sectors")
async def get_market_sectors():
    try:
        return market_service.get_sector_performance()
    except Exception as e:
        logger.error(f"Error fetching sectors: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch sectors")

@app.get("/api/market/options/{symbol}")
async def get_market_options(symbol: str):
    try:
        # Default symbols mapping like NIFTY -> ^NSEI
        sym_map = {
            "NIFTY": "^NSEI",
            "BANKNIFTY": "^NSEBANK"
        }
        yf_symbol = sym_map.get(symbol.upper(), symbol)
        result = market_service.get_option_chain(yf_symbol)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching options for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch options chain")

# --- 6. WEBSOCKET ENDPOINTS ---

# --- Order Updates WebSocket ---
@app.websocket("/ws/orders")
async def orders_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for receiving order_update events.
    Clients authenticate by sending their user_id on connect.
    Events are pushed to user rooms (user-{user_id}).
    """
    await websocket.accept()
    user_id = await _resolve_ws_user_id(websocket)
    if not user_id:
        await websocket.close(code=1008)
        return
    try:
        # Register with the connection manager.
        room = f"user-{user_id}"
        if room not in order_manager.active_connections:
            order_manager.active_connections[room] = []
        if websocket not in order_manager.active_connections[room]:
            order_manager.active_connections[room].append(websocket)
        
        logger.info(f"🟢 Orders WS: user-{user_id} connected")
        await _safe_ws_send(websocket, {"type": "connected", "data": {"room": room}})
        
        # Keep the connection alive and handle incoming chat messages
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                if payload.get("type") == "send_message":
                    from app.services.community_service import process_and_broadcast_message
                    msg_data = payload.get("data", {})
                    await process_and_broadcast_message(
                        sender_id=user_id,
                        content=msg_data.get("content"),
                        channel_id=msg_data.get("channel_id"),
                        recipient_id=msg_data.get("recipient_id"),
                        client_temp_id=msg_data.get("client_temp_id")
                    )
            except Exception as e:
                logger.error(f"Error processing WS message: {e}")
    except WebSocketDisconnect:
        logger.info(f"🔴 Orders WS: user-{user_id} disconnected")
    except Exception as e:
        logger.error(f"Orders WS error: {e}")
    finally:
        order_manager.disconnect(websocket, user_id)

@app.websocket("/ws/live_indices")
async def live_indices_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("🟢 Live Indices Client Connected")
    
    # Send latest cached data immediately
    if shoonya_live.latest_data:
        try:
            await _safe_ws_send(websocket, shoonya_live.latest_data)
        except Exception:
            pass

    # Callback to push updates to this specific client (from Shoonya Live WS)
    async def push_update(data):
        try:
            # Send the entire dictionary so the frontend gets all indices at once
            await _safe_ws_send(websocket, shoonya_live.latest_data)
        except Exception as e:
            logger.error(f"🔴 Live Indices Send Error: {e}")
            raise e # Trigger disconnect handling

    shoonya_live.add_callback(push_update)
    
    # Fallback Mechanism: If Shoonya is not connected, periodically send data from market_service (yfinance)
    async def fallback_loop():
        while True:
            try:
                if not shoonya_live.connected:
                    # logger.info("Shoonya disconnected, sending fallback indices from yfinance")
                    indices = await _run_blocking(market_service.get_indices)
                    # Convert list to dict format expected by frontend
                    payload = {idx["name"]: idx for idx in indices}
                    if payload:
                        # Update shoonya_live.latest_data so new connections get it immediately
                        shoonya_live.latest_data.update(payload)
                        await _safe_ws_send(websocket, payload)
                await asyncio.sleep(15) # Refresh every 15 seconds in fallback mode
            except Exception as e:
                logger.warning(f"⚠️ Live Indices Fallback Error: {e}")
                break

    fallback_task = asyncio.create_task(fallback_loop())
    
    try:
        while True:
            # Just keep connection alive, optionally handle basic ping/pong
            msg = await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("🔴 Live Indices Client Disconnected")
    except Exception as e:
        logger.error(f"🔴 Live Indices Error: {e}")
    finally:
        shoonya_live.remove_callback(push_update)
        fallback_task.cancel()



@app.websocket("/ws/ticker")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    current_user_id = await _resolve_ws_user_id(websocket)
    if not current_user_id:
        await websocket.close(code=1008)
        return

    try:
        await asyncio.wait_for(replay_session_semaphore.acquire(), timeout=0.05)
    except asyncio.TimeoutError:
        await _safe_ws_send(websocket, {"type": "ERROR", "message": "Replay server busy. Please retry shortly."})
        await websocket.close(code=1013)
        return
    logger.info(f"🟢 Client Connected (user-{current_user_id})")

    # State
    is_running       = False
    speed            = 1.0
    synthesizer      = TickSynthesizer()
    # Authenticated user id for this replay socket session.
    last_tick_price  = 21500.0
    
    # NEW: Multiple symbols support
    main_iterators   = {}    # { "RELIANCE": iterator, "HDFCBANK": iterator }
    main_current_rows = {}   # { "RELIANCE": last_loaded_row }
    main_symbols     = []    # List of active symbols being streamed
    primary_symbol   = None  # The main symbol for OMS price updates
    
    indices_iterators = {}    # { "NIFTY": iterator, "BANKNIFTY": iterator }
    indices_opens    = {}      # { "NIFTY": open_price, "BANKNIFTY": open_price }
    main_symbol_opens = {}     # { "RELIANCE": day_open, ... }
    active_news      = []
    active_impact_observers = [] # Track news for 15-minute impact assessment
    news_delay_seconds = DEFAULT_DELAY_SECONDS
    news_replay_policy = DEFAULT_POLICY
    news_loader_task = None
    replay_session_nonce = 0
    tick_time        = datetime.datetime.now()
    last_tick_price  = 0.0

    try:
        while True:
            # ── A. Check for incoming commands (non-blocking) ──────────────
            try:
                data    = await asyncio.wait_for(websocket.receive_text(), timeout=0.001)
                message = json.loads(data)
                command = message.get("command")

                if command == "START":
                    # Register this WebSocket with the global order_manager to receive trade fill notifications
                    room = f"user-{current_user_id}"
                    if room not in order_manager.active_connections:
                        order_manager.active_connections[room] = []
                    if websocket not in order_manager.active_connections[room]:
                        order_manager.active_connections[room].append(websocket)
                    logger.info(f"🔗 WebSocket Registered to Room: {room} (Simulation Mode)")

                    symbols_req = message.get("symbols") or []
                    single_symbol = message.get("symbol")
                    if single_symbol and single_symbol not in symbols_req:
                        symbols_req.append(single_symbol)
                    
                    if not symbols_req:
                        symbols_req = ["NIFTY"]
                    
                    target_date = message.get("date")
                    start_time_req = message.get("startTime") # e.g. "2026-04-02T10:00:00.000Z"
                    requested_start_speed = float(message.get("speed", 1.0))
                    speed = max(1.0, min(requested_start_speed, 20.0))
                    news_delay_minutes = int(message.get("news_delay_minutes", 45))
                    news_delay_seconds = max(0, news_delay_minutes * 60)
                    news_replay_policy = str(message.get("news_replay_policy", DEFAULT_POLICY))
                    REPLAY_START_ATTEMPTS.inc()
                    
                    main_symbols = symbols_req
                    primary_symbol = symbols_req[0]
                    if not target_date:
                        available_dates = await _run_blocking(_get_available_dates_cached, primary_symbol.split("-")[0])
                        if available_dates:
                            target_date = str(available_dates[0])
                    if not target_date:
                        ratio = _record_replay_start_result(False)
                        logger.error("Replay START missing target_date and no fallback metadata found. Rolling success ratio %.2f%%", ratio * 100.0)
                        await _safe_ws_send(websocket, {"type": "ERROR", "message": f"No replay dates available for {primary_symbol}"})
                        continue
                    main_iterators = {}
                    main_current_rows = {}
                    main_symbol_opens = {}

                    # Determine exact start limit for simulation and backfill
                    # Default: start of the target day (hour=0, minute=0)
                    # We use start of day instead of 09:15 since Parquet data might be in UTC format (03:45 open)
                    start_dt_limit = pd.to_datetime(target_date).replace(hour=0, minute=0).tz_localize(None)
                    if start_time_req:
                        try:
                            # 📍 Normalizing all incoming to naive (no TZ) to match Parquet data
                            # This fixes the "skipping/jumping" bug during Pause/Resume
                            req_ts = pd.to_datetime(start_time_req).tz_localize(None)
                            
                            # Only use if it's on the target date
                            if req_ts.date() == pd.to_datetime(target_date).date():
                                start_dt_limit = max(start_dt_limit, req_ts)
                                logger.info(f"📍 Resuming from (NAIVE): {start_dt_limit}")
                        except Exception as te:
                            logger.warning(f"⚠️ StartTime Parse Error: {te}")


                    success_count = 0
                    bootstrap_payloads: dict[str, ReplayBootstrapPayload] = {}
                    for symbol in symbols_req:
                        try:
                            payload = await _run_blocking(_build_replay_bootstrap_sync, symbol, target_date)
                            bootstrap_payloads[symbol] = payload
                            records = payload.candles
                            filtered_records = [
                                row for row in records
                                if _to_naive_timestamp(row["datetime"]) >= start_dt_limit
                            ]
                            if filtered_records:
                                main_iterators[symbol] = iter(filtered_records)
                                main_symbol_opens[symbol] = payload.session_open
                                success_count += 1
                                logger.info(
                                    "✅ Replay bootstrap ready for %s with %s candles from cache-aware loader",
                                    symbol,
                                    len(filtered_records),
                                )
                        except Exception as e:
                            logger.error(f"⚠️ Failed to load {symbol}: {e}")

                    if success_count == 0:
                        ratio = _record_replay_start_result(False)
                        logger.error("Replay START failed before SPEED_ACK. Rolling success ratio now %.2f%%", ratio * 100.0)
                        await _safe_ws_send(websocket, {"type": "ERROR", "message": f"No data found for any requested symbols on {target_date}"})
                        continue

                    try:
                        primary_payload = bootstrap_payloads.get(primary_symbol)
                        if primary_payload:
                            backfill_candles = [
                                candle for candle in primary_payload.backfill
                                if candle["time"] < int(start_dt_limit.tz_localize("UTC").timestamp())
                            ]
                            if backfill_candles:
                                logger.info("📚 Sending %s cached backfill candles for %s", len(backfill_candles), primary_symbol)
                                await _safe_ws_send(websocket, {"type": "BACKFILL", "data": {"symbol": primary_symbol, "candles": backfill_candles}})
                    except Exception as be:
                        logger.error(f"⚠️ Backfill error: {be}")
                    
                    indices_iterators = {}
                    indices_opens = {}
                    primary_payload = bootstrap_payloads.get(primary_symbol)
                    if primary_payload:
                        for idx_name, candles in primary_payload.index_candles.items():
                            indices_iterators[idx_name] = iter(candles)
                        indices_opens = dict(primary_payload.index_opens)

                    is_running = True
                    logger.info(f"▶️  Simulation Started | Symbols: {list(main_iterators.keys())} | Speed: {speed}x")
                    try:
                        await _safe_ws_send(websocket, {"type": "SPEED_ACK", "data": {"speed": speed}})
                        ratio = _record_replay_start_result(True)
                        logger.info("✅ Replay SPEED_ACK sent. Rolling success ratio %.2f%%", ratio * 100.0)
                    except Exception:
                        ratio = _record_replay_start_result(False)
                        logger.error("Replay SPEED_ACK failed to send. Rolling success ratio %.2f%%", ratio * 100.0)
                        continue

                    replay_session_nonce += 1
                    session_nonce = replay_session_nonce
                    active_news = []
                    if news_loader_task and not news_loader_task.done():
                        news_loader_task.cancel()

                    async def hydrate_replay_news(
                        expected_nonce: int,
                        symbol: str,
                        replay_date: str,
                        delay_seconds: int,
                        replay_policy: str,
                    ):
                        try:
                            raw_news = await get_replay_news_schedule(
                                symbol,
                                replay_date,
                                delay_seconds=delay_seconds,
                                replay_policy=replay_policy,
                            )
                            if expected_nonce != replay_session_nonce:
                                return
                            prepared_news = []
                            for n in raw_news:
                                n["triggered"] = False
                                prepared_news.append(n)
                            active_news.clear()
                            active_news.extend(prepared_news)
                            logger.info(
                                f"✅ Replay news ready: {len(active_news)} events for "
                                f"{replay_date} (delay={delay_seconds}s, policy={replay_policy})"
                            )
                        except asyncio.CancelledError:
                            pass
                        except Exception as e:
                            logger.error(f"⚠️ Failed to prepare news for simulation on {replay_date}: {e}")
                            if expected_nonce == replay_session_nonce:
                                active_news.clear()

                    news_loader_task = asyncio.create_task(
                        hydrate_replay_news(
                            session_nonce,
                            primary_symbol,
                            target_date,
                            news_delay_seconds,
                            news_replay_policy,
                        )
                    )

                elif command == "BUY":
                    from app.schemas import TradeExecuteRequest, TradeDirection, OrderType
                    request = TradeExecuteRequest(
                        symbol=message.get("symbol", primary_symbol),
                        direction=TradeDirection.BUY,
                        quantity=message.get("quantity", 50),
                        price=last_tick_price,
                        order_type=OrderType.MARKET,
                        session_type="REPLAY",
                        simulated_time=tick_time # current simulated time
                    )
                    from app.database import get_session
                    db = await get_session()
                    try:
                        result = await TradeEngine.execute_trade(request, current_user_id, db)
                        # Emit WebSocket update to refresh UI
                        res_trade = await db.execute(select(app.models.TradeLog).filter(app.models.TradeLog.id == result["trade_id"]))
                        trade = res_trade.scalars().first()
                        if trade:
                            ws_payload = TradeEngine.build_order_update_payload(trade)
                            await order_manager.emit_to_user(current_user_id, "order_update", ws_payload)
                    finally:
                        await db.close()

                elif command == "SELL":
                    # oms.sell(last_tick_price, qty=50)
                    from app.schemas import TradeExecuteRequest, TradeDirection, OrderType
                    request = TradeExecuteRequest(
                        symbol=message.get("symbol", primary_symbol),
                        direction=TradeDirection.SELL,
                        quantity=message.get("quantity", 50),
                        price=last_tick_price,
                        order_type=OrderType.MARKET,
                        session_type="REPLAY",
                        simulated_time=tick_time # current simulated time
                    )
                    from app.database import get_session
                    db = await get_session()
                    try:
                        result = await TradeEngine.execute_trade(request, current_user_id, db)
                        # Emit WebSocket update to refresh UI
                        res_trade = await db.execute(select(app.models.TradeLog).filter(app.models.TradeLog.id == result["trade_id"]))
                        trade = res_trade.scalars().first()
                        if trade:
                            ws_payload = TradeEngine.build_order_update_payload(trade)
                            await order_manager.emit_to_user(current_user_id, "order_update", ws_payload)
                    finally:
                        await db.close()

                elif command == "STOP":
                    is_running = False
                    logger.info("⏹️ Simulation Stopped by client")

                elif command == "NEWS_QUESTION":
                    q_text = message.get("question")
                    news_id = message.get("news_id")
                    if 'active_news' in locals():
                        target_news = next(
                            (
                                n for idx, n in enumerate(active_news)
                                if n.get("event_id") == news_id or idx == news_id
                            ),
                            None
                        )
                        if target_news:
                            async def fetch_answer(nq, ni, sym, nid):
                                ans = await ask_news_question(ni["title"], ni["description"], nq, sym)
                                await _safe_ws_send(websocket, {
                                    "type": "NEWS_ANSWER",
                                    "data": {
                                        "id": nid,
                                        "question": nq,
                                        "answer": ans
                                    }
                                })
                            asyncio.create_task(fetch_answer(q_text, target_news, primary_symbol, news_id))

                elif command == "SPEED":
                    requested_speed = float(message.get("speed", speed or 1.0))
                    speed = max(1.0, min(requested_speed, 20.0))
                    logger.info(f"⏩ Speed dynamically updated to {speed}x")

            except asyncio.TimeoutError:
                pass  # No command — continue streaming
            await asyncio.sleep(0)

            # ── B. Stream data (only when running) ────────────────────────
            if not is_running:
                await asyncio.sleep(0.05)
                continue

            # Advance all main symbol iterators for this minute
            main_current_rows = {}
            for sym in list(main_iterators.keys()):
                try:
                    main_current_rows[sym] = next(main_iterators[sym])
                except StopIteration:
                    del main_iterators[sym]
            
            if not main_iterators and not main_current_rows:
                logger.info("🏁 End of data for all symbols — stopping.")
                await _safe_ws_send(websocket, {"type": "END", "message": "Data finished for all symbols"})
                is_running = False
                continue

            # Pick a base time from the first available symbol row
            ref_row = next(iter(main_current_rows.values()))
            try:
                date_val = (
                    ref_row.get('datetime') or
                    ref_row.get('date')     or
                    ref_row.get('time')     or
                    datetime.datetime.now()
                )
                base_time = parse_market_datetime(date_val) if not isinstance(date_val, datetime.datetime) else date_val
                # CRITICAL: Ensure base_time is naive for comparison with news timestamps
                if hasattr(base_time, "tzinfo") and base_time.tzinfo is not None:
                    base_time = base_time.replace(tzinfo=None)
            except Exception as e:
                logger.error(f"❌ Ref row parse error: {e}")
                continue

            # Generate ticks for ALL main symbols
            all_symbol_ticks = {}
            try:
                all_symbol_ticks = await _run_blocking(_build_ticks_for_rows, synthesizer, main_current_rows, 60)
            except Exception as e:
                logger.error(f"⚠️ Main ticks generation failed, using candle close fallback: {e}")
                for sym, row in main_current_rows.items():
                    all_symbol_ticks[sym] = [float(row.get('close', 0))] * 60

            # Advance and generate ticks for indices
            indices_rows = {}
            for idx_name, idx_iter in list(indices_iterators.items()):
                try:
                    indices_rows[idx_name] = next(idx_iter)
                except StopIteration:
                    del indices_iterators[idx_name]
                except Exception as e:
                    logger.error(f"⚠️ Index Error ({idx_name}): {e}")
            try:
                indices_ticks = await _run_blocking(_build_ticks_for_rows, synthesizer, indices_rows, 60) if indices_rows else {}
            except Exception as e:
                logger.error(f"⚠️ Index ticks generation failed: {e}")
                indices_ticks = {
                    idx_name: [float(row.get('close', 0))] * 60 for idx_name, row in indices_rows.items()
                }

            # Stream each tick (second by second)
            try:
                last_tick_sent_at = time.time()
                index_labels = {"NIFTY": "NIFTY 50", "BANKNIFTY": "BANKNIFTY", "SENSEX": "SENSEX"}
                indices_last_state = {}
                for i in range(60):
                    tick_time = base_time + datetime.timedelta(seconds=i)
                    
                    # 1. Update Price for OMS (Primary Symbol only for now)
                    if primary_symbol in all_symbol_ticks:
                        current_price = all_symbol_ticks[primary_symbol][i]
                        last_tick_price = current_price
                        from app.services.order_management import oms_service
                        oms_service.queue_price_update(
                            primary_symbol,
                            current_price,
                            simulated_time=tick_time,
                            session_type="REPLAY",
                            user_id=current_user_id,
                        )

                    # 2. Push Ticks for ALL MAIN symbols
                    for sym, ticks in all_symbol_ticks.items():
                        if i < len(ticks):
                            # Primary symbol is streamed via high-frequency interpolated ticks below.
                            # Skip duplicate base ticks except for the final second where interpolation is unavailable.
                            if sym == primary_symbol and i + 1 < len(all_symbol_ticks.get(primary_symbol, [])):
                                continue
                            try:
                                await _safe_ws_send(websocket, {
                                    "type": "TICK",
                                    "data": {
                                        "symbol": sym,
                                        "price": round(float(ticks[i]), 2),
                                        "timestamp": tick_time.isoformat() + "Z", # Force UTC suffix
                                        "volume": int(main_current_rows[sym].get('volume', 0)),

                                    }
                                })
                            except Exception: break

                    # 3. Push INDICES_TICK (sync)
                    indices_payload = {}
                    def safe_float(v):
                        try:
                            if pd.isna(v) or np.isnan(v) or np.isinf(v): return 0.0
                            return float(v)
                        except: return 0.0

                    for idx_name in ["NIFTY", "BANKNIFTY", "SENSEX"]:
                        display_name = index_labels.get(idx_name, idx_name)
                        ticks_arr = indices_ticks.get(idx_name)

                        if ticks_arr and i < len(ticks_arr):
                            curr_idx_price = safe_float(ticks_arr[i])
                            if curr_idx_price <= 0 and idx_name in indices_last_state:
                                indices_payload[display_name] = indices_last_state[idx_name]
                                continue

                            day_open = safe_float(indices_opens.get(idx_name, curr_idx_price))
                            if day_open == 0:
                                day_open = curr_idx_price

                            change = curr_idx_price - day_open
                            change_percent = (change / day_open) * 100 if day_open > 0 else 0
                            state = {
                                "name": display_name,
                                "price": round(curr_idx_price, 2),
                                "change": round(safe_float(change), 2),
                                "change_percent": round(safe_float(change_percent), 2),
                                "is_positive": change >= 0
                            }
                            indices_last_state[idx_name] = state
                            indices_payload[display_name] = state
                        elif idx_name in indices_last_state:
                            # Keep complete snapshot stable even if one stream briefly pauses.
                            indices_payload[display_name] = indices_last_state[idx_name]
                    
                    # NEW: Add Primary Symbol to top ticker if it's not already an index
                    if primary_symbol and primary_symbol in all_symbol_ticks:
                        curr_p = float(all_symbol_ticks[primary_symbol][i])
                        day_open_main = safe_float(main_symbol_opens.get(primary_symbol, curr_p))
                        if day_open_main == 0:
                            day_open_main = curr_p
                        main_change = curr_p - day_open_main
                        main_change_percent = (main_change / day_open_main) * 100 if day_open_main > 0 else 0
                        indices_payload[primary_symbol] = {
                            "name": primary_symbol,
                            "price": round(curr_p, 2),
                            "change": round(safe_float(main_change), 2),
                            "change_percent": round(safe_float(main_change_percent), 2),
                            "is_positive": main_change >= 0
                        }
                    
                    if indices_payload:
                        try:
                            await _safe_ws_send(websocket, { "type": "INDICES_TICK", "data": indices_payload })
                            if i % 15 == 0:
                                await _safe_ws_send(websocket, { "type": "STATS", "data": { "tick": i, "speed": speed } })
                        except Exception: pass

                    # ─── Smooth Sub-Tick Brownian Bridge Simulation ───
                    # Low speeds should feel closer to a live tape: softer easing, steadier pacing,
                    # and realistic micro-moves without the chart looking mechanically linear.
                    if speed <= 1:
                        sub_steps = 12
                    elif speed <= 2:
                        sub_steps = 10
                    elif speed <= 5:
                        sub_steps = 8
                    elif speed >= 20:
                        sub_steps = 8
                    elif speed >= 10:
                        sub_steps = 12
                    else:
                        sub_steps = 10
                    base_price_for_noise = max(abs(last_tick_price), 1.0)
                    vol_scale = base_price_for_noise * (0.00003 if speed <= 5 else 0.00005)
                    
                    # Generate raw Brownian components
                    raw_walk = [random.gauss(0, vol_scale) for _ in range(sub_steps)]
                    # Cumulative sum to get Brownian Motion
                    bm = []
                    curr_sum = 0
                    for r in raw_walk:
                        curr_sum += r
                        bm.append(curr_sum)
                    bm_final = bm[-1]
                    # Convert to Bridge (so it ends exactly at 0 to match historical data)
                    bridge_noise = [bm[s] - ((s + 1) / sub_steps) * bm_final for s in range(sub_steps)]

                    target_candle_seconds = 60.0 / max(speed, 0.1)  # 20x => 3s per candle
                    target_substep_delay = target_candle_seconds / (60.0 * sub_steps)
                    subloop_start = time.perf_counter()
                    for step in range(sub_steps):
                        # Command Check (Inner - run in each sub-step)
                        trigger_next = False
                        command_poll_stride = 1 if speed <= 5 else (2 if speed <= 10 else 4)
                        if step % command_poll_stride == 0:
                            try:
                                inner_data = await asyncio.wait_for(websocket.receive_text(), timeout=0.0001)
                                inner_msg = json.loads(inner_data)
                                inner_cmd = inner_msg.get("command")
                                if inner_cmd == "SPEED":
                                    speed = max(1.0, min(float(inner_msg.get("speed", 1.0)), 20.0))
                                elif inner_cmd == "STOP":
                                    is_running = False
                                    break
                                elif inner_cmd == "STEP":
                                    trigger_next = True
                            except asyncio.TimeoutError:
                                pass
                            except WebSocketDisconnect:
                                is_running = False
                                break
                            except Exception:
                                pass

                        if not is_running: break
                        if trigger_next: break 

                        # Interpolation factor (0.1 to 1.0)
                        factor = (step + 1) / sub_steps
                        
                        if not is_running: break
                        
                        # --- BROADCAST INTERPOLATED TICKS ---
                        # For Primary Symbol, we can interpolate if there's a next tick
                        if primary_symbol and primary_symbol in all_symbol_ticks and i + 1 < len(all_symbol_ticks[primary_symbol]):
                            curr_val = float(all_symbol_ticks[primary_symbol][i])
                            next_val = float(all_symbol_ticks[primary_symbol][i+1])
                            candle_row = main_current_rows.get(primary_symbol, {})
                            candle_span = max(
                                abs(float(candle_row.get('high', curr_val)) - float(candle_row.get('low', curr_val))),
                                abs(next_val - curr_val),
                                max(abs(curr_val), 1.0) * 0.0002,
                            )
                            noise_ratio = 0.18 if speed <= 1 else (0.14 if speed <= 2 else (0.10 if speed <= 5 else 0.05))
                            vol_scale = candle_span * noise_ratio / max(sub_steps, 1)
                            
                            eased_factor = factor
                            if speed <= 5:
                                eased_factor = factor * factor * (3 - 2 * factor)

                            # Linear path
                            linear_price = curr_val + (next_val - curr_val) * eased_factor
                            # Add Brownian noise
                            interp_price = linear_price + bridge_noise[step]
                            sub_tick_time = tick_time + datetime.timedelta(seconds=((step + 1) / sub_steps))

                            
                            try:
                                # Send TICK
                                await _safe_ws_send(websocket, {
                                    "type": "TICK",
                                    "data": {
                                        "symbol": primary_symbol,
                                        "price": round(interp_price, 2),
                                        "timestamp": sub_tick_time.isoformat() + "Z", # Force UTC suffix
                                        "volume": int(main_current_rows[primary_symbol].get('volume', 0)),

                                    }
                                })
                                
                                # --- SYNC WITH PORTFOLIO/OMS ENGINE ---
                                # This ensures /api/portfolio/positions sees the simulated price as the LTP
                                shoonya_live.update_symbol_price(primary_symbol, interp_price, sub_tick_time)
                                last_tick_price = interp_price
                            except Exception: break

                        # --- NEW: Synchronized News Injection (Second-Precision) ---
                        if not (primary_symbol and primary_symbol in all_symbol_ticks and i + 1 < len(all_symbol_ticks[primary_symbol])):
                            sub_tick_time = tick_time + datetime.timedelta(seconds=((step + 1) / sub_steps))
                        for idx, n_item in enumerate(list(active_news)):
                            if not isinstance(n_item, dict): continue
                            n_timestamp = n_item.get("timestamp")
                            if not n_timestamp: continue
                            
                            if not n_item.get("triggered") and sub_tick_time >= n_timestamp:
                                active_news[idx]["triggered"] = True
                                logger.info(f"📰 FLASHING NEWS: {n_item['title']} at simulated time {sub_tick_time.strftime('%H:%M:%S')}")
                                event_id = n_item.get("event_id", idx)
                                
                                # Ensure time_str matches the EXACT trigger time for visual sync
                                display_time = sub_tick_time.strftime("%H:%M:%S")

                                _schedule_ws_send(websocket, {
                                    "type": "NEWS_FLASH",
                                    "data": {
                                        "id": event_id,
                                        "symbol": primary_symbol,
                                        "title": n_item["title"],
                                        "description": n_item["description"],
                                        "time_str": display_time,
                                        "source": n_item["source"],
                                        "url": n_item["url"],
                                        "publish_time_ist": n_item.get("publish_time_ist"),
                                        "flash_time_ist": n_item.get("flash_time_ist"),
                                        "delay_seconds": n_item.get("delay_seconds"),
                                        "source_reliability": n_item.get("source_reliability"),
                                        "is_simulated": n_item.get("is_simulated", False)
                                    }
                                })
                                
                                async def perform_analysis(item, item_idx, sym):
                                    try:
                                        async with replay_ai_semaphore:
                                            impact_task = analyze_news_impact(item["title"], item["description"], sym)
                                            explainer_task = generate_news_explainer(item["title"], item["description"], sym)
                                            impact_res, explainer_res = await asyncio.gather(impact_task, explainer_task)
                                        await _safe_ws_send(websocket, {
                                            "type": "NEWS_ANALYSIS",
                                            "data": {
                                                "id": item_idx,
                                                "analysis": impact_res["analysis"],
                                                "sentiment": impact_res["sentiment"],
                                                "predicted_impact": impact_res.get("predicted_impact", "Unknown")
                                            }
                                        })
                                        await _safe_ws_send(websocket, {
                                            "type": "NEWS_EXPLAINER",
                                            "data": { "id": item_idx, "explainer": explainer_res }
                                        })
                                    except Exception as ex:
                                        logger.error(f"⚠️ Error in News AI: {ex}")
                                        
                                asyncio.create_task(perform_analysis(n_item, event_id, primary_symbol))

                                active_impact_observers.append({
                                    "news_id": event_id,
                                    "baseline_price": interp_price,
                                    "target_time": sub_tick_time + datetime.timedelta(minutes=15)
                                })
                        
                        # --- PROCESS IMPACT OBSERVERS ---
                        for obs in list(active_impact_observers):
                            if sub_tick_time >= obs["target_time"] and primary_symbol in all_symbol_ticks:
                                # Use current interpolated price for impact calc
                                pct_change = ((interp_price - obs["baseline_price"]) / obs["baseline_price"]) * 100 if obs["baseline_price"] > 0 else 0
                                _schedule_ws_send(websocket, {
                                    "type": "NEWS_IMPACT_RESULT",
                                    "data": {
                                        "id": obs["news_id"],
                                        "actual_impact": f"{pct_change:+.2f}% in 15m",
                                        "price_start": obs["baseline_price"],
                                        "price_end": interp_price
                                    }
                                })
                                active_impact_observers.remove(obs)

                        # ── Precise Speed Scaling (1 second per tick / speed) ──
                        expected_next = subloop_start + ((step + 1) * target_substep_delay)
                        sleep_for = expected_next - time.perf_counter()
                        if sleep_for > 0:
                            await asyncio.sleep(sleep_for)
                    
                    if not is_running: break
                    if i % 5 == 0:
                        await asyncio.sleep(0)
                    last_tick_sent_at = time.time()
                
                if not is_running:
                    break

            except Exception as e:
                logger.error(f"❌ CRITICAL error in ticker loop: {e}")
                import traceback
                traceback.print_exc()
                await asyncio.sleep(1.0) # Prevent tight loop on error

            # Send CANDLE for ALL symbols at end of each minute
            for sym, row in main_current_rows.items():
                try:
                    await _safe_ws_send(websocket, {
                        "type": "CANDLE",
                        "data": {
                            "open":   float(row.get('open', 0)),
                            "high":   float(row.get('high', 0)),
                            "low":    float(row.get('low', 0)),
                            "close":   float(row.get('close', 0)),
                            "volume": int(row.get('volume', 0)),
                            "timestamp": base_time.isoformat() + "Z",

                            "symbol": sym,
                        }
                    })
                except Exception: break

    finally:
        # Cleanup: Unregister from order_manager and stop simulation
        if 'current_user_id' in locals():
            try:
                order_manager.disconnect(websocket, current_user_id)
            except Exception: pass
        replay_session_semaphore.release()
        logger.info("🔴 Simulation Client Disconnected")


if __name__ == "__main__":
    dev_reload = os.getenv("UVICORN_RELOAD", "false").lower() in ("1", "true", "yes", "on")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=dev_reload)
