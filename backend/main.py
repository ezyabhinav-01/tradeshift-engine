# File: backend/main.py

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
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
from app.routers import inngest
from app.models import User  # Models must be imported for Base to detect them
from app.database import Base, connect_to_database

# --- DB INITIALIZATION ---
# Connect and Create Tables using the cached connection pattern
try:
    engine = connect_to_database()
    Base.metadata.create_all(bind=engine)
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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(inngest.router)

# --- 3. INFRASTRUCTURE CONNECTIONS ---


# --- 3. INFRASTRUCTURE CONNECTIONS ---
# Database connection is now handled by app.database module (above)

try:
    minio_client = Minio("minio:9000", "minioadmin", "minioadmin", secure=False)
except Exception:
    pass

try:
    redis_client = Redis(host='tradeshift_redis', port=6379, decode_responses=True)
except Exception:
    print("⚠️ Redis not connected")

# --- 4. WEBSOCKET ENDPOINT ---
@app.websocket("/ws/simulation")
# --- 4. HELPER FUNCTION: Load Parquet by Symbol ---
def load_parquet_for_symbol(symbol: str):
    """
    Load Parquet file for a given symbol from the data/ directory.
    
    Args:
        symbol (str): Symbol name (e.g., 'NIFTY', 'BANKNIFTY', 'NIFTY_50')
        
    Returns:
        tuple: (DataFrame, file_path, symbol_name)
        
    Raises:
        FileNotFoundError: If no matching Parquet file is found
    """
    # Search for files matching the pattern
    pattern = f"data/{symbol}_*.parquet"
    matching_files = glob.glob(pattern)
    
    # Try exact match first (e.g., NIFTY_50_1min.parquet for symbol "NIFTY_50")
    pattern_exact = f"data/{symbol}.parquet"
    exact_match = glob.glob(pattern_exact)
    if exact_match:
        matching_files.extend(exact_match)
    
    if not matching_files:
        raise FileNotFoundError(f"No Parquet file found for symbol '{symbol}' in data/ directory")
    
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
        df['datetime'] = pd.to_datetime(df['time'], format='%d-%m-%Y %H:%M:%S', errors='coerce')
        # Fallback for ISO format
        mask = df['datetime'].isnull()
        if mask.any():
            df.loc[mask, 'datetime'] = pd.to_datetime(df.loc[mask, 'time'], errors='coerce')
    
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
        
        with engine.connect() as conn:
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
            conn = engine.connect()
            print("✅ DB Connection established")
        except Exception as e:
            print(f"⚠️ DB Connection failed: {e}")

        for file_path in parquet_files:
            basename = os.path.basename(file_path).replace('.parquet', '')
            symbol = basename.replace('_1min', '').replace('_2026', '').replace('_2025', '')
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

