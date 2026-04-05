#!/usr/bin/env python3
"""
Robust 7-day rolling market data pipeline (Deployment Ready).
1. Fetches today's data (Shoonya -> yf fallback).
2. Manages a strictly rolling 7-day window of files.
3. Syncs data to Supabase (MarketCandle table).
4. Prunes oldest data (8th day) from both local and DB.
5. Sends an admin notification on success.
"""
import sys
import os
import glob
import pandas as pd
import yfinance as yf
import pyotp
import time
import logging
from datetime import datetime, timedelta, date
from sqlalchemy import text
from dotenv import load_dotenv

# Import our models and database utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import connect_to_database_sync, get_db_sync
from app.models import MarketCandle, Notification
from NorenRestApiPy.NorenApi import NorenApi

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Standard Shoonya Endpoint
API_ENDPOINT = "https://api.shoonya.com/NorenWClient/"

INSTRUMENTS = {
    'NIFTY':     {'token': '26000', 'exchange': 'NSE', 'ticker': '^NSEI'},
    'BANKNIFTY': {'token': '26009', 'exchange': 'NSE', 'ticker': '^NSEBANK'},
    'SENSEX':    {'token': '1',     'exchange': 'BSE', 'ticker': '^BSESN'},
    'HDFCBANK':  {'token': '1333',  'exchange': 'NSE', 'ticker': 'HDFCBANK.NS'},
    'RELIANCE':  {'token': '2885',  'exchange': 'NSE', 'ticker': 'RELIANCE.NS'},
}

class ShoonyaAPI(NorenApi):
    def __init__(self):
        NorenApi.__init__(self, host=API_ENDPOINT, websocket=API_ENDPOINT)

def login_shoonya():
    uid = os.getenv('SHOONYA_USER_ID', '').strip()
    pwd = os.getenv('SHOONYA_PASSWORD', '').strip()
    vc = os.getenv('SHOONYA_VENDOR_CODE', '').strip()
    sec = os.getenv('SHOONYA_API_SECRET', '').strip()
    totp_sec = os.getenv('SHOONYA_TOTP_SECRET', '').strip()
    
    if not all([uid, pwd, vc, sec, totp_sec]):
        logger.error(f"❌ Missing Shoonya credentials in .env: {[uid is not None, pwd is not None, vc is not None, sec is not None, totp_sec is not None]}")
        return None
    
    api = ShoonyaAPI()
    try:
        # Generate TOTP
        totp = pyotp.TOTP(totp_sec).now()
        logger.info(f"🔑 Attempting Shoonya Login for {uid} (TOTP: {totp})...")
        
        # SDK's login handles hashing internally. 
        # Ensure we pass the plain password and api_secret.
        ret = api.login(userid=uid, password=pwd, twoFA=totp, vendor_code=vc, api_secret=sec, imei='abc1234')
        
        if ret and ret.get('stat') == 'Ok':
            logger.info("✅ Shoonya Login Successful")
            return api
        else:
            logger.error(f"❌ Shoonya Login Failed: {ret.get('emsg') if ret else 'Connection Error'}")
    except Exception as e:
        logger.error(f"Shoonya Auth Error: {str(e)}")
    return None
    return None

def prune_old_data(data_dir, days=7):
    """Keep only latest N days of files."""
    cutoff = datetime.now() - timedelta(days=days)
    files = glob.glob(os.path.join(data_dir, "*.parquet"))
    removed = 0
    for f in files:
        try:
            # File format: SYMBOL_YYYY-MM-DD.parquet
            date_str = f.split('_')[-1].split('.')[0]
            file_date = datetime.strptime(date_str, '%Y-%m-%d')
            if file_date < cutoff:
                os.remove(f)
                removed += 1
        except: pass
    if removed: logger.info(f"🧹 Pruned {removed} old files from local storage.")

