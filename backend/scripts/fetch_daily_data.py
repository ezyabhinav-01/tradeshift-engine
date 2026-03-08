#!/usr/bin/env python3
"""
Script to fetch the last 7 days of 1-minute historical data for specific equities/indices.
Run this script manually (e.g., at 3:30 PM daily) to refresh the data for replay.
"""

import sys
import os
from datetime import datetime, timedelta
import pandas as pd
import pyotp
from dotenv import load_dotenv
from NorenRestApiPy.NorenApi import NorenApi
import time

# Ensure the parent directory is in the sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

API_ENDPOINT = "https://api.shoonya.com/NorenWClientTP/"

# Our 5 specific instruments
INSTRUMENTS = {
    'NIFTY':     {'token': '26000', 'exchange': 'NSE'},
    'BANKNIFTY': {'token': '26009', 'exchange': 'NSE'},
    'SENSEX':    {'token': '1',     'exchange': 'BSE'},
    'HDFCBANK':  {'token': '1333',  'exchange': 'NSE'},
    'RELIANCE':  {'token': '2885',  'exchange': 'NSE'},
}

class ShoonyaAPI(NorenApi):
    def __init__(self):
        NorenApi.__init__(self, host=API_ENDPOINT, websocket=API_ENDPOINT)

def login_to_api():
    print("🔐 Logging in to Shoonya API...")
    user_id = os.getenv('SHOONYA_USER_ID')
    password = os.getenv('SHOONYA_PASSWORD')
    vendor_code = os.getenv('SHOONYA_VENDOR_CODE')
    api_secret = os.getenv('SHOONYA_API_SECRET')
    imei = os.getenv('SHOONYA_IMEI', 'abc1234')
    totp_secret = os.getenv('SHOONYA_TOTP_SECRET')
    
    if not all([user_id, password, vendor_code, api_secret, totp_secret]):
        raise ValueError("Missing required credentials in .env file.")
    
    totp = pyotp.TOTP(totp_secret)
    totp_code = totp.now()
    
    api = ShoonyaAPI()
    try:
        ret = api.login(
            userid=user_id, password=password, twoFA=totp_code,
            vendor_code=vendor_code, api_secret=api_secret, imei=imei
        )
        if ret is None or not ret.get('susertoken'):
            raise Exception(f"Login failed: {ret}")
        print("✅ Login successful!")
        return api
    except Exception as e:
        print(f"❌ Login error: {e}")
        raise

def download_last_7_days(api, symbol, config):
    days = 7
    print(f"\n📊 Fetching {days} days of data for {symbol} (day by day)...")
    
    all_data = []
    end_time_ref = datetime.now()
    
    # Loop backwards day by day
    for i in range(days):
        # Calculate start and end for exactly 1 day
        day_end = end_time_ref - timedelta(days=i)
        day_start = day_end - timedelta(days=1)
        
        try:
            ret = api.get_time_price_series(
                exchange=config['exchange'],
                token=config['token'],
                starttime=day_start.timestamp(),
                endtime=day_end.timestamp(),
                interval=1
            )
            
            # Not Ok could mean market was closed that day, just skip
            if ret is None or (isinstance(ret, dict) and ret.get('stat') == 'Not_Ok'):
                print(f"   ℹ️ No data or error for {symbol} on {day_start.date()}: {ret.get('emsg', 'Unknown') if isinstance(ret, dict) else 'None'}")
                continue
            
            print(f"   ✅ Received {len(ret)} data points for {symbol} on {day_start.date()}")
            df_day = pd.DataFrame(ret)
            all_data.append(df_day)
            
            # API rate limit protection between day fetches
            time.sleep(0.5)
            
        except Exception as e:
            print(f"❌ Error fetching {symbol} on {day_start.date()}: {e}")
            continue

    if not all_data:
        print(f"⚠️ No data could be fetched for {symbol} across {days} days.")
        return pd.DataFrame()
        
    # Combine all valid days into one DataFrame
    final_df = pd.concat(all_data, ignore_index=True)
    print(f"🏁 Total {len(final_df)} combined records fetched for {symbol}")
    return final_df

def save_data(df, symbol):
    if df.empty:
        print(f"⚠️  No data to save for {symbol}")
        return
        
    base_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    os.makedirs(base_path, exist_ok=True)
    
    # Shoonya time comes back in 'time' mostly
    time_col = next((c for c in ['datetime', 'date', 'time'] if c in df.columns), None)
    if not time_col:
        print(f"⚠️  Could not find time column for {symbol}. Saving as one file.")
        filepath = os.path.join(base_path, f"{symbol}.parquet")
        df.to_parquet(filepath, engine='pyarrow', index=False)
        return

    # Parse time
    df['parsed_time'] = pd.to_datetime(
        df[time_col].astype(str).str.replace('Ok ', '', regex=False).str.strip(), 
        format='%d-%m-%Y %H:%M:%S', errors='coerce'
    )
    
    # Group by date
    df['date_only'] = df['parsed_time'].dt.date
    groups = df.groupby('date_only')
    
    for dt_obj, group_df in groups:
        if pd.isna(dt_obj): continue
        date_str = str(dt_obj)
        filepath = os.path.join(base_path, f"{symbol}_{date_str}.parquet")
        # Drop temporary columns
        clean_df = group_df.drop(columns=['parsed_time', 'date_only'])
        clean_df.to_parquet(filepath, engine='pyarrow', index=False)
        print(f"💾 Saved {len(clean_df)} records to {filepath}")

def main():
    print("=" * 60)
    print("🚀 Shoonya Daily 7-Day Fetch Script (3:30 PM Run)")
    print("=" * 60)
    
    try:
        api = login_to_api()
        for symbol, config in INSTRUMENTS.items():
            try:
                df = download_last_7_days(api, symbol, config)
                save_data(df, symbol)
                time.sleep(1) # Rate limit protection
            except Exception:
                continue
                
        print("\n✅ Daily Fetch Completed!")
    except Exception as e:
        print(f"❌ Script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
