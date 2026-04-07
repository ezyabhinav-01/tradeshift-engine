import os
import glob
from datetime import datetime
from app.database import connect_to_database_sync
from sqlalchemy import text

def seed_metadata():
    data_dir = "data"
    pattern = os.path.join(data_dir, "*.parquet")
    files = glob.glob(pattern)
    
    if not files:
        print(f"❌ No parquet files found in {data_dir}")
        return

    print(f"🔍 Found {len(files)} parquet files. Seeding metadata...")
    
    engine = connect_to_database_sync()
    with engine.connect() as conn:
        # Clear existing metadata if any (since we're resetting)
        conn.execute(text("DELETE FROM index_metadata"))
        
        for file_path in files:
            filename = os.path.basename(file_path)
            # Expected format: SYMBOL_YYYY-MM-DD.parquet
            try:
                base_name = filename.replace(".parquet", "")
                if "_" in base_name:
                    symbol, date_str = base_name.split("_")
                    start_date = datetime.strptime(date_str, "%Y-%m-%d")
                    
                    # Insert into index_metadata
                    # We store the relative path for the fallback logic
                    conn.execute(
                        text("""
                            INSERT INTO index_metadata (instrument, interval, start_date, end_date, rows_count, bucket_name, object_name, parquet_path)
                            VALUES (:instrument, :interval, :start_date, :start_date, :rows_count, :bucket, :object, :object)
                        """),
                        {
                            "instrument": symbol,
                            "interval": "1min",
                            "start_date": start_date,
                            "rows_count": 375,
                            "bucket": "local",
                            "object": file_path
                        }
                    )
                    print(f"✅ Registered: {symbol} for {date_str} -> {file_path}")
            except Exception as e:
                print(f"⚠️ Skipping {filename}: {e}")
        
        conn.commit()
    print("🚀 Metadata seeding complete.")

if __name__ == "__main__":
    seed_metadata()