def sync_to_supabase(df, symbol):
    """Sync DataFrame to Supabase MarketCandle table with 7-day rolling purge."""
    engine = connect_to_database_sync()
    with engine.connect() as conn:
        # 1. Standardize columns
        # Expected: time (or parsed_date), into, inth, intl, intc, intv
        if 'parsed_time' not in df.columns:
            df['parsed_time'] = pd.to_datetime(df['time'].astype(str).str.replace('Ok ', '').str.strip(), 
                                               format='%d-%m-%Y %H:%M:%S', errors='coerce')
        
        # 2. Insert records
        # To avoid duplicates if script runs twice, we target unique (symbol, timestamp)
        # We delete existing records in the range we are about to insert
        start_time = df['parsed_time'].min()
        end_time = df['parsed_time'].max()
        conn.execute(text("DELETE FROM market_candles WHERE symbol = :s AND timestamp >= :st AND timestamp <= :et"), 
                     {"s": symbol, "st": start_time, "et": end_time})
        
        # Bulk Insert
        records = []
        for _, row in df.iterrows():
            if pd.isna(row['parsed_time']): continue
            records.append({
                "symbol": symbol,
                "timestamp": row['parsed_time'],
                "open": float(row['into']),
                "high": float(row['inth']),
                "low": float(row['intl']),
                "close": float(row['intc']),
                "volume": float(row['intv'])
            })
        
        if records:
            # Using raw SQL for speed in batch
            conn.execute(
                text("INSERT INTO market_candles (symbol, timestamp, open, high, low, close, volume) "
                     "VALUES (:symbol, :timestamp, :open, :high, :low, :close, :volume)"),
                records
            )
            conn.commit()
            
        # 3. Purge data older than 7 days in DB
        cutoff = datetime.now() - timedelta(days=7)
        conn.execute(text("DELETE FROM market_candles WHERE timestamp < :c"), {"c": cutoff})
        conn.commit()

def create_admin_alert(message):
    engine = connect_to_database_sync()
    with engine.connect() as conn:
        conn.execute(
            text("INSERT INTO notifications (title, content, type, is_read, created_at) "
                 "VALUES (:t, :c, :type, :r, :ca)"),
            {"t": "Market Data Sync ✅", "c": message, "type": "success", "r": False, "ca": datetime.utcnow()}
        )
        conn.commit()

