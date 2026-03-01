#!/usr/bin/env python3
"""
Script to download NSE Equity master file and update the instruments_master table in PostgreSQL.

This script:
1. Downloads the NSE symbols ZIP file from Shoonya API
2. Extracts and reads the data using Pandas
3. Connects to PostgreSQL database
4. Creates instruments_master table if it doesn't exist
5. Bulk inserts data with ON CONFLICT DO NOTHING to handle duplicates
"""

import sys
import os
import zipfile
import requests
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from io import BytesIO

# Ensure the parent directory is in the sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# NSE Equity master file URL
NSE_SYMBOLS_URL = "https://api.shoonya.com/NSE_symbols.txt.zip"

# Database connection URL (from environment variable or default)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/tradeshift")


def download_and_extract_nse_symbols():
    """
    Download the NSE symbols ZIP file and extract the text file.
    
    Returns:
        pd.DataFrame: DataFrame containing the NSE symbols data
    """
    print(f"📥 Downloading NSE symbols from {NSE_SYMBOLS_URL}...")
    
    try:
        # Download the ZIP file
        response = requests.get(NSE_SYMBOLS_URL, timeout=30)
        response.raise_for_status()
        
        print("✅ Download successful. Extracting ZIP file...")
        
        # Extract and read the file from ZIP
        with zipfile.ZipFile(BytesIO(response.content)) as zip_file:
            # Get the first file in the ZIP (should be NSE_symbols.txt)
            file_name = zip_file.namelist()[0]
            print(f"📄 Extracting file: {file_name}")
            
            # Read the CSV file directly from ZIP
            with zip_file.open(file_name) as txt_file:
                # Read the file using pandas
                # Assuming the file is tab-delimited or comma-separated
                df = pd.read_csv(txt_file)
                
        print(f"✅ Successfully loaded {len(df)} records from NSE symbols file")
        print(f"📊 Columns in the file: {list(df.columns)}")
        
        return df
        
    except requests.RequestException as e:
        print(f"❌ Error downloading file: {e}")
        raise
    except zipfile.BadZipFile as e:
        print(f"❌ Error extracting ZIP file: {e}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        raise


def create_instruments_table(engine):
    """
    Create the instruments_master table if it doesn't exist.
    
    Args:
        engine: SQLAlchemy engine object
    """
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS instruments_master (
        token VARCHAR(50) PRIMARY KEY,
        symbol VARCHAR(100) NOT NULL,
        name VARCHAR(255),
        instrument_type VARCHAR(50)
    );
    """
    
    print("🔨 Creating instruments_master table (if not exists)...")
    
    try:
        with engine.connect() as conn:
            conn.execute(text(create_table_sql))
            conn.commit()
        print("✅ Table created successfully (or already exists)")
    except SQLAlchemyError as e:
        print(f"❌ Error creating table: {e}")
        raise


def prepare_dataframe(df):
    """
    Prepare the DataFrame for insertion by mapping columns to our schema.
    
    Args:
        df (pd.DataFrame): Raw DataFrame from NSE symbols file
        
    Returns:
        pd.DataFrame: Processed DataFrame with correct column names
    """
    # Print the original columns to help with debugging
    print(f"📋 Original columns: {list(df.columns)}")
    
    # The NSE_symbols.txt file typically has columns like:
    # Exchange, Token, LotSize, Symbol, TradingSymbol, Expiry, Instrument, OptionType, StrikePrice, etc.
    # We need to map these to our schema: token, symbol, name, instrument_type
    
    # Column mapping (adjust based on actual column names in the file)
    column_mapping = {
        'Token': 'token',
        'TradingSymbol': 'symbol',
        'Symbol': 'name',
        'Instrument': 'instrument_type'
    }
    
    # Try to find matching columns (case-insensitive)
    actual_mapping = {}
    for source_col in df.columns:
        for expected_col, target_col in column_mapping.items():
            if source_col.lower() == expected_col.lower():
                actual_mapping[source_col] = target_col
                break
    
    print(f"🔄 Column mapping: {actual_mapping}")
    
    # Rename columns
    df_prepared = df.rename(columns=actual_mapping)
    
    # Select only the columns we need
    required_cols = ['token', 'symbol', 'name', 'instrument_type']
    available_cols = [col for col in required_cols if col in df_prepared.columns]
    
    df_prepared = df_prepared[available_cols]
    
    # Convert token to string to match VARCHAR type
    if 'token' in df_prepared.columns:
        df_prepared['token'] = df_prepared['token'].astype(str)
    
    # Fill NaN values with empty strings for string columns
    df_prepared = df_prepared.fillna('')
    
    print(f"✅ Prepared {len(df_prepared)} records for insertion")
    print(f"📊 Final columns: {list(df_prepared.columns)}")
    
    return df_prepared


def bulk_insert_data(engine, df):
    """
    Bulk insert data into instruments_master table using ON CONFLICT DO NOTHING.
    
    Args:
        engine: SQLAlchemy engine object
        df (pd.DataFrame): DataFrame containing the data to insert
    """
    print(f"💾 Inserting {len(df)} records into instruments_master table...")
    
    try:
        # Create a temporary table name
        temp_table = "temp_instruments_insert"
        
        # Insert into a temporary table first
        df.to_sql(temp_table, engine, if_exists='replace', index=False, method='multi')
        
        print(f"✅ Data loaded into temporary table")
        
        # Use INSERT ... ON CONFLICT DO NOTHING to handle duplicates
        insert_sql = f"""
        INSERT INTO instruments_master (token, symbol, name, instrument_type)
        SELECT token, symbol, name, instrument_type
        FROM {temp_table}
        ON CONFLICT (token) DO NOTHING;
        """
        
        with engine.connect() as conn:
            result = conn.execute(text(insert_sql))
            conn.commit()
            # Note: rowcount might not be accurate for ON CONFLICT queries in all versions
            print(f"✅ Bulk insert completed")
            
        # Drop the temporary table
        with engine.connect() as conn:
            conn.execute(text(f"DROP TABLE IF EXISTS {temp_table}"))
            conn.commit()
            
        print("✅ Temporary table cleaned up")
        
        # Get count of records in the table
        with engine.connect() as conn:
            count_result = conn.execute(text("SELECT COUNT(*) FROM instruments_master"))
            total_count = count_result.scalar()
            print(f"📊 Total records in instruments_master: {total_count}")
            
    except SQLAlchemyError as e:
        print(f"❌ Error inserting data: {e}")
        raise


def main():
    """
    Main function to orchestrate the entire process.
    """
    print("=" * 60)
    print("🚀 NSE Master Database Update Script")
    print("=" * 60)
    
    try:
        # Step 1: Download and extract NSE symbols
        df = download_and_extract_nse_symbols()
        
        # Step 2: Connect to database
        print(f"\n🔌 Connecting to database: {DATABASE_URL}")
        engine = create_engine(DATABASE_URL)
        
        # Test database connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connection successful")
        
        # Step 3: Create table
        create_instruments_table(engine)
        
        # Step 4: Prepare data
        print("\n📝 Preparing data for insertion...")
        df_prepared = prepare_dataframe(df)
        
        # Step 5: Bulk insert data
        print("\n💾 Starting bulk insert...")
        bulk_insert_data(engine, df_prepared)
        
        print("\n" + "=" * 60)
        print("✅ NSE Master Database Update Completed Successfully!")
        print("=" * 60)
        
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ Script failed with error: {e}")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
