# File: backend/main.py

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from sqlalchemy import create_engine, text
import pandas as pd
from minio import Minio
import io
import os
import json
import asyncio
import datetime
import time
import glob
from redis import Redis
from prometheus_fastapi_instrumentator import Instrumentator
from app.oms import OrderManager
from app import auth
from app.routers import inngest, portfolio, history, trading, news
from app.websocket_manager import order_manager
from app.models import User
from app.database import get_db
from app.news_service import fetch_news_for_date
from app.nlp_engine import analyze_news_impact, ask_news_question, generate_news_explainer
from app.database import Base, connect_to_database, connect_to_database_sync, get_db_sync

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- DB INITIALIZATION ---
# Connect and Create Tables using the cached connection pattern
try:
    engine_sync = connect_to_database_sync()
    Base.metadata.create_all(bind=engine_sync)
    print("✅ Database Tables Created/Verified")
except Exception as e:
    print(f"❌ Database Initialization Failed: {e}")


# --- 1. ROBUST IMPORT FOR SIMULATION ---
try:
    from app.simulation import TickSynthesizer
    print("✅ Brownian Bridge Engine Loaded")
except ImportError:
    print("⚠️ Warning: simulation.py not found. Using Mock Fallback.")
    class TickSynthesizer:
        def generate_ticks(self, o, h, l, c, num_ticks=60):
            return [o] * num_ticks

app = FastAPI()

# Instrumentator (Monitoring)
Instrumentator().instrument(app).expose(app)

# Global Exception Handler for debugging 500s
from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

from apscheduler.schedulers.background import BackgroundScheduler
from app.market_service import market_service
from app.live_market import shoonya_live

# --- BACKGROUND JOBS ---
scheduler = BackgroundScheduler()

def refresh_market_cache():
    """Background job to refresh Redis cache for market data."""
    try:
        logger.info("Running scheduled market data refresh...")
        market_service.get_indices()
        market_service.get_top_movers()
        market_service.get_sector_performance()
        market_service.get_option_chain("^NSEI")
        market_service.get_option_chain("^NSEBANK")
        logger.info("Market data refresh complete.")
    except Exception as e:
        logger.error(f"Error in background market refresh: {e}")

# Run every 15 minutes
scheduler.add_job(refresh_market_cache, 'interval', minutes=15)
scheduler.start()

@app.on_event("startup")
async def startup_event():
    # Attempt to connect to Shoonya Live WS in the background
    asyncio.create_task(shoonya_live.connect())

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"🔥 UNHANDLED EXCEPTION: {str(exc)}\n{traceback.format_exc()}"
    print(error_msg)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
    )

# --- 2. SECURITY (CORS) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://0.0.0.0:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(inngest.router)
app.include_router(portfolio.router)
app.include_router(history.router)
from app.routers import inngest, portfolio, history, trading, user
# ...
app.include_router(trading.router)
app.include_router(user.router)
app.include_router(news.router)

# --- 3. INFRASTRUCTURE CONNECTIONS ---


# --- 3. INFRASTRUCTURE CONNECTIONS ---
# Database connection is now handled by app.database module (above)

try:
    minio_client = Minio("minio:9000", "minioadmin", "minioadmin", secure=False)
except Exception:
    pass

try:
    redis_client = Redis(host=os.getenv("REDIS_HOST", "redis"), port=6379, decode_responses=True)
except Exception:
    print("⚠️ Redis not connected")

