import os
import glob
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys

# Add the current directory to sys.path to allow importing app
sys.path.append(os.getcwd())

from app.models import InstrumentMaster, Base
from app.database import connect_to_database_sync

def populate():
    print("🚀 Starting Instrument Population...")
    engine = connect_to_database_sync()
    
    # Ensure tables are created (in case main.py hasn't run yet)
    Base.metadata.create_all(bind=engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()

    data_dir = os.path.join(os.getcwd(), "data")
    parquet_files = glob.glob(os.path.join(data_dir, "*.parquet"))
    
    print(f"📂 Found {len(parquet_files)} parquet files in {data_dir}")
    
    seen_symbols = set()
    count = 0

    # 1. Add Indices first
    indices = [
        {"symbol": "NIFTY", "name": "NIFTY 50", "type": "INDEX", "token": "26000"},
        {"symbol": "BANKNIFTY", "name": "NIFTY BANK", "type": "INDEX", "token": "26009"},
        {"symbol": "FINNIFTY", "name": "NIFTY FIN SERVICE", "type": "INDEX", "token": "26037"},
        {"symbol": "MIDCPNIFTY", "name": "NIFTY MID SELECT", "type": "INDEX", "token": "26074"},
    ]
    
    for idx_data in indices:
        existing = session.query(InstrumentMaster).filter_by(symbol=idx_data["symbol"]).first()
        if not existing:
            instr = InstrumentMaster(
                symbol=idx_data["symbol"],
                name=idx_data["name"],
                instrument_type=idx_data["type"],
                token=idx_data["token"],
                exchange="NSE"
            )
            session.add(instr)
            seen_symbols.add(idx_data["symbol"])
            count += 1

    # 2. Add symbols from parquet files
    for f in parquet_files:
        basename = os.path.basename(f)
        # Handle NIFTY_50_... or RELIANCE_...
        symbol_part = basename.split('_')[0]
        if "NIFTY_50" in basename: symbol_part = "NIFTY_50"
        elif "NIFTY_BANK" in basename: symbol_part = "BANKNIFTY"
        
        if symbol_part in seen_symbols:
            continue
            
        # Try to get a token if it's a known stock
        token = "0"
        if symbol_part == "RELIANCE": token = "2885"
        elif symbol_part == "HDFCBANK": token = "1333"
        elif symbol_part == "ICICIBANK": token = "4963"
        
        instr = InstrumentMaster(
            symbol=symbol_part,
            name=symbol_part.replace('_', ' '),
            instrument_type="EQUITY" if "NIFTY" not in symbol_part else "INDEX",
            token=token if token != "0" else str(hash(symbol_part) % 100000),
            exchange="NSE"
        )
        session.add(instr)
        seen_symbols.add(symbol_part)
        count += 1
        print(f"➕ Added {symbol_part}")

    session.commit()
    print(f"✅ Population Complete! Added {count} instruments.")
    session.close()

if __name__ == "__main__":
    populate()
