#!/usr/bin/env python3
"""
Data upload script for TradeShift
Uploads parquet files to MinIO and records metadata in TimescaleDB
"""
import os
import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
from sqlalchemy import create_engine, text
from minio import Minio
from minio.error import S3Error

from dotenv import load_dotenv

# Add the parent directory to path for imports if needed
BASE_DIR = Path(__file__).parent.parent
sys.path.append(str(BASE_DIR))

# Load environment variables from .env file
load_dotenv(BASE_DIR / ".env")

# Configuration - using environment variables
# If run from host, MINIO_ENDPOINT usually needs to be localhost:9000
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000").replace("minio:9000", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
BUCKET_NAME = os.getenv("MINIO_BUCKET", "market-data")
DATABASE_URL = os.getenv("DATABASE_URL")

# Local path where parquet files are stored
DATA_PATH = str(BASE_DIR / "data")

def initialize_minio_client():
    """Initialize MinIO client"""
    # Remove protocol if present for MinIO client
    endpoint = MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
    return Minio(
        endpoint,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False
    )

def ensure_bucket_exists(client):
    """Create bucket if it doesn't exist"""
    try:
        if not client.bucket_exists(BUCKET_NAME):
            client.make_bucket(BUCKET_NAME)
            print(f"✅ Created bucket: {BUCKET_NAME}")
        else:
            print(f"✅ Bucket {BUCKET_NAME} already exists")
    except S3Error as e:
        print(f"❌ Error creating bucket: {e}")
        raise

def create_metadata_table(engine):
    """Create metadata table if it doesn't exist"""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS index_metadata (
                id SERIAL PRIMARY KEY,
                instrument VARCHAR(50) NOT NULL,
                interval VARCHAR(10) NOT NULL,
                start_date TIMESTAMP NOT NULL,
                end_date TIMESTAMP NOT NULL,
                rows_count INTEGER NOT NULL,
                parquet_path VARCHAR(255) NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                bucket_name VARCHAR(100) NOT NULL,
                object_name VARCHAR(255) NOT NULL,
                UNIQUE(instrument, interval, object_name)
            );
        """))
        conn.commit()
    print("✅ Created/verified metadata table")

def upload_parquet_file(client, file_path, engine):
    """Upload a single parquet file and record metadata"""
    try:
        file_name = os.path.basename(file_path)
        
        # Extract instrument name from filename
        # Support formats like:
        # NIFTY_50_1min.parquet -> NIFTY_50
        # BANKNIFTY_2026-03-30.parquet -> BANKNIFTY
        instrument = file_name.replace(".parquet", "").rsplit("_", 1)[0]
        
        # Object name in MinIO
        object_name = f"indices/{file_name}"
        
        print(f"📤 Uploading {file_name}...")
        
        # Upload to MinIO
        client.fput_object(
            BUCKET_NAME,
            object_name,
            file_path,
            content_type="application/parquet"
        )
        
        # Read metadata from parquet file
        df = pd.read_parquet(file_path)
        
        # Find time column
        time_col = next((c for c in ['date', 'datetime', 'time', 'timestamp'] if c in df.columns), None)
        if time_col is None:
            print(f"❌ Error: Cannot find time column in {file_name}")
            return False

        # Clean timestamps (e.g., "Ok 30-03-2026 03:45:00")
        try:
            # Convert to string and strip "Ok " prefix if present, then parse
            df[time_col] = pd.to_datetime(
                df[time_col].astype(str).str.replace('Ok ', '', regex=False),
                dayfirst=True,
                errors='coerce'
            )
            # Remove any NaT values that might have failed to parse
            df = df.dropna(subset=[time_col])
        except Exception as e:
            print(f"⚠️ Warning: Could not fully clean timestamps: {e}")
            
        start_date = df[time_col].min() if len(df) > 0 else datetime.now()
        end_date = df[time_col].max() if len(df) > 0 else datetime.now()
        
        # Insert/Update metadata into database
        with engine.connect() as conn:
            # Insert new entry or update existing if same file (object_name)
            conn.execute(text("""
                INSERT INTO index_metadata 
                (instrument, interval, start_date, end_date, rows_count, 
                 parquet_path, bucket_name, object_name)
                VALUES (:instrument, '1min', :start_date, :end_date, :rows_count,
                        :parquet_path, :bucket_name, :object_name)
                ON CONFLICT (instrument, interval, object_name) DO UPDATE SET
                    start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date,
                    rows_count = EXCLUDED.rows_count,
                    uploaded_at = CURRENT_TIMESTAMP
            """), {
                'instrument': instrument,
                'start_date': start_date,
                'end_date': end_date,
                'rows_count': len(df),
                'parquet_path': object_name,
                'bucket_name': BUCKET_NAME,
                'object_name': object_name
            })
            conn.commit()
        
        print(f"✅ Uploaded: {instrument} ({len(df)} rows)")
        return True
        
    except Exception as e:
        print(f"❌ Error uploading {file_path}: {e}")
        return False

def main():
    """Main upload function"""
    print("🚀 Starting data upload process...")
    print("=" * 50)
    
    # Check if data directory exists
    if not os.path.exists(DATA_PATH):
        print(f"❌ Data directory not found: {DATA_PATH}")
        print("Please mount the data directory in docker-compose.yml")
        sys.exit(1)
    
    # Initialize clients
    minio_client = initialize_minio_client()
    db_engine = create_engine(DATABASE_URL)
    
    # Setup
    ensure_bucket_exists(minio_client)
    create_metadata_table(db_engine)
    
    # Find all parquet files
    parquet_files = []
    for root, dirs, files in os.walk(DATA_PATH):
        for file in files:
            if file.endswith('.parquet'):
                parquet_files.append(os.path.join(root, file))
    
    if not parquet_files:
        print("❌ No parquet files found in data directory")
        sys.exit(1)
    
    print(f"📁 Found {len(parquet_files)} parquet files")
    
    # Upload each file
    successful = 0
    failed = 0
    
    for file_path in parquet_files:
        if upload_parquet_file(minio_client, file_path, db_engine):
            successful += 1
        else:
            failed += 1
    
    print("=" * 50)
    print(f"📊 Upload Summary:")
    print(f"   ✅ Successful: {successful}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📂 Total: {len(parquet_files)}")
    
    if successful > 0:
        print("✨ Data upload completed successfully!")
    else:
        print("💥 No files were uploaded successfully")

if __name__ == "__main__":
    main()