# --- 4. HELPER FUNCTION: Load Parquet by Symbol ---
def load_parquet_for_symbol(symbol: str, target_date: str = None, allow_fallback: bool = False):
    """
    Load data for a specific symbol. from the data/ directory.
    
    Args:
        symbol (str): Symbol name (e.g., 'NIFTY', 'BANKNIFTY', 'NIFTY_50')
        target_date (str): Optional date string (e.g., '2026-03-02') to load specific date file.
        allow_fallback (bool): If True, and no specific target_date file is found,
                               it will try to load the most recent file for the symbol.
        
    Returns:
        tuple: (DataFrame, file_path, symbol_name)
        
    Raises:
        FileNotFoundError: If no matching Parquet file is found
    """
    # Use absolute path to ensure robustness
    base_path = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_path, "data")
    
    matching_files = []
    # Try exact match first for date format: NIFTY_2026-03-02.parquet
    if target_date:
        pattern_date = os.path.join(data_dir, f"{symbol}_{target_date}.parquet")
        date_match = glob.glob(pattern_date)
        if date_match:
            matching_files.extend(date_match)

    # Search for files matching the pattern (if no date or date file not found)
    if not matching_files and allow_fallback:
        pattern = os.path.join(data_dir, f"{symbol}_*.parquet")
        matching_files = glob.glob(pattern)
        print(f"🔄 Fallback triggered. Searching for {pattern}... found {len(matching_files)} files.")
        
        # Try exact match (e.g., NIFTY_50_1min.parquet for symbol "NIFTY_50")
        pattern_exact = os.path.join(data_dir, f"{symbol}.parquet")
        exact_match = glob.glob(pattern_exact)
        if exact_match:
            matching_files.extend(exact_match)
    
    if not matching_files:
        raise FileNotFoundError(f"No Parquet file found for symbol '{symbol}' (date: {target_date}) in {data_dir} directory")
    
    # Sort files to get the most recent (if multiple exist)
    # Files are typically named: SYMBOL_YEAR.parquet or SYMBOL_suffix.parquet
    matching_files.sort(reverse=True)
    selected_file = matching_files[0]
    
    print(f"📂 Loading file: {selected_file}")
    
    # Load the Parquet file
    df = pd.read_parquet(selected_file)
    df.columns = df.columns.str.lower()
    
    # --- HANDLING SHOONYA API DATA FORMAT ---
    # Map columns: into->open, inth->high, intl->low, intc->close
    # Note: Handle duplicates - prefer 'intv' over 'v', 'intoi' over 'oi'
    column_map = {
        'into': 'open',
        'inth': 'high',
        'intl': 'low',
        'intc': 'close',
        'intv': 'volume',
        'intoi': 'oi'
    }
    
    # Drop the duplicate columns BEFORE renaming
    if 'v' in df.columns and 'intv' in df.columns:
        df = df.drop(columns=['v'])
    elif 'v' in df.columns:
        column_map['v'] = 'volume'
        
    if 'oi' in df.columns and 'intoi' in df.columns:
        df = df.drop(columns=['oi']) # Shoonya sometimes has both 'oi' and 'intoi'
    elif 'oi' in df.columns:
        column_map['oi'] = 'oi'  # Keep as is
    
    df = df.rename(columns=column_map)
    
    # Clean and parse timestamp
    if 'time' in df.columns:
        # Shoonya sometimes prefixes with "Ok " (e.g., "Ok 2026-02-13 12:12:00")
        df['time'] = df['time'].astype(str).str.replace('Ok ', '', regex=False).str.strip()
        
        # Try multiple formats
        for fmt in ['%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%m/%d/%Y %H:%M:%S']:
            try:
                df['datetime'] = pd.to_datetime(df['time'], format=fmt, errors='coerce')
                if not df['datetime'].isnull().all():
                    break
            except:
                continue
        
        # Fallback for ISO format
        if 'datetime' not in df.columns or df['datetime'].isnull().all():
            df['datetime'] = pd.to_datetime(df['time'], errors='coerce')
    
    # FORCE NUMERIC TYPES for OHLC (DO THIS BEFORE CHECKING FOR REQUIRED COLUMNS)
    # This fixes the "ufunc 'add' did not contain a loop..." error
    numeric_cols = ['open', 'high', 'low', 'close']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
    # Drop rows with NaNs in critical columns
    df = df.dropna(subset=[c for c in numeric_cols if c in df.columns] + (['datetime'] if 'datetime' in df.columns else []))
    
    # Sort by datetime (if datetime exists)
    if 'datetime' in df.columns:
        df = df.sort_values('datetime')
    
    # Ensure required columns exist
    required_cols = ['open', 'high', 'low', 'close', 'datetime']
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        print(f"⚠️ Warning: Missing columns in {selected_file}: {missing}")
    
    print(f"✅ Loaded {len(df)} rows. Columns: {list(df.columns)}")

    # Extract the actual symbol name from the filename for display
    # e.g., "data/NIFTY_2026.parquet" -> "NIFTY"
    # or "data/NIFTY_50_1min.parquet" -> "NIFTY_50"
    base_name = os.path.basename(selected_file).replace('.parquet', '')
    
    return df, selected_file, symbol

# --- 5. REST API ENDPOINTS ---

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
        # Query the database with LIKE search (case-insensitive)
        search_query = text("""
            SELECT token, symbol, name, instrument_type
            FROM instruments_master
            WHERE LOWER(symbol) LIKE LOWER(:query)
               OR LOWER(name) LIKE LOWER(:query)
            ORDER BY symbol
            LIMIT 10
        """)
        
        with engine_sync.connect() as conn:
            result = conn.execute(search_query, {"query": f"%{query}%"})
            rows = result.fetchall()
            
        # Format results
        instruments = [
            {
                "token": row[0],
                "symbol": row[1],
                "name": row[2] if len(row) > 2 else None,
                "instrument_type": row[3] if len(row) > 3 else None
            }
            for row in rows
        ]
        
        return {"results": instruments}
        
    except Exception as e:
        print(f"❌ Search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/api/available-symbols")
