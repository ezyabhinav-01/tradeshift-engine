#!/usr/bin/env python3
"""
Script to fetch historical data from Shoonya/Finvasia using NorenApi library.

This script:
1. Logs in using NorenApi with TOTP 2FA authentication
2. Fetches historical time-price series data for specified instruments
3. Saves the data as Parquet files in the data/ directory
4. Handles NIFTY and BANKNIFTY for the last 30 days
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

# Load environment variables from .env file
load_dotenv()

# API Configuration
API_ENDPOINT = "https://api.shoonya.com/NorenWClientTP/"

# Instrument configurations
INSTRUMENTS = {
    'NIFTY': {
        'token': '26000',
        'exchange': 'NSE'
    },
    'BANKNIFTY': {
        'token': '26009',
        'exchange': 'NSE'
    }
}


class ShoonyaAPI(NorenApi):
    """
    Custom wrapper for NorenApi to handle Shoonya/Finvasia API interactions.
    """
    def __init__(self):
        NorenApi.__init__(self, host=API_ENDPOINT, websocket=API_ENDPOINT)


def login_to_api():
    """
    Login to Shoonya API using credentials from environment variables and TOTP.
    
    Returns:
        NorenApi: Authenticated API instance
    """
    print("🔐 Logging in to Shoonya API...")
    
    # Get credentials from environment variables
    user_id = os.getenv('SHOONYA_USER_ID')
    password = os.getenv('SHOONYA_PASSWORD')
    vendor_code = os.getenv('SHOONYA_VENDOR_CODE')
    api_secret = os.getenv('SHOONYA_API_SECRET')
    imei = os.getenv('SHOONYA_IMEI', 'abc1234')
    totp_secret = os.getenv('SHOONYA_TOTP_SECRET')
    
    # Validate required credentials
    if not all([user_id, password, vendor_code, api_secret, totp_secret]):
        raise ValueError(
            "Missing required credentials. Please check your .env file.\n"
            "Required: SHOONYA_USER_ID, SHOONYA_PASSWORD, SHOONYA_VENDOR_CODE, "
            "SHOONYA_API_SECRET, SHOONYA_TOTP_SECRET"
        )
    
    # Generate TOTP for 2FA
    totp = pyotp.TOTP(totp_secret)
    totp_code = totp.now()
    print(f"🔑 Generated TOTP: {totp_code}")
    
    # Initialize API
    api = ShoonyaAPI()
    
    # Login
    try:
        ret = api.login(
            userid=user_id,
            password=password,
            twoFA=totp_code,
            vendor_code=vendor_code,
            api_secret=api_secret,
            imei=imei
        )
        
        if ret is None or not ret.get('susertoken'):
            raise Exception(f"Login failed: {ret}")
        
        print("✅ Login successful!")
        print(f"   User ID: {user_id}")
        print(f"   Session Token: {ret.get('susertoken')[:20]}...")
        
        return api
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        raise


def download_history(api, symbol, symbol_token, exchange='NSE', days=30):
    """
    Download historical data for a given instrument.
    
    Args:
        api (NorenApi): Authenticated API instance
        symbol (str): Symbol name (e.g., 'NIFTY', 'BANKNIFTY')
        symbol_token (str): Token ID for the symbol
        exchange (str): Exchange name (default: 'NSE')
        days (int): Number of days of historical data to fetch
        
    Returns:
        pd.DataFrame: DataFrame containing the historical data
    """
    print(f"\n📊 Fetching {days} days of historical data for {symbol}...")
    
    # Calculate date range
    end_time = datetime.now()
    start_time = end_time - timedelta(days=days)
    
    # Format dates as required by API (DD-MM-YYYY)
    start_date_str = start_time.strftime('%d-%m-%Y')
    end_date_str = end_time.strftime('%d-%m-%Y')
    
    print(f"   Exchange: {exchange}")
    print(f"   Token: {symbol_token}")
    print(f"   Date Range: {start_date_str} to {end_date_str}")
    
    try:
        # Fetch time-price series data
        # interval: 1 = 1 minute candles
        ret = api.get_time_price_series(
            exchange=exchange,
            token=symbol_token,
            starttime=start_time.timestamp(),
            endtime=end_time.timestamp(),
            interval=1
        )
        
        if ret is None:
            raise Exception(f"Failed to fetch data for {symbol}")
        
        # Check if data is available
        if isinstance(ret, dict) and ret.get('stat') == 'Not_Ok':
            raise Exception(f"API Error: {ret.get('emsg', 'Unknown error')}")
        
        print(f"✅ Received {len(ret)} data points for {symbol}")
        
        # Convert to DataFrame
        df = pd.DataFrame(ret)
        
        # Display column names
        if not df.empty:
            print(f"   Columns: {list(df.columns)}")
            print(f"   Sample data:\n{df.head(2)}")
        
        return df
        
    except Exception as e:
        print(f"❌ Error fetching data for {symbol}: {e}")
        raise


def save_to_parquet(df, symbol, base_path='data'):
    """
    Save DataFrame to Parquet file(s) organized by year.
    
    Args:
        df (pd.DataFrame): DataFrame to save
        symbol (str): Symbol name for filename
        base_path (str): Base directory path (default: 'data')
    """
    if df.empty:
        print(f"⚠️  No data to save for {symbol}")
        return
    
    print(f"\n💾 Saving data for {symbol}...")
    
    # Ensure data directory exists
    os.makedirs(base_path, exist_ok=True)
    
    # Convert time column to datetime if it exists
    time_column = None
    for col in ['time', 't', 'datetime', 'timestamp']:
        if col in df.columns:
            time_column = col
            break
    
    if time_column:
        # Convert to datetime if not already
        if not pd.api.types.is_datetime64_any_dtype(df[time_column]):
            # Try to convert from Unix timestamp or string
            try:
                df[time_column] = pd.to_datetime(df[time_column], unit='s')
            except:
                df[time_column] = pd.to_datetime(df[time_column])
        
        # Extract year
        df['year'] = df[time_column].dt.year
        
        # Group by year and save separately
        years = df['year'].unique()
        
        for year in years:
            year_df = df[df['year'] == year].copy()
            year_df = year_df.drop(columns=['year'])
            
            filename = f"{symbol}_{year}.parquet"
            filepath = os.path.join(base_path, filename)
            
            # Save as Parquet
            year_df.to_parquet(filepath, engine='pyarrow', index=False)
            
            print(f"✅ Saved {len(year_df)} records to {filepath}")
    else:
        # No time column, save all data in one file with current year
        current_year = datetime.now().year
        filename = f"{symbol}_{current_year}.parquet"
        filepath = os.path.join(base_path, filename)
        
        df.to_parquet(filepath, engine='pyarrow', index=False)
        
        print(f"✅ Saved {len(df)} records to {filepath}")


def main():
    """
    Main function to orchestrate the historical data download process.
    """
    print("=" * 70)
    print("🚀 Shoonya Historical Data Fetch Script")
    print("=" * 70)
    
    try:
        # Step 1: Login to API
        api = login_to_api()
        
        # Step 2: Fetch and save data for each instrument
        for symbol, config in INSTRUMENTS.items():
            try:
                # Fetch historical data
                df = download_history(
                    api=api,
                    symbol=symbol,
                    symbol_token=config['token'],
                    exchange=config['exchange'],
                    days=30
                )
                
                # Save to Parquet
                save_to_parquet(df, symbol)
                
                # Small delay between requests to avoid rate limiting
                time.sleep(1)
                
            except Exception as e:
                print(f"⚠️  Failed to process {symbol}: {e}")
                continue
        
        print("\n" + "=" * 70)
        print("✅ Historical Data Fetch Completed Successfully!")
        print("=" * 70)
        
    except Exception as e:
        print("\n" + "=" * 70)
        print(f"❌ Script failed with error: {e}")
        print("=" * 70)
        sys.exit(1)


if __name__ == "__main__":
    main()


#run python scripts/fetch_history.py