# --- 6. WEBSOCKET ENDPOINT ---
@app.websocket("/ws/ticker")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("🟢 Client Connected")

    # Internal State
    is_running = False
    speed = 1.0
    synthesizer = TickSynthesizer()
    oms = OrderManager()
    last_tick_price = 21500.0  # Default value to prevent errors before stream starts
    
    # Data Source
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "data", "NIFTY_50_1min.parquet")
    # Data Source (now loaded dynamically based on symbol)
    df = None
    iterator = None
    current_symbol = None
    using_real_data = False

    if os.path.exists(file_path):
        try:
            print(f"📂 Loaded: {file_path}")
            df = pd.read_parquet(file_path)
            df.columns = df.columns.str.lower()
            # Opt for iterator to save memory (avoid to_dict overhead)
            iterator = df.itertuples(index=False)
            using_real_data = True
        except Exception as e:
            print(f"⚠️ Error loading parquet: {e}. Switching to synthetic data.")
            using_real_data = False
    else:
        print("⚠️ Parquet not found. Using Synthetic Data Generation.")

    try:
        while True:
            # A. CHECK FOR COMMANDS (Non-blocking)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.001)
                message = json.loads(data)
                command = message.get("command")
                
                if command == "START":
                    symbol = message.get("symbol")
                    target_date = message.get("date")
                    speed = float(message.get("speed", 1.0))
                    
                    if using_real_data:
                        try:
                            # Date Logic
                            date_col = None
                            if 'date' in df.columns: date_col = 'date'
                            elif 'datetime' in df.columns: date_col = 'datetime'
                            
                            if not date_col:
                                await websocket.send_json({"type": "ERROR", "message": "Dataset has no date column"})
                                continue

                            # Filter DataFrame
                            temp_df = df.copy()
                            temp_df[date_col] = pd.to_datetime(temp_df[date_col])
                            
                            if not target_date:
                                first_date = temp_df[date_col].min().date()
                                target_date = str(first_date)
                            
                            target_dt = pd.to_datetime(target_date).date()
                            mask = temp_df[date_col].dt.date == target_dt
                            filtered_df = temp_df[mask]

                            if filtered_df.empty:
                                await websocket.send_json({"type": "ERROR", "message": f"No data found for date: {target_date}"})
                                continue

                            print(f"✅ Found {len(filtered_df)} records for {target_date}")
                            print(f"✅ Found {len(filtered_df)} records for {target_date}")
                            # Use itertuples for filtered data too
                            iterator = filtered_df.itertuples(index=False)

                        except Exception as e:
                            print(f"❌ Date filtering error: {e}")
                    # Validate symbol parameter
                    if not symbol:
                        await websocket.send_json({"type": "ERROR", "message": "Symbol parameter is required"})
                        continue
                    
                    # Load Parquet file for the symbol
                    try:
                        df, file_path, current_symbol = load_parquet_for_symbol(symbol)
                        using_real_data = True
                        print(f"✅ Loaded {len(df)} records from {file_path}")
                        
                        # Date Logic
                        date_col = None
                        if 'date' in df.columns: date_col = 'date'
                        elif 'datetime' in df.columns: date_col = 'datetime'
                        elif 'time' in df.columns: date_col = 'time'
                        
                        if not date_col:
                            await websocket.send_json({"type": "ERROR", "message": "Dataset has no date/time column"})
                            continue

                        # Filter DataFrame by date if specified
                        temp_df = df.copy()
                        temp_df[date_col] = pd.to_datetime(temp_df[date_col])
                        
                        if not target_date:
                            first_date = temp_df[date_col].min().date()
                            target_date = str(first_date)
                        
                        target_dt = pd.to_datetime(target_date).date()
                        mask = temp_df[date_col].dt.date == target_dt
                        filtered_df = temp_df[mask]

                        if filtered_df.empty:
                            await websocket.send_json({"type": "ERROR", "message": f"No data found for date: {target_date}"})
                            continue

                        print(f"✅ Found {len(filtered_df)} records for {target_date}")
                        current_records = filtered_df.to_dict(orient="records")
                        iterator = iter(current_records)
                        
                    except FileNotFoundError as e:
                        await websocket.send_json({"type": "ERROR", "message": str(e)})
                        print(f"❌ {e}")
                        continue
                    except Exception as e:
                        await websocket.send_json({"type": "ERROR", "message": f"Error loading data: {str(e)}"})
                        print(f"❌ Data loading error: {e}")
                        continue

                    is_running = True
                    print(f"▶️ Simulation Started (Speed: {speed}x)")
                
                # --- OMS INTEGRATION (The Fix) ---
                elif command == "BUY":
                    oms.buy(last_tick_price, qty=50)
                
                elif command == "SELL":
                    oms.sell(last_tick_price, qty=50)
                # ---------------------------------

            except asyncio.TimeoutError:
                pass # No command received, keep streaming

            # B. STREAM DATA (Only if running)
            if is_running:
                # 1. Get Next Candle
                if using_real_data:
                    try:
                        row = next(iterator)
                        # Access via attributes (itertuples)
                        open_p, high, low, close = row.open, row.high, row.low, row.close
                        
                        # Handle date/datetime flexibility
                        row_date = getattr(row, 'date', None) or getattr(row, 'datetime', None)
                        base_time = pd.to_datetime(row_date)
                    except StopIteration:
                        print("🏁 End of Data. Restarting...")
                        iterator = df.itertuples(index=False)
                        continue
                else:
                    open_p, high, low, close = 21500, 21510, 21490, 21505
                    base_time = datetime.datetime.now()
                try:
                    # 1. Get Next Candle
                    if using_real_data:
                        try:
                            row = next(iterator)
                            # print(f"Processing row: {row}") # Debug log (verbose)
                            
                            # Safely extract OHLC with defaults/casting
                            try:
                                open_p = float(row.get('open', 0))
                                high = float(row.get('high', 0))
                                low = float(row.get('low', 0))
                                close = float(row.get('close', 0))
                                date_val = row.get('date') or row.get('datetime')
                                base_time = pd.to_datetime(date_val) if date_val else datetime.datetime.now()
                            except Exception as e:
                                print(f"❌ Error parsing row data: {e} | Row: {row}")
                                continue

                        except StopIteration:
                            print("🏁 End of Data for this date.")
                            # Stop or restart? For now, let's stop.
                            await websocket.send_json({"type": "END", "message": "Data finished for date"})
                            is_running = False
                            continue
                    else:
                        open_p, high, low, close = 21500.0, 21510.0, 21490.0, 21505.0
                        base_time = datetime.datetime.now()

                    # 2. Generate 60 Micro-Ticks
                    try:
                        ticks = synthesizer.generate_ticks(open_p, high, low, close, num_ticks=60)
                    except Exception as e:
                         print(f"❌ Synthesizer Error: {e} | Inputs: O={open_p} H={high} L={low} C={close}")
                         continue

                    # 3. Stream Ticks
                    for i, price in enumerate(ticks):
                        # Construct payload
                        payload = {
                            "type": "TICK",
                            "data": {
                                "symbol": symbol if using_real_data else "MOCK_NIFTY",
                                "price": round(price, 2),
                                "timestamp": (base_time + datetime.timedelta(seconds=i)).isoformat(),
                                "volume": int(row.get('volume', 0)) if using_real_data else 100
                            }
                        }
                        
                        # Check for client disconnect during streaming
                        try:
                            await websocket.send_json(payload)
                        except WebSocketDisconnect:
                            print("🔴 Client disconnected during streaming")
                            is_running = False
                            break
                        except Exception as e:
                             print(f"🔴 Send Error: {e}")
                             is_running = False
                             break

                        # Speed Control
                        # To make a 1-minute candle take exactly 60 seconds with 60 ticks:
                        # 60 ticks * 1.0 sec = 60 seconds.
                        await asyncio.sleep(1.0 / speed)
                    
                    # Send CANDLE message at end of minute
                    if is_running:
                         candle_msg = {
                            "type": "CANDLE",
                            "data": {
                                "open": open_p, "high": high, "low": low, "close": close,
                                "timestamp": base_time.isoformat()
                            }
                        }
                         try:
                            await websocket.send_json(candle_msg)
                         except:
                             break
                             
                except Exception as e:
                    print(f"❌ Critical Loop Error: {e}")
                    import traceback
                    traceback.print_exc()
                    is_running = False
                    await websocket.send_json({"type": "ERROR", "message": f"Server Error: {str(e)}"})

                # 3. Stream Loop (Batching)
                BATCH_SIZE = 10
                tick_batches = [ticks[i:i + BATCH_SIZE] for i in range(0, len(ticks), BATCH_SIZE)]
                
                for batch_index, batch_ticks in enumerate(tick_batches):
                    if not is_running: break 
                    
                    batch_data = []
                    for i, tick_price in enumerate(batch_ticks):
                        abs_index = (batch_index * BATCH_SIZE) + i
                        tick_time = base_time + datetime.timedelta(seconds=abs_index)
                        
                        # --- OMS UPDATE ---
                        last_tick_price = float(tick_price)
                        current_pnl = oms.calculate_pnl(last_tick_price)
                        # ------------------

                        batch_data.append({
                            "price": round(last_tick_price, 2),
                            "timestamp": tick_time.isoformat(),
                            "symbol": current_symbol or "UNKNOWN",
                            "pnl": round(current_pnl, 2)
                        })
                    
                    await websocket.send_json({"type": "BATCH", "data": batch_data})
                    await asyncio.sleep(0.1 / max(speed, 0.1))
            else:
                await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        print("🔴 Disconnected")
    except Exception as e:
        print(f"⚠️ Error: {e}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
