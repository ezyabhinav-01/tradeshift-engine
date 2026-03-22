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
    matching_files = []
    # Try exact match first for date format: NIFTY_2026-03-02.parquet
    if target_date:
        pattern_date = f"data/{symbol}_{target_date}.parquet"
        date_match = glob.glob(pattern_date)
        if date_match:
            matching_files.extend(date_match)

    # Search for files matching the pattern (if no date or date file not found)
    if not matching_files and allow_fallback:
        pattern = f"data/{symbol}_*.parquet"
        matching_files = glob.glob(pattern)
        print(f"🔄 Fallback triggered. Searching for {pattern}... found {len(matching_files)} files.")
        
        # Try exact match (e.g., NIFTY_50_1min.parquet for symbol "NIFTY_50")
        pattern_exact = f"data/{symbol}.parquet"
        exact_match = glob.glob(pattern_exact)
        if exact_match:
            matching_files.extend(exact_match)
    
    if not matching_files:
        raise FileNotFoundError(f"No Parquet file found for symbol '{symbol}' (date: {target_date}) in data/ directory")
    
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
        parquet_files = glob.glob("data/*.parquet")
        print(f"📂 Found {len(parquet_files)} parquet files")
        symbols = []
        
        # Open connection ONCE, not in loop
        conn = None
        try:
            conn = engine_sync.connect()
            print("✅ DB Connection established")
        except Exception as e:
            print(f"⚠️ DB Connection failed: {e}")

        import re
        for file_path in parquet_files:
            basename = os.path.basename(file_path).replace('.parquet', '')
            # Robust symbol extraction: Remove the _YYYY-MM-DD suffix if present
            symbol = re.sub(r'_\d{4}-\d{2}-\d{2}$', '', basename)
            # Legacy cleanup support
            symbol = symbol.replace('_1min', '').replace('_2026', '').replace('_2025', '')
            print(f"   Processing symbol: {symbol} from {basename}")
            
            name = symbol # Default
            token = "0"   # Default
            
            # Try to get token from database if connection exists
            if conn:
                try:
                    result = conn.execute(
                        text("SELECT token, symbol, name FROM instruments_master WHERE symbol = :sym OR symbol LIKE :pattern LIMIT 1"),
                        {"sym": symbol, "pattern": f"%{symbol}%"}
                    )
                    row = result.fetchone()
                    if row:
                        token = row[0]
                        name = row[2] if len(row) > 2 else symbol
                        print(f"      ✅ Found in DB: {name} ({token})")
                except Exception as db_err:
                    print(f"      ⚠️ DB Query failed for {symbol}: {db_err}")
            
            symbols.append({
                "token": token, 
                "symbol": symbol, 
                "name": name,
                "file": basename
            })
            
        if conn:
            conn.close()
            print("🔒 DB Connection closed")
        
        print(f"✅ Returning {len(symbols)} symbols")
        return {"symbols": symbols}
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
        pattern = f"data/{base_symbol}_*.parquet"
        files = glob.glob(pattern)
        
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
    print("🟢 Client Connected")

    # State
    is_running      = False
    speed           = 1.0
    synthesizer     = TickSynthesizer()
    # Local OrderManager is replaced by global oms_service
    # last_tick_price = 21500.0 # Will be updated in tick loop
    current_user_id = 1 # Default
    last_tick_price = 21500.0
    iterator        = None
    indices_iterators = {}    # { "NIFTY": iterator, "BANKNIFTY": iterator }
    indices_opens   = {}      # { "NIFTY": open_price, "BANKNIFTY": open_price }
    current_symbol  = "NIFTY"
    df_current      = None  # keep reference for restart
    active_impact_observers = [] # Track news for 15-minute impact assessment
    tick_time       = datetime.datetime.now() # track for commands

    try:
        while True:
            # ── A. Check for incoming commands (non-blocking) ──────────────
            try:
                data    = await asyncio.wait_for(websocket.receive_text(), timeout=0.001)
                message = json.loads(data)
                command = message.get("command")

                if command == "START":
                    current_user_id = message.get("user_id") or 1
                    symbol      = message.get("symbol") or "NIFTY"
                    target_date = message.get("date")
                    speed       = float(message.get("speed", 1.0))
                    current_symbol = symbol

                    # Load Parquet for the requested symbol
                    try:
                        base_symbol = symbol.split('-')[0] if '-' in symbol else symbol
                        df_current, file_path, _ = load_parquet_for_symbol(base_symbol, target_date)
                    except FileNotFoundError as e:
                        await websocket.send_json({"type": "ERROR", "message": str(e)})
                        print(f"❌ {e}")
                        continue
                    except Exception as e:
                        await websocket.send_json({"type": "ERROR", "message": f"Error loading data: {str(e)}"})
                        print(f"❌ Data loading error: {e}")
                        continue

                    print(f"✅ Loaded {len(df_current)} records from {file_path}")

                    # Find the date column
                    date_col = next(
                        (c for c in ['datetime', 'date', 'time'] if c in df_current.columns),
                        None
                    )
                    if not date_col:
                        await websocket.send_json({"type": "ERROR", "message": "Dataset has no date/time column"})
                        continue

                    # Convert date column and filter by target_date
                    temp_df = df_current.copy()
                    if not pd.api.types.is_datetime64_any_dtype(temp_df[date_col]):
                        temp_df[date_col] = pd.to_datetime(
                            temp_df[date_col].astype(str).str.replace('Ok ', '', regex=False).str.strip(), 
                            dayfirst=False, errors='coerce'
                        )

                    if not target_date:
                        first_date  = temp_df[date_col].dropna().min().date()
                        target_date = str(first_date)

                    target_dt  = pd.to_datetime(target_date).date()
                    mask       = (
                        (temp_df[date_col].dt.date == target_dt) &
                        (temp_df[date_col].dt.time >= datetime.time(9, 15)) &
                        (temp_df[date_col].dt.time <= datetime.time(15, 30))
                    )
                    filtered_df = temp_df[mask].sort_values(by=date_col)

                    if filtered_df.empty:
                        await websocket.send_json({"type": "ERROR", "message": f"No data found for date: {target_date} in {symbol}"})
                        continue

                    print(f"✅ Streaming {len(filtered_df)} candles for {symbol} on {target_date}")
                    # Use list-of-dicts — consistent with .get() row access below
                    iterator   = iter(filtered_df.to_dict(orient="records"))
                    
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
                    print(f"▶️  Simulation Started | Symbol: {symbol} | Speed: {speed}x")

                    # Fetch today's news for alignment with simulation ticks
                    # This will be awaited inline since it's before is_running really starts cranking
                    try:
                        active_news = await fetch_news_for_date(symbol, target_date)
                    except Exception as e:
                        print(f"⚠️ Failed to fetch news for {target_date}: {e}")
                        active_news = []

                elif command == "BUY":
                    # oms.buy(last_tick_price, qty=50)
                    from app.schemas import TradeExecuteRequest, TradeDirection, OrderType
                    request = TradeExecuteRequest(
                        symbol=current_symbol,
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
                            asyncio.create_task(fetch_answer(q_text, target_news, current_symbol, news_id))

                elif command == "SPEED":
                    speed = float(message.get("speed", 1.0))
                    print(f"⏩ Speed dynamically updated to {speed}x")

            except asyncio.TimeoutError:
                pass  # No command — continue streaming

            # ── B. Stream data (only when running) ────────────────────────
            if not is_running:
                await asyncio.sleep(0.05)
                continue

            # Get next candle row
            try:
                row = next(iterator)  # type: dict
            except StopIteration:
                print("🏁 End of data for this date — stopping.")
                await websocket.send_json({"type": "END", "message": "Data finished for date"})
                is_running = False
                continue

            # Extract OHLC
            try:
                open_p = float(row.get('open',  0))
                high   = float(row.get('high',  0))
                low    = float(row.get('low',   0))
                close  = float(row.get('close', 0))
                # Resolve timestamp from whichever date column exists
                date_val = (
                    row.get('datetime') or
                    row.get('date')     or
                    row.get('time')     or
                    datetime.datetime.now()
                )
                base_time = pd.to_datetime(date_val) if not isinstance(date_val, datetime.datetime) else date_val
            except Exception as e:
                print(f"❌ Row parse error: {e} | Row keys: {list(row.keys())}")
                continue

            # Advance index iterators
            indices_current_rows = {}
            for idx_name, idx_iter in list(indices_iterators.items()):
                try:
                    indices_current_rows[idx_name] = next(idx_iter)
                except StopIteration:
                    # Remove depleted iterator
                    del indices_iterators[idx_name]

            # Generate micro-ticks (Brownian bridge across the minute)
            try:
                ticks = synthesizer.generate_ticks(open_p, high, low, close, num_ticks=60)
                
                # Generate corresponding ticks for synchronized indices
                indices_ticks = {}
                for idx_name, idx_row in indices_current_rows.items():
                    try:
                        idx_ticks = synthesizer.generate_ticks(
                            float(idx_row.get('open', 0)), 
                            float(idx_row.get('high', 0)), 
                            float(idx_row.get('low', 0)), 
                            float(idx_row.get('close', 0)), 
                            num_ticks=60
                        )
                        indices_ticks[idx_name] = idx_ticks
                    except Exception as e:
                        print(f"⚠️ Index Ticks Error ({idx_name}): {e}")
                        indices_ticks[idx_name] = [float(idx_row.get('close', 0))] * 60
                        
            except Exception as e:
                print(f"❌ Synthesizer Error: {e}")
                continue

            # Stream each tick
            num_ticks = 60
            for i, price in enumerate(ticks):
                last_tick_price = float(price)
                tick_time       = base_time + datetime.timedelta(seconds=i)

                # 🔥 TRIGGER OMS PRICE UPDATE (to trigger SL/TP)
                from app.services.order_management import oms_service
                await oms_service.on_price_update(current_symbol, last_tick_price, simulated_time=tick_time, session_type="REPLAY")

                payload = {
                    "type": "TICK",
                    "data": {
                        "symbol":    current_symbol,
                        "price":     round(last_tick_price, 2),
                        "timestamp": tick_time.isoformat(),
                        "pnl":       0.0, # Frontend will calculate PnL from its own state
                        "volume":    int(row.get('volume', 0)),
                    }
                }
                
                # Construct combined payload for indices
                indices_payload = {}
                for idx_name, ticks_arr in indices_ticks.items():
                    if i < len(ticks_arr):
                        curr_idx_price = float(ticks_arr[i])
                        day_open = indices_opens.get(idx_name, curr_idx_price)
                        change = curr_idx_price - day_open
                        change_percent = (change / day_open) * 100 if day_open > 0 else 0
                        # Formal mappings for the frontend
                        display_name = idx_name
                        if idx_name == "NIFTY": display_name = "NIFTY 50"
                        
                        indices_payload[display_name] = {
                            "name": display_name,
                            "price": round(curr_idx_price, 2),
                            "change": round(change, 2),
                            "change_percent": round(change_percent, 2),
                            "is_positive": change >= 0
                        }
                        
                if sum(len(x) for x in indices_payload.values()) > 0:
                     try:
                        await websocket.send_json({
                            "type": "INDICES_TICK",
                            "data": indices_payload
                        })
                     except Exception:
                        pass # Ignore index push failure, prioritize main tick

                try:
                    await websocket.send_json(payload)
                except (WebSocketDisconnect, Exception) as e:
                    print(f"🔴 Send Error: {e}")
                    is_running = False
                    break

                # --- NEW: Synchronized News Injection ---
                for idx, n_item in enumerate(list(active_news)):
                    if not n_item.get("analyzed") and tick_time >= n_item["timestamp"]:
                        # Mark as triggered in simulation context
                        active_news[idx]["analyzed"] = True
                        print(f"📰 FLASHING NEWS: {n_item['title']} at simulated time {tick_time}")
                        
                        # 1. Flash the news immediately to frontend
                        asyncio.create_task(websocket.send_json({
                            "type": "NEWS_FLASH",
                            "data": {
                                "id": idx,
                                "symbol": current_symbol,
                                "title": n_item["title"],
                                "description": n_item["description"],
                                "time_str": n_item["time_str"],
                                "source": n_item["source"],
                                "url": n_item["url"]
                            }
                        }))
                        
                        # 2. Trigger FinGPT analysis & Explainer in background
                        async def perform_analysis(item, item_idx, sym):
                            import traceback
                            try:
                                # Run impact analysis and explainer generation in parallel
                                impact_task = analyze_news_impact(item["title"], item["description"], sym)
                                explainer_task = generate_news_explainer(item["title"], item["description"], sym)
                                
                                impact_res, explainer_res = await asyncio.gather(impact_task, explainer_task)
                                
                                # Send Impact Analysis
                                await websocket.send_json({
                                    "type": "NEWS_ANALYSIS",
                                    "data": {
                                        "id": item_idx,
                                        "analysis": impact_res["analysis"],
                                        "sentiment": impact_res["sentiment"],
                                        "predicted_impact": impact_res.get("predicted_impact", "Unknown")
                                    }
                                })
                                
                                # Send Explainer
                                await websocket.send_json({
                                    "type": "NEWS_EXPLAINER",
                                    "data": {
                                        "id": item_idx,
                                        "explainer": explainer_res
                                    }
                                })
                                
                            except Exception as ex:
                                print(f"Error in FinGPT analysis/explainer: {ex}\n{traceback.format_exc()}")
                                
                        asyncio.create_task(perform_analysis(n_item, idx, current_symbol))

                        # 3. Register observer for 15m quantized impact
                        active_impact_observers.append({
                            "news_id": idx,
                            "baseline_price": last_tick_price,
                            "target_time": tick_time + datetime.timedelta(minutes=15)
                        })
                
                # --- PROCESS IMPACT OBSERVERS ---
                for obs in list(active_impact_observers):
                    if tick_time >= obs["target_time"]:
                        pct_change = ((last_tick_price - obs["baseline_price"]) / obs["baseline_price"]) * 100
                        asyncio.create_task(websocket.send_json({
                            "type": "NEWS_IMPACT_RESULT",
                            "data": {
                                "id": obs["news_id"],
                                "actual_impact": f"{pct_change:+.2f}% in 15m",
                                "price_start": obs["baseline_price"],
                                "price_end": last_tick_price
                            }
                        }))
                        active_impact_observers.remove(obs)
                # ----------------------------------------

                # Sleep per tick: 60s / (num_ticks * speed)
                # At 1x: 60/60 = 1.0s per tick → 60s per candle
                # At 5x: 60/300 = 0.2s per tick → 12s per candle
                # At 20x: 60/1200 = 0.05s per tick → 3s per candle
                tick_delay = 60.0 / (num_ticks * max(speed, 0.1))
                await asyncio.sleep(tick_delay)

                # Check for incoming commands (SPEED/STOP) between ticks
                try:
                    msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)
                    cmd = msg.get("command", "").upper()
                    if cmd == "SPEED":
                        speed = float(msg.get("speed", speed))
                        print(f"⏩ Speed updated mid-tick to {speed}x")
                    elif cmd == "STOP":
                        is_running = False
                        print("⏹️ Stopped mid-tick by client")
                        break
                except asyncio.TimeoutError:
                    pass

            if not is_running:
                break

            # Send CANDLE at end of each minute
            try:
                await websocket.send_json({
                    "type": "CANDLE",
                    "data": {
                        "open":      open_p,
                        "high":      high,
                        "low":       low,
                        "close":     close,
                        "volume":    int(row.get('volume', 0)),
                        "timestamp": base_time.isoformat(),
                        "symbol":    current_symbol,
                    }
                })
            except Exception:
                break

    except WebSocketDisconnect:
        print("🔴 Client Disconnected")
    except Exception as e:
        print(f"⚠️ Unhandled WS Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
