#!/usr/bin/env python3
"""
Fix schema mismatches between SQLAlchemy models and the Supabase database.
Adds any missing columns to the 'users' table.
"""
import os, sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
sys.path.append(str(BASE_DIR))
load_dotenv(BASE_DIR / ".env")

from sqlalchemy import create_engine, text, inspect

def get_sync_url():
    url = os.getenv("DATABASE_URL", "")
    if "+asyncpg" in url:
        url = url.replace("postgresql+asyncpg://", "postgresql://")
    if "?" in url:
        url = url.split("?")[0]
    return url

def main():
    url = get_sync_url()
    print(f"🔗 Connecting to: {url[:40]}...")
    
    is_local = "localhost" in url or "@db:" in url
    connect_args = {}
    if not is_local:
        connect_args["sslmode"] = "require"
        connect_args["connect_timeout"] = 10
    
    engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
    
    # Get existing columns
    inspector = inspect(engine)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}
    print(f"📋 Existing columns in 'users': {sorted(existing_cols)}")
    
    # Expected columns from the SQLAlchemy model
    expected_cols = {
        "id": "SERIAL PRIMARY KEY",
        "email": "VARCHAR UNIQUE",
        "hashed_password": "VARCHAR",
        "full_name": "VARCHAR",
        "dob": "VARCHAR",
        "experience_level": "VARCHAR",
        "investment_goals": "VARCHAR",
        "preferred_instruments": "VARCHAR",
        "risk_tolerance": "VARCHAR",
        "occupation": "VARCHAR",
        "city": "VARCHAR",
        "how_heard_about": "VARCHAR",
        "security_pin": "VARCHAR(4)",
        "phone_number": "VARCHAR",
        "otp_code": "VARCHAR(6)",
        "otp_expiry": "TIMESTAMP",
        "demat_id": "VARCHAR(50)",
        "refresh_token": "VARCHAR",
        "is_verified": "BOOLEAN DEFAULT FALSE",
        "balance": "FLOAT DEFAULT 100000.0",
        "last_active_at": "TIMESTAMP",
        "created_at": "TIMESTAMP DEFAULT NOW()",
    }
    
    missing = set(expected_cols.keys()) - existing_cols
    
    if not missing:
        print("✅ No missing columns! Schema is in sync.")
        return
    
    print(f"⚠️  Missing columns: {sorted(missing)}")
    
    with engine.connect() as conn:
        for col_name in sorted(missing):
            col_type = expected_cols[col_name]
            sql = f'ALTER TABLE users ADD COLUMN IF NOT EXISTS "{col_name}" {col_type};'
            print(f"  ➕ Adding column: {col_name} ({col_type})")
            conn.execute(text(sql))
        conn.commit()
    
    print("✅ All missing columns added successfully!")

if __name__ == "__main__":
    main()