async def get_available_symbols():
    """
    Get list of symbols that have Parquet data files available.
    """
    print("🔍 API: /api/available-symbols called")
    try:
        base_path = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.join(base_path, "data")
        parquet_files = glob.glob(os.path.join(data_dir, "*.parquet"))
        
        available_symbols = []
        seen_symbols = set()
        for f in parquet_files:
            basename = os.path.basename(f)
            symbol_part = basename.split('_')[0]
            if basename.startswith('NIFTY_50'): symbol_part = 'NIFTY_50'
            elif basename.startswith('NIFTY_BANK'): symbol_part = 'BANKNIFTY'
            elif basename.startswith('HDFCBANK'): symbol_part = 'HDFCBANK'
            elif basename.startswith('BANKNIFTY'): symbol_part = 'BANKNIFTY'
            
            if symbol_part not in seen_symbols:
                available_symbols.append({
                    "symbol": symbol_part,
                    "token": "0",  # Default token
                    "name": symbol_part.replace('_', ' '),
                    "instrument_type": "INDEX" if "NIFTY" in symbol_part or "BANK" in symbol_part else "EQUITY"
                })
                seen_symbols.add(symbol_part)
        
        return {"symbols": sorted(available_symbols, key=lambda x: x["symbol"])}
    except Exception as e:
        print(f"❌ Error getting available symbols: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get symbols: {str(e)}")

@app.get("/api/available-dates/{symbol}")
async def get_available_dates(symbol: str):
    """
    Get list of available dates for a specific symbol based on its parquet files.
    """
    try:
        import re
        # Extract the base symbol if it comes with a date suffix like RELIANCE-03-04
        base_symbol = symbol.split('-')[0] if '-' in symbol else symbol
        
        base_path = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.join(base_path, "data")
        pattern = os.path.join(data_dir, f"{base_symbol}_*.parquet")
        files = glob.glob(pattern)
        
        # Also try exact match for the symbol itself (without _date)
        exact_match = os.path.join(data_dir, f"{base_symbol}.parquet")
        if os.path.exists(exact_match):
            files.append(exact_match)
            
        print(f"📅 Finding dates for {base_symbol} in {data_dir}... found {len(files)} files.")
        
        dates = []
        for f in files:
            # Extract date matching YYYY-MM-DD from the filename
            match = re.search(r"(\d{4}-\d{2}-\d{2})", f)
            if match:
                dates.append(match.group(1))
                
        # Sort dates in reverse chronological order (newest first)
        dates.sort(reverse=True)
        
        return {"symbol": symbol, "dates": dates}
    except Exception as e:
        print(f"❌ Error getting available dates for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get dates: {str(e)}")


@app.get("/api/historical/{symbol}")
async def get_historical_candles(symbol: str, limit: int = 500, date: str = None):
    """
    Return historical OHLC candles for a given symbol from its Parquet file.
     Optionally filtered by a specific YYYY-MM-DD date.

    Args:
        symbol: Symbol name (e.g. 'NIFTY', 'BANKNIFTY')
        limit:  Max candles to return (default 500, most recent)

    Returns:
        JSON list of {time, open, high, low, close} objects
    """
    try:
        base_symbol = symbol.split('-')[0] if '-' in symbol else symbol
        df, _, _ = load_parquet_for_symbol(base_symbol, date, allow_fallback=True)

        # Resolve the datetime column
        time_col = next((c for c in ['datetime', 'date', 'time'] if c in df.columns), None)
        if time_col is None:
            raise HTTPException(status_code=422, detail="No datetime column found in data")

        # Only parse if it's not already datetime type
        if not pd.api.types.is_datetime64_any_dtype(df[time_col]):
            df[time_col] = pd.to_datetime(
                df[time_col].astype(str).str.replace('Ok ', '', regex=False).str.strip(), 
                dayfirst=False, errors='coerce'
            )
        
        df = df.dropna(subset=[time_col])
        df = df.sort_values(time_col)

        # Filter to the selected date if provided
        if date:
            target_dt = pd.to_datetime(date).date()
            filtered_df = df[df[time_col].dt.date == target_dt]
            
            # If date filter returns data, use it. 
            # Otherwise, if we allow fallback, use the whole file (most recent data)
            if not filtered_df.empty:
                df = filtered_df
            else:
                print(f"⚠️ No data found for {symbol} on {date}. Using most recent data instead.")

        # Take the most recent `limit` candles
        df = df.tail(limit)

        candles = []
        for _, row in df.iterrows():
            ts = int(row[time_col].timestamp())
            candles.append({
                "time": ts,
                "open":  float(row["open"]),
                "high":  float(row["high"]),
                "low":   float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row.get("volume", 0)) if "volume" in row.index else 0,
            })

        return {"symbol": symbol, "candles": candles}

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching historical data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")

# --- 7. STOCK RESEARCH HUB ENDPOINTS ---
from app.fundamental_service import FundamentalService
from app.screener_service import ScreenerService
from app.nlp_engine import analyze_stock_fundamentals, explain_in_layman, chat_about_stock
from pydantic import BaseModel

class StockChatRequest(BaseModel):
    question: str
    history: list = []

