#!/usr/bin/env python3
"""
Data management script for TradeShift
Allows listing, deleting, and pruning market data from MinIO and Supabase.
"""
import os
import sys
import argparse
from pathlib import Path
from sqlalchemy import create_engine, text
from minio import Minio
from dotenv import load_dotenv

# Add the parent directory to path for imports
BASE_DIR = Path(__file__).parent.parent
sys.path.append(str(BASE_DIR))
load_dotenv(BASE_DIR / ".env")

# Config
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000").replace("minio:9000", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
BUCKET_NAME = os.getenv("MINIO_BUCKET", "market-data")
DATABASE_URL = os.getenv("DATABASE_URL")

def get_clients():
    endpoint = MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
    minio_client = Minio(endpoint, access_key=MINIO_ACCESS_KEY, secret_key=MINIO_SECRET_KEY, secure=False)
    db_engine = create_engine(DATABASE_URL)
    return minio_client, db_engine

def list_data(engine):
    print("\n📊 Current Data in System:")
    print("-" * 60)
    query = text("""
        SELECT instrument, TO_CHAR(start_date, 'YYYY-MM-DD') as date, rows_count, object_name 
        FROM index_metadata 
        ORDER BY instrument, start_date DESC
    """)
    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()
        if not rows:
            print("No data found.")
            return
        
        current_instrument = ""
        for row in rows:
            if row[0] != current_instrument:
                current_instrument = row[0]
                print(f"\n🔹 {current_instrument}:")
            print(f"   - {row[1]} ({row[2]} rows) | Object: {row[3]}")
    print("-" * 60)

def delete_data(minio_client, engine, symbol=None, date=None):
    if not symbol and not date:
        print("❌ Please specify --symbol or both --symbol and --date")
        return

    # 1. Identify objects to delete
    if date:
        query = text("SELECT object_name FROM index_metadata WHERE instrument = :s AND TO_CHAR(start_date, 'YYYY-MM-DD') = :d")
        params = {"s": symbol, "d": date}
        msg = f"Deleting {symbol} for date {date}..."
    else:
        query = text("SELECT object_name FROM index_metadata WHERE instrument = :s")
        params = {"s": symbol}
        msg = f"Deleting ALL data for {symbol}..."

    print(f"📤 {msg}")
    
    with engine.connect() as conn:
        rows = conn.execute(query, params).fetchall()
        objects_to_delete = [row[0] for row in rows]

        if not objects_to_delete:
            print("⚠️ No matching data found.")
            return

        # 2. Delete from MinIO
        for obj in objects_to_delete:
            try:
                minio_client.remove_object(BUCKET_NAME, obj)
                print(f"   ✅ Removed from MinIO: {obj}")
            except Exception as e:
                print(f"   ❌ MinIO Error for {obj}: {e}")

        # 3. Delete from Supabase
        if date:
            del_query = text("DELETE FROM index_metadata WHERE instrument = :s AND TO_CHAR(start_date, 'YYYY-MM-DD') = :d")
        else:
            del_query = text("DELETE FROM index_metadata WHERE instrument = :s")
        
        conn.execute(del_query, params)
        conn.commit()
        print(f"   ✅ Metadata removed from Supabase.")

def prune_data(minio_client, engine, days=7):
    print(f"🧹 Pruning data: Keeping only the last {days} trading days per instrument...")
    
    # Query to find objects that are NOT in the top N for each instrument
    query = text("""
        SELECT object_name, instrument, start_date 
        FROM (
            SELECT object_name, instrument, start_date,
                   ROW_NUMBER() OVER (PARTITION BY instrument ORDER BY start_date DESC) as rank
            FROM index_metadata
        ) t
        WHERE rank > :days
    """)
    
    with engine.connect() as conn:
        rows = conn.execute(query, {"days": days}).fetchall()
        if not rows:
            print("✅ Nothing to prune. System is already lean.")
            return

        print(f"Found {len(rows)} old files to remove.")
        
        for row in rows:
            obj, instrument, dt = row
            # Delete from MinIO
            try:
                minio_client.remove_object(BUCKET_NAME, obj)
                print(f"   - Removed {obj} ({dt.date()})")
            except: pass
            
            # Delete from Metadata
            conn.execute(text("DELETE FROM index_metadata WHERE object_name = :obj"), {"obj": obj})
        
        conn.commit()
        print(f"✨ Pruning complete.")

def main():
    parser = argparse.ArgumentParser(description="TradeShift Data Manager")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    subparsers.add_parser("list", help="List all symbols and dates")
    
    del_parser = subparsers.add_parser("delete", help="Delete specific data")
    del_parser.add_argument("--symbol", required=True, help="Instrument symbol")
    del_parser.add_argument("--date", help="Specific date (YYYY-MM-DD)")
    
    prune_parser = subparsers.add_parser("prune", help="Prune old data")
    prune_parser.add_argument("--days", type=int, default=7, help="Number of days to keep (default: 7)")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return

    minio, engine = get_clients()
    
    if args.command == "list":
        list_data(engine)
    elif args.command == "delete":
        delete_data(minio, engine, args.symbol, args.date)
    elif args.command == "prune":
        prune_data(minio, engine, args.days)

if __name__ == "__main__":
    main()
