import os

def refactor_main():
    file_path = "backend/main.py"
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # New load_parquet_for_symbol
    new_load_parquet = """def load_parquet_for_symbol(symbol: str, target_date: str = None, allow_fallback: bool = False):
    \"\"\"
    Load data for a specific symbol from MinIO storage using Supabase metadata.
    \"\"\"
    try:
        # 1. Resolve Instrument Metadata from Supabase
        if target_date:
            query = text(\"\"\"
                SELECT bucket_name, object_name FROM index_metadata 
                WHERE instrument = :symbol AND TO_CHAR(start_date, 'YYYY-MM-DD') = :target_date
                LIMIT 1
            \"\"\")
            params = {"symbol": symbol, "target_date": target_date}
        else:
            # Fallback: Get the most recent date for this symbol
            query = text(\"\"\"
                SELECT bucket_name, object_name FROM index_metadata 
                WHERE instrument = :symbol 
                ORDER BY start_date DESC LIMIT 1
            \"\"\")
            params = {"symbol": symbol}

        with engine_sync.connect() as conn:
            row = conn.execute(query, params).fetchone()
            
        if not row:
            if allow_fallback and target_date: # Try without date
                 return load_parquet_for_symbol(symbol, None, False)
            raise FileNotFoundError(f"No metadata found for symbol '{symbol}' (date: {target_date}) in Supabase")
            
        bucket_name, object_name = row
        
        # 2. Fetch from MinIO
        if not minio_client:
            raise Exception("MinIO client not initialized")
            
        print(f"📦 Fetching from MinIO: {bucket_name}/{object_name}")
        response = minio_client.get_object(bucket_name, object_name)
        
        try:
            # Load the Parquet file from memory
            df = pd.read_parquet(io.BytesIO(response.data))
        finally:
            response.close()
            response.release_conn()
            
        # 3. Clean and map columns
        df.columns = df.columns.str.lower()
        column_map = {
            'into': 'open', 'inth': 'high', 'intl': 'low', 'intc': 'close',
            'intv': 'volume', 'intoi': 'oi', 'v': 'volume', 'oi': 'oi'
        }
        df = df.rename(columns=column_map)
        
        # Clean and parse timestamp
        time_col = 'time' if 'time' in df.columns else ('datetime' if 'datetime' in df.columns else None)
        if time_col:
            df['time'] = df[time_col].astype(str).str.replace('Ok ', '', regex=False).str.strip()
            # Try multiple formats
            for fmt in ['%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%m/%d/%Y %H:%M:%S']:
                try:
                    df['datetime'] = pd.to_datetime(df['time'], format=fmt, errors='coerce')
                    if not df['datetime'].isnull().all(): break
                except: continue
            if 'datetime' not in df.columns or df['datetime'].isnull().all():
                df['datetime'] = pd.to_datetime(df['time'], errors='coerce')

        # Clean numeric data
        for col in ['open', 'high', 'low', 'close']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df = df.dropna(subset=['open', 'high', 'low', 'close'])
        if 'datetime' in df.columns:
            df = df.sort_values('datetime')
            
        print(f"✅ Loaded {len(df)} rows from MinIO for {symbol}.")
        return df, object_name, symbol

    except Exception as e:
        logger.error(f"❌ MinIO Load Error for {symbol}: {e}")
        raise e"""

    lines = content.split('\n')
    
    # Replace load_parquet_for_symbol
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if line.startswith('def load_parquet_for_symbol('):
            start_idx = i
        if start_idx != -1 and '@app.get("/api/search")' in line:
            end_idx = i - 1
            break
            
    if start_idx != -1 and end_idx != -1:
        new_lines = lines[:start_idx] + [new_load_parquet] + lines[end_idx:]
        lines = new_lines
        print("✅ Refactored load_parquet_for_symbol")
    else:
        print("❌ Could not locate load_parquet_for_symbol markers")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write('\n'.join(lines))

if __name__ == "__main__":
    refactor_main()