def fetch_rolling_7days(days=1):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    api = login_shoonya()
    summary = []
    today_str = date.today().strftime('%Y-%m-%d')

    for sym, cfg in INSTRUMENTS.items():
        logger.info(f"🔍 Checking {sym} for the last {days} days...")
        
        for i in range(days):
            target_date = date.today() - timedelta(days=i)
            date_str = target_date.strftime('%Y-%m-%d')
            parquet_path = os.path.join(data_dir, f"{sym}_{date_str}.parquet")
            
            # 1. Check if we should skip
            if os.path.exists(parquet_path) and date_str != today_str:
                logger.info(f"⏭️ Skipping {sym} for {date_str} (Local file exists)")
                continue

            # 2. Robust Fetch with Retries (Shoonya -> yf)
            max_retries = 3
            current_delay = 2 # Initial retry delay
            
            for attempt in range(max_retries):
                logger.info(f"🔄 {sym} for {date_str} - Attempt {attempt+1}/{max_retries}")
                success = False
                df = None
                
                # --- TRY SHOONYA ---
                if api:
                    try:
                        d_start = datetime.combine(target_date, datetime.min.time())
                        d_end = datetime.combine(target_date, datetime.max.time())
                        logger.info(f"📡 Requesting {sym} from Shoonya...")
                        ret = api.get_time_price_series(exchange=cfg['exchange'], token=cfg['token'], 
                                                       starttime=d_start.timestamp(), endtime=d_end.timestamp(), interval=1)
                        if ret and isinstance(ret, list):
                            df = pd.DataFrame(ret)
                            success = True
                            logger.info(f"✅ Success from Shoonya for {sym}")
                    except Exception as e:
                        logger.warning(f"⚠️ Shoonya fetch error (Attempt {attempt+1}): {e}")

                # --- TRY YFINANCE FALLBACK ---
                if not success:
                    try:
                        logger.info(f"📡 Requesting {sym} from yfinance (Fallback)...")
                        yf_start = target_date.strftime('%Y-%m-%d')
                        yf_end = (target_date + timedelta(days=1)).strftime('%Y-%m-%d')
                        df_yf = yf.download(cfg['ticker'], start=yf_start, end=yf_end, interval="1m", progress=False)
                        
                        if df_yf is not None and not df_yf.empty:
                            if isinstance(df_yf.columns, pd.MultiIndex):
                                df_yf.columns = df_yf.columns.get_level_values(0)
                            
                            df = df_yf.rename(columns={'Open': 'into', 'High': 'inth', 'Low': 'intl', 'Close': 'intc', 'Volume': 'intv'})
                            df['time'] = "Ok " + df.index.strftime('%d-%m-%Y %H:%M:%S')
                            success = True
                            logger.info(f"✅ Success from yfinance for {sym}")
                        else:
                            logger.info(f"📅 No data returned for {sym} on {date_str} (Likely holiday/weekend).")
                            summary.append(f"{sym} ({date_str}): holiday/empty.")
                            success = True # Mark success as True so it doesn't retry, but df is None
                            break 
                    except Exception as e:
                        # yfinance 0.2.36+ raises actual exceptions on failure if configured,
                        # but standard usage often just prints to stderr. 
                        # We check for tell-tale weekend/holiday strings in the error.
                        err_str = str(e).lower()
                        if "pricesmissingerror" in err_str or "no price data found" in err_str:
                            logger.info(f"📅 No price data found for {sym} on {date_str} (Likely holiday/weekend).")
                            summary.append(f"{sym} ({date_str}): holiday/empty.")
                            break # Don't retry holidays
                        
                        if "ratelimiterror" in err_str or "too many requests" in err_str:
                            logger.warning(f"🛑 Rate Limited by yfinance. Sleeping for 60 seconds before retry...")
                            time.sleep(60)
                            # We don't increment attempt here in a real "fetch all" mode
                            # but for now we increase retry count
                            max_retries = 10 
                        
                        logger.error(f"❌ yfinance fallback error (Attempt {attempt+1}/{max_retries}): {e}")

                # If successful, process and break retry loop
                if success and df is not None and not df.empty:
                    # Save local parquet
                    df['parsed_date'] = pd.to_datetime(df['time'].astype(str).str.replace('Ok ', '').str.strip(), 
                                                       format='%d-%m-%Y %H:%M:%S', errors='coerce').dt.strftime('%Y-%m-%d')
                    
                    # Filter just in case yf gave us more than one day
                    day_df = df[df['parsed_date'] == date_str]
                    if not day_df.empty:
                        day_df[['time', 'into', 'inth', 'intl', 'intc', 'intv']].to_parquet(parquet_path, index=False)
                        
                        # Sync to Supabase
                        try:
                            sync_to_supabase(day_df, sym)
                            summary.append(f"{sym} ({date_str}): synced (Attempt {attempt+1}).")
                        except Exception as e:
                            logger.error(f"Supabase sync failed for {sym}: {e}")
                            summary.append(f"{sym} ({date_str}): local only.")
                        break # Exit retry loop on success
                    else:
                        logger.warning(f"No data matched {date_str} for {sym}. May be non-trading day.")
                        # This isn't necessarily a failure to fetch, just empty market. Don't retry.
                        summary.append(f"{sym} ({date_str}): holiday/empty.")
                        break
                
                # If we get here, this attempt failed. Slow down before next attempt.
                if attempt < max_retries - 1:
                    logger.info(f"🛑 Attempt {attempt+1} failed. Slowing down... Waiting {current_delay * 2}s")
                    time.sleep(current_delay * 2)
                    current_delay *= 2 # Exponential backoff
                else:
                    logger.error(f"💀 All retries failed for {sym} on {date_str}")
                    summary.append(f"{sym} ({date_str}): FAILED.")

            time.sleep(3) # Base delay between days to prevent rate limiting

    # Final Prune and Alert
    prune_old_data(data_dir)
    alert_msg = "\n".join(summary[:20]) + ("\n..." if len(summary) > 20 else "")
    create_admin_alert(f"Optimized Sync Results:\n{alert_msg}")
    logger.info("🏁 Pipeline complete.")

if __name__ == "__main__":
    # Check if a custom days count was passed
    days_to_fetch = 1
    if len(sys.argv) > 1:
        try:
            days_to_fetch = int(sys.argv[1])
        except: pass
    
    fetch_rolling_7days(days=days_to_fetch)