@app.get("/api/screener/multibagger")
def get_multibagger_screener(db=Depends(get_db_sync)):
    """
    Returns a list of potential multi-bagger stocks based on fundamental screeners.
    """
    try:
        candidates = ScreenerService.get_multibagger_candidates(db)
        return {"candidates": candidates}
    except Exception as e:
        logger.error(f"❌ Screener Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{symbol}/profile")
def get_stock_profile(symbol: str, db=Depends(get_db_sync)):
    """
    Returns fundamental metrics and yearly financials for a stock.
    """
    try:
        profile = FundamentalService.get_stock_profile(db, symbol.upper())
        return profile
    except Exception as e:
        logger.error(f"Error fetching profile for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/stock/{symbol}/analyze")
async def get_stock_analysis(symbol: str, db=Depends(get_db_sync)):
    """
    Triggers FinGPT deep professional analysis.
    """
    try:
        profile = FundamentalService.get_stock_profile(db, symbol.upper())
        # We pass the fundamentals part of the profile to the AI
        analysis = await analyze_stock_fundamentals(symbol.upper(), profile["fundamentals"])
        return {"symbol": symbol, "analysis": analysis}
    except Exception as e:
        logger.error(f"Error analyzing stock {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/stock/{symbol}/chat")
async def chat_about_stock_endpoint(symbol: str, request: StockChatRequest, db=Depends(get_db_sync)):
    """
    Interactive chat for users to ask questions about a stock's fundamentals.
    """
    try:
        profile = FundamentalService.get_stock_profile(db, symbol.upper())
        answer = await chat_about_stock(symbol.upper(), profile["fundamentals"], request.question, request.history)
        return {"symbol": symbol, "answer": answer}
    except Exception as e:
        logger.error(f"Error chatting about stock {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    # Accept connection first, then wait for auth message
    await websocket.accept()
    user_id = None
    try:
        # Expect an auth message with user_id
        auth_data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        user_id = auth_data.get("user_id", 1)
        
        # Re-register with the connection manager (re-accept not needed)
        room = f"user-{user_id}"
        if room not in order_manager.active_connections:
            order_manager.active_connections[room] = []
        order_manager.active_connections[room].append(websocket)
        
        logger.info(f"🟢 Orders WS: user-{user_id} connected")
        await websocket.send_json({"type": "connected", "data": {"room": room}})
        
        # Keep the connection alive
        while True:
            msg = await websocket.receive_text()
    except asyncio.TimeoutError:
        logger.warning("Orders WS: auth timeout")
    except WebSocketDisconnect:
        logger.info(f"🔴 Orders WS: user-{user_id} disconnected")
    except Exception as e:
        logger.error(f"Orders WS error: {e}")
    finally:
        if user_id is not None:
            order_manager.disconnect(websocket, user_id)

@app.websocket("/ws/live_indices")
async def live_indices_websocket(websocket: WebSocket):
    await websocket.accept()
    print("🟢 Live Indices Client Connected")
    
    # Send latest cached data immediately
    if shoonya_live.latest_data:
        try:
            await websocket.send_json(shoonya_live.latest_data)
        except Exception:
            pass

    # Callback to push updates to this specific client
    async def push_update(data):
        try:
            # Send the entire dictionary so the frontend gets all indices at once
            await websocket.send_json(shoonya_live.latest_data)
        except Exception as e:
            print(f"🔴 Live Indices Send Error: {e}")
            raise e # Trigger disconnect handling

    shoonya_live.add_callback(push_update)
    
    try:
        while True:
            # Just keep connection alive, optionally handle basic ping/pong
            msg = await websocket.receive_text()
    except WebSocketDisconnect:
        print("🔴 Live Indices Client Disconnected")
    except Exception as e:
        print(f"🔴 Live Indices Error: {e}")
    finally:
        shoonya_live.remove_callback(push_update)


@app.websocket("/ws/ticker")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("🟢 Client Connected", flush=True)

    # State
    is_running       = False
    speed            = 1.0
    synthesizer      = TickSynthesizer()
    current_user_id  = 1
    last_tick_price  = 21500.0
    
    # NEW: Multiple symbols support
    main_iterators   = {}    # { "RELIANCE": iterator, "HDFCBANK": iterator }
    main_current_rows = {}   # { "RELIANCE": last_loaded_row }
    main_symbols     = []    # List of active symbols being streamed
    primary_symbol   = None  # The main symbol for OMS price updates
    
    indices_iterators = {}    # { "NIFTY": iterator, "BANKNIFTY": iterator }
    indices_opens    = {}      # { "NIFTY": open_price, "BANKNIFTY": open_price }
    active_news      = []
    active_impact_observers = [] # Track news for 15-minute impact assessment
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
                    current_user_id = message.get("user_id") or 1
                    symbols_req = message.get("symbols") or []
                    single_symbol = message.get("symbol")
                    if single_symbol and single_symbol not in symbols_req:
                        symbols_req.append(single_symbol)
                    
                    if not symbols_req:
                        symbols_req = ["NIFTY"]
                    
                    target_date = message.get("date")
                    speed       = float(message.get("speed", 1.0))
                    
                    main_symbols = symbols_req
                    primary_symbol = symbols_req[0]
                    main_iterators = {}
                    main_current_rows = {}

                    # Load data for each requested symbol
                    success_count = 0
                    for symbol in symbols_req:
                        try:
                            # Extract base symbol if it has suffix (e.g. NIFTY-2026 -> NIFTY)
                            base_symbol = symbol.split('-')[0] if '-' in symbol else symbol
                            df_sym, file_path, _ = load_parquet_for_symbol(base_symbol, target_date, allow_fallback=True)
                            
                            # Find date column
                            date_col = next((c for c in ['datetime', 'date', 'time'] if c in df_sym.columns), None)
                            if not date_col: continue

                            # Standardize dates
                            temp_df = df_sym.copy()
                            if not pd.api.types.is_datetime64_any_dtype(temp_df[date_col]):
                                temp_df[date_col] = pd.to_datetime(
                                    temp_df[date_col].astype(str).str.replace('Ok ', '', regex=False).str.strip(), 
                                    dayfirst=False, errors='coerce'
                                )

                            if not target_date:
                                first_date = temp_df[date_col].dropna().min().date()
                                target_date = str(first_date)

                            target_dt = pd.to_datetime(target_date).date()
                            mask = (
                                (temp_df[date_col].dt.date == target_dt) &
                                (temp_df[date_col].dt.time >= datetime.time(9, 15)) &
                                (temp_df[date_col].dt.time <= datetime.time(15, 30))
                            )
                            f_df = temp_df[mask].sort_values(by=date_col)
                            
                            if not f_df.empty:
                                main_iterators[symbol] = iter(f_df.to_dict(orient="records"))
                                success_count += 1
                                print(f"✅ Loaded {len(f_df)} candles for {symbol} on {target_date}")
                        except Exception as e:
                            print(f"⚠️ Failed to load {symbol}: {e}")

                    if success_count == 0:
                        await websocket.send_json({"type": "ERROR", "message": f"No data found for any requested symbols on {target_date}"})
                        continue

                    # --- SEND BACKFILL (History) ---
                    try:
                        backfill_candles = []
                        df_backfill, _, _ = load_parquet_for_symbol(primary_symbol.split('-')[0], target_date, allow_fallback=True)
                        backfill_ts_col = next((c for c in ['datetime', 'date', 'time'] if c in df_backfill.columns), None)
                        if backfill_ts_col:
                            if not pd.api.types.is_datetime64_any_dtype(df_backfill[backfill_ts_col]):
                                df_backfill[backfill_ts_col] = pd.to_datetime(df_backfill[backfill_ts_col].astype(str).str.replace('Ok ', '', regex=False).str.strip(), errors='coerce')
                            
                            # Filter up to current target_date (start of day) - or take last 500
                            # To be safe, just take the first 500 rows if it's the target date
                            # Actually, we want candles BEFORE the current simulation clock.
                            # Simulation starts at 9:15 AM today.
                            market_open_today = pd.to_datetime(target_date).replace(hour=9, minute=15)
                            hist_mask = (df_backfill[backfill_ts_col] < market_open_today)
                            h_df = df_backfill[hist_mask].tail(300)
                            
                            for _, r in h_df.iterrows():
                                backfill_candles.append({
                                    "time": int(r[backfill_ts_col].timestamp()),
                                    "open": float(r['open']), "high": float(r['high']),
                                    "low": float(r['low']), "close": float(r['close']),
                                    "volume": float(r.get('volume', 0))
                                })
                            
                            if backfill_candles:
                                print(f"📚 Sending {len(backfill_candles)} backfill candles for {primary_symbol}")
                                await websocket.send_json({"type": "BACKFILL", "data": {"symbol": primary_symbol, "candles": backfill_candles}})
                    except Exception as be:
                        print(f"⚠️ Backfill error: {be}")
                    
                    # --- Load Benchmark Indices for Sync ---
                    indices_iterators = {}
                    indices_opens = {}
                    for idx_name in ["NIFTY", "BANKNIFTY", "SENSEX"]:
                        try:
                            idx_df, _, _ = load_parquet_for_symbol(idx_name, target_date, allow_fallback=True)
                            ic_date_col = next((c for c in ['datetime', 'date', 'time'] if c in idx_df.columns), None)
                            if ic_date_col:
                                temp_idx = idx_df.copy()
                                if not pd.api.types.is_datetime64_any_dtype(temp_idx[ic_date_col]):
                                    temp_idx[ic_date_col] = pd.to_datetime(
                                        temp_idx[ic_date_col].astype(str).str.replace('Ok ', '', regex=False).str.strip(), 
                                        dayfirst=False, errors='coerce'
                                    )
                                
                                # If fallback was used, the inherent date will be wrong. 
                                # We shift the date of the index data to match the target_dt exactly.
                                first_valid_dt = temp_idx[ic_date_col].dropna().iloc[0] if not temp_idx[ic_date_col].isnull().all() else None
                                if first_valid_dt and first_valid_dt.date() != target_dt:
                                    # Calculate difference in days to map to target_dt
                                    delta = pd.Timestamp(target_dt) - pd.Timestamp(first_valid_dt.date())
                                    temp_idx[ic_date_col] = temp_idx[ic_date_col] + delta
                                    # print(f"⏳ Shifted {idx_name} data by {delta.days} days to match {target_dt}")
                                
                                mask_idx = (
                                    (temp_idx[ic_date_col].dt.date == target_dt) &
                                    (temp_idx[ic_date_col].dt.time >= datetime.time(9, 15)) &
                                    (temp_idx[ic_date_col].dt.time <= datetime.time(15, 30))
                                )
                                f_idx_df = temp_idx[mask_idx].sort_values(by=ic_date_col)
                                if not f_idx_df.empty:
                                    indices_iterators[idx_name] = iter(f_idx_df.to_dict(orient="records"))
                                    indices_opens[idx_name] = float(f_idx_df.iloc[0]['open'])
                                    print(f"✅ Loaded {len(f_idx_df)} sync candles for {idx_name}")
                                else:
                                    print(f"⚠️ Index {idx_name} matched no time rows for {target_dt}")
                        except Exception as e:
                            print(f"⚠️ Could not sync index {idx_name}: {e}")

                    is_running = True
                    print(f"▶️  Simulation Started | Symbols: {list(main_iterators.keys())} | Speed: {speed}x")

                    # Fetch today's news for alignment with simulation ticks
                    try:
                        raw_news = await fetch_news_for_date(primary_symbol, target_date)
                        # Convert publishedAt → timestamp (datetime) for simulation time comparison
                        active_news = []
                        for n in raw_news:
                            try:
                                pub = n.get("publishedAt") or n.get("timestamp")
                                if pub and isinstance(pub, str):
                                    ts = pd.to_datetime(pub, errors="coerce")
                                    if pd.notna(ts):
                                        n["timestamp"] = ts.to_pydatetime()
                                    else:
                                        # Fallback: schedule at market open + random offset
                                        n["timestamp"] = base_time if 'base_time' in dir() else datetime.datetime.now()
                                elif pub and isinstance(pub, datetime.datetime):
                                    n["timestamp"] = pub
                                else:
                                    n["timestamp"] = datetime.datetime.now()
                                n["triggered"] = False
                                active_news.append(n)
                            except Exception:
                                pass  # Skip malformed news items
                    except Exception as e:
                        print(f"⚠️ Failed to fetch news for {target_date}: {e}")
                        active_news = []

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
                        await TradeEngine.execute_trade(request, current_user_id, db)
                    finally:
                        await db.close()

                elif command == "SELL":
                    # oms.sell(last_tick_price, qty=50)
                    from app.schemas import TradeExecuteRequest, TradeDirection, OrderType
                    request = TradeExecuteRequest(
                        symbol=current_symbol,
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
                        await TradeEngine.execute_trade(request, current_user_id, db)
                    finally:
                        await db.close()

                elif command == "STOP":
                    is_running = False
                    print("⏹️ Simulation Stopped by client")

                elif command == "NEWS_QUESTION":
                    q_text = message.get("question")
                    news_id = message.get("news_id")
                    if 'active_news' in locals():
                        target_news = next((n for idx, n in enumerate(active_news) if idx == news_id), None)
                        if target_news:
                            async def fetch_answer(nq, ni, sym, nid):
                                ans = await ask_news_question(ni["title"], ni["description"], nq, sym)
                                await websocket.send_json({
                                    "type": "NEWS_ANSWER",
                                    "data": {
                                        "id": nid,
                                        "question": nq,
                                        "answer": ans
                                    }
                                })
                            asyncio.create_task(fetch_answer(q_text, target_news, primary_symbol, news_id))

                elif command == "SPEED":
                    speed = float(message.get("speed", 1.0))
                    print(f"⏩ Speed dynamically updated to {speed}x")

            except asyncio.TimeoutError:
                pass  # No command — continue streaming

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
                print("🏁 End of data for all symbols — stopping.")
                await websocket.send_json({"type": "END", "message": "Data finished for all symbols"})
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
                base_time = pd.to_datetime(date_val) if not isinstance(date_val, datetime.datetime) else date_val
            except Exception as e:
                print(f"❌ Ref row parse error: {e}")
                continue

            # Generate ticks for ALL main symbols
            all_symbol_ticks = {}
            for sym, row in main_current_rows.items():
                try:
                    all_symbol_ticks[sym] = synthesizer.generate_ticks(
                        float(row.get('open', 0)),
                        float(row.get('high', 0)),
                        float(row.get('low', 0)),
                        float(row.get('close', 0)),
                        num_ticks=60
                    )
                except Exception as e:
                    print(f"⚠️ Ticks Error ({sym}): {e}")
                    all_symbol_ticks[sym] = [float(row.get('close', 0))] * 60

            # Advance and generate ticks for indices
            indices_ticks = {}
            for idx_name, idx_iter in list(indices_iterators.items()):
                try:
                    idx_row = next(idx_iter)
                    indices_ticks[idx_name] = synthesizer.generate_ticks(
                        float(idx_row.get('open', 0)), float(idx_row.get('high', 0)),
                        float(idx_row.get('low', 0)), float(idx_row.get('close', 0)),
                        num_ticks=60
                    )
                except StopIteration:
                    del indices_iterators[idx_name]
                except Exception as e:
                    print(f"⚠️ Index Error ({idx_name}): {e}")

            # Stream each tick (second by second)
            try:
                last_tick_sent_at = time.time()
                for i in range(60):
                    tick_time = base_time + datetime.timedelta(seconds=i)
                    
                    # 1. Update Price for OMS (Primary Symbol only for now)
                    if primary_symbol in all_symbol_ticks:
                        current_price = all_symbol_ticks[primary_symbol][i]
                        from app.services.order_management import oms_service
                        await oms_service.on_price_update(primary_symbol, current_price, simulated_time=tick_time, session_type="REPLAY")

                    # 2. Push Ticks for ALL MAIN symbols
                    for sym, ticks in all_symbol_ticks.items():
                        if i < len(ticks):
                            try:
                                await websocket.send_json({
                                    "type": "TICK",
                                    "data": {
                                        "symbol": sym,
                                        "price": round(float(ticks[i]), 2),
                                        "timestamp": tick_time.isoformat(),
                                        "volume": int(main_current_rows[sym].get('volume', 0)),
                                    }
                                })
                            except Exception: break

                    # 3. Push INDICES_TICK (sync)
                    indices_payload = {}
                    for idx_name, ticks_arr in indices_ticks.items():
                        if i < len(ticks_arr):
                            curr_idx_price = float(ticks_arr[i])
                            day_open = indices_opens.get(idx_name, curr_idx_price)
                            change = curr_idx_price - day_open
                            change_percent = (change / day_open) * 100 if day_open > 0 else 0
                            
                            display_name = idx_name
                            if idx_name == "NIFTY": display_name = "NIFTY 50"
                            
                            indices_payload[display_name] = {
                                "name": display_name,
                                "price": round(curr_idx_price, 2),
                                "change": round(change, 2),
                                "change_percent": round(change_percent, 2),
                                "is_positive": change >= 0
                            }
                    
                    # NEW: Add Primary Symbol to top ticker if it's not already an index
                    if primary_symbol and primary_symbol in all_symbol_ticks:
                        curr_p = float(all_symbol_ticks[primary_symbol][i])
                        # Use a simple change calculation based on first tick of day if open is not loaded
                        indices_payload[primary_symbol] = {
                            "name": primary_symbol,
                            "price": round(curr_p, 2),
                            "change": 0.0,
                            "change_percent": 0.0,
                            "is_positive": True
                        }
                    
                    if indices_payload:
                        try:
                            await websocket.send_json({ "type": "INDICES_TICK", "data": indices_payload })
                            # NEW: Diagnostic version heartbeat
                            await websocket.send_json({ "type": "STATS", "data": { "tick": i, "speed": speed } })
                        except Exception: pass

                    # ─── Smooth Sub-Tick Interpolation (10 steps) ───
                    # Split the 5s delay into 10 x 500ms chunks with interpolated prices
                    sub_steps = 10
                    for step in range(sub_steps):
                        # Command Check (Inner - run in each sub-step)
                        trigger_next = False
                        try:
                            inner_data = await asyncio.wait_for(websocket.receive_text(), timeout=0.0001)
                            inner_msg = json.loads(inner_data)
                            inner_cmd = inner_msg.get("command")
                            if inner_cmd == "SPEED":
                                speed = float(inner_msg.get("speed", 1.0))
                            elif inner_cmd == "STOP":
                                is_running = False
                                break
                            elif inner_cmd == "STEP":
                                trigger_next = True
                        except asyncio.TimeoutError: pass
                        except WebSocketDisconnect:
                            is_running = False
                            break
                        except Exception: pass

                        if not is_running: break
                        if trigger_next: break 

                        # Interpolation factor (0.1 to 1.0)
                        factor = (step + 1) / sub_steps
                        
                        # --- BROADCAST INTERPOLATED TICKS ---
                        # For Primary Symbol, we can interpolate if there's a next tick
                        if primary_symbol and primary_symbol in all_symbol_ticks and i + 1 < len(all_symbol_ticks[primary_symbol]):
                            curr_val = float(all_symbol_ticks[primary_symbol][i])
                            next_val = float(all_symbol_ticks[primary_symbol][i+1])
                            interp_price = curr_val + (next_val - curr_val) * factor
                            
                            try:
                                # Send TICK
                                await websocket.send_json({
                                    "type": "TICK",
                                    "data": {
                                        "symbol": primary_symbol,
                                        "price": round(interp_price, 2),
                                        "timestamp": tick_time.isoformat(),
                                        "volume": int(main_current_rows[primary_symbol].get('volume', 0)),
                                    }
                                })
                                # Update Global Ticker (simulatedIndices)
                                interp_indices = {**indices_payload}
                                interp_indices[primary_symbol] = {
                                    "name": primary_symbol,
                                    "price": round(interp_price, 2),
                                    "change": indices_payload[primary_symbol]["change"],
                                    "change_percent": indices_payload[primary_symbol]["change_percent"],
                                    "is_positive": indices_payload[primary_symbol]["is_positive"]
                                }
                                await websocket.send_json({ "type": "INDICES_TICK", "data": interp_indices })
                            except Exception: break

                        # ── Sleep for 1/10th of the interval ──
                        actual_delay = 5.0 / (speed * sub_steps) if speed > 0 else 1.0 / sub_steps
                        await asyncio.sleep(actual_delay)
                    
                    last_tick_sent_at = time.time()

                    # --- NEW: Synchronized News Injection ---
                    for idx, n_item in enumerate(list(active_news)):
                        if not isinstance(n_item, dict): continue
                        n_timestamp = n_item.get("timestamp")
                        if not n_timestamp: continue
                        
                        if not n_item.get("triggered") and tick_time >= n_timestamp:
                            active_news[idx]["triggered"] = True
                            print(f"📰 FLASHING NEWS: {n_item['title']} at simulated time {tick_time}", flush=True)
                            
                            asyncio.create_task(websocket.send_json({
                                "type": "NEWS_FLASH",
                                "data": {
                                    "id": idx,
                                    "symbol": primary_symbol,
                                    "title": n_item["title"],
                                    "description": n_item["description"],
                                    "time_str": n_item["time_str"],
                                    "source": n_item["source"],
                                    "url": n_item["url"]
                                }
                            }))
                            
                            async def perform_analysis(item, item_idx, sym):
                                try:
                                    impact_task = analyze_news_impact(item["title"], item["description"], sym)
                                    explainer_task = generate_news_explainer(item["title"], item["description"], sym)
                                    impact_res, explainer_res = await asyncio.gather(impact_task, explainer_task)
                                    await websocket.send_json({
                                        "type": "NEWS_ANALYSIS",
                                        "data": {
                                            "id": item_idx,
                                            "analysis": impact_res["analysis"],
                                            "sentiment": impact_res["sentiment"],
                                            "predicted_impact": impact_res.get("predicted_impact", "Unknown")
                                        }
                                    })
                                    await websocket.send_json({
                                        "type": "NEWS_EXPLAINER",
                                        "data": { "id": item_idx, "explainer": explainer_res }
                                    })
                                except Exception as ex:
                                    print(f"⚠️ Error in News AI: {ex}", flush=True)
                                    
                            asyncio.create_task(perform_analysis(n_item, idx, primary_symbol))

                            active_impact_observers.append({
                                "news_id": idx,
                                "baseline_price": all_symbol_ticks[primary_symbol][i] if primary_symbol in all_symbol_ticks else 0,
                                "target_time": tick_time + datetime.timedelta(minutes=15)
                            })
                    
                    # --- PROCESS IMPACT OBSERVERS ---
                    for obs in list(active_impact_observers):
                        if tick_time >= obs["target_time"] and primary_symbol in all_symbol_ticks:
                            curr_p = all_symbol_ticks[primary_symbol][i]
                            pct_change = ((curr_p - obs["baseline_price"]) / obs["baseline_price"]) * 100 if obs["baseline_price"] > 0 else 0
                            asyncio.create_task(websocket.send_json({
                                "type": "NEWS_IMPACT_RESULT",
                                "data": {
                                    "id": obs["news_id"],
                                    "actual_impact": f"{pct_change:+.2f}% in 15m",
                                    "price_start": obs["baseline_price"],
                                    "price_end": curr_p
                                }
                            }))
                            active_impact_observers.remove(obs)
                
                if not is_running:
                    break

            except Exception as e:
                print(f"❌ CRITICAL error in ticker loop: {e}", flush=True)
                import traceback
                traceback.print_exc()
                await asyncio.sleep(1.0) # Prevent tight loop on error

            # Send CANDLE for ALL symbols at end of each minute
            for sym, row in main_current_rows.items():
                try:
                    await websocket.send_json({
                        "type": "CANDLE",
                        "data": {
                            "open":   float(row.get('open', 0)),
                            "high":   float(row.get('high', 0)),
                            "low":    float(row.get('low', 0)),
                            "close":   float(row.get('close', 0)),
                            "volume": int(row.get('volume', 0)),
                            "timestamp": base_time.isoformat(),
                            "symbol": sym,
                        }
                    })
                except Exception: break

    except WebSocketDisconnect:
        print("🔴 Client Disconnected", flush=True)
    except Exception as e:
        print(f"⚠️ Unhandled WS Error: {e}", flush=True)
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
