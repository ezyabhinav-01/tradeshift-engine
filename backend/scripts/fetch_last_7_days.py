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

API_ENDPOINT = "https://api.shoonya.com/NorenWClientTP/"

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
    uid, pwd, vc, sec, totp_sec = os.getenv('SHOONYA_USER_ID'), os.getenv('SHOONYA_PASSWORD'), \
                                   os.getenv('SHOONYA_VENDOR_CODE'), os.getenv('SHOONYA_API_SECRET'), \
                                   os.getenv('SHOONYA_TOTP_SECRET')
    if not all([uid, pwd, vc, sec, totp_sec]):
        return None
    api = ShoonyaAPI()
    try:
        totp = pyotp.TOTP(totp_sec).now()
        ret = api.login(userid=uid, password=pwd, twoFA=totp, vendor_code=vc, api_secret=sec, imei='abc1234')
        if ret and ret.get('stat') == 'Ok':
            return api
    except Exception as e:
        logger.error(f"Shoonya Auth Error: {e}")
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

    for sym, cfg in INSTRUMENTS.items():
        success = False
        df = None
        
        # 1. Try Shoonya
        if api:
            logger.info(f"📡 Fetching {sym} from Shoonya (up to {days} days)...")
            end_ref = datetime.now()
            all_days = []
            for i in range(days):
                d_end = end_ref - timedelta(days=i)
                d_start = d_end - timedelta(days=1)
                try:
                    ret = api.get_time_price_series(exchange=cfg['exchange'], token=cfg['token'], 
                                                   starttime=d_start.timestamp(), endtime=d_end.timestamp(), interval=1)
                    if ret and isinstance(ret, list):
                        all_days.append(pd.DataFrame(ret))
                    time.sleep(0.2)
                except: pass
            if all_days:
                df = pd.concat(all_days, ignore_index=True)
                success = True
        
        # 2. Try yfinance Fallback
        if not success:
            logger.info(f"📡 Fallback: Fetching {sym} from yfinance ({days}d)...")
            try:
                # yfinance 1m data limited to last 7 days.
                period_str = f"{days}d" if days <= 7 else "7d"
                df_yf = yf.download(cfg['ticker'], period=period_str, interval="1m", progress=False)
                if df_yf is not None and not df_yf.empty:
                    # ⚠️ Handle potential MultiIndex columns from yfinance
                    if isinstance(df_yf.columns, pd.MultiIndex):
                        df_yf.columns = df_yf.columns.get_level_values(0)
                    
                    df = df_yf.rename(columns={'Open': 'into', 'High': 'inth', 'Low': 'intl', 'Close': 'intc', 'Volume': 'intv'})
                    df['time'] = "Ok " + df.index.strftime('%d-%m-%Y %H:%M:%S')
                    success = True
            except Exception as e:
                logger.error(f"Fallback failed for {sym}: {e}")

        # 3. Process Success
        if success and df is not None and not df.empty:
            # Save local parquet (for legacy support/replay)
            # Infer date for filename
            df['parsed_date'] = pd.to_datetime(df['time'].astype(str).str.replace('Ok ', '').str.strip(), 
                                               format='%d-%m-%Y %H:%M:%S', errors='coerce').dt.strftime('%Y-%m-%d')
            for d_str, group in df.groupby('parsed_date'):
                if pd.isna(d_str): continue
                path = os.path.join(data_dir, f"{sym}_{d_str}.parquet")
                group[['time', 'into', 'inth', 'intl', 'intc', 'intv']].to_parquet(path, index=False)
            
            # Sync to Supabase
            try:
                sync_to_supabase(df, sym)
                summary.append(f"{sym}: synced.")
            except Exception as e:
                logger.error(f"Supabase sync failed for {sym}: {e}")
                summary.append(f"{sym}: local only.")
        else:
             summary.append(f"{sym}: failed.")
             
        time.sleep(0.5)

    # Final Prune and Alert
    prune_old_data(data_dir)
    alert_msg = "\n".join(summary)
    create_admin_alert(f"7-Day Rolling Pipeline Results:\n{alert_msg}")
    logger.info("🏁 Pipeline complete.")

if __name__ == "__main__":
    # Check if a custom days count was passed
    days_to_fetch = 1
    if len(sys.argv) > 1:
        try:
            days_to_fetch = int(sys.argv[1])
        except: pass
    
    fetch_rolling_7days(days=days_to_fetch)
