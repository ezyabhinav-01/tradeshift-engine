#!/usr/bin/env python3
"""
MANDATORY MAINTENANCE SCRIPT: Partition Creator & Pruner
Ensures the database always has partitions for the next 3 months.
Also prunes partitions older than 3 months to save storage.
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from dateutil.relativedelta import relativedelta
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Path setup
BASE_DIR = Path(__file__).parent.parent
load_dotenv(BASE_DIR / ".env")

# 1. DATABASE CONFIGURATION
# SQLAlchemy async string might have +asyncpg, need to strip it for psycopg2
DATABASE_URL = os.getenv("DATABASE_URL", "").replace("+asyncpg", "")
RETENTION_MONTHS = 3 # Keep data for 3 months
FUTURE_MONTHS = 3    # Ensure 3 months of future partitions exist

# Tables to maintain
TABLES_TO_MAINTAIN = [
    "trade_logs",
    "market_candles",
    "notifications",
    "user_events",
    "portfolio_snapshots",
    "system_alerts_logs"
]

def get_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not found in environment variables")
    return psycopg2.connect(DATABASE_URL, sslmode="require", cursor_factory=RealDictCursor)

def ensure_future_partitions(conn):
    """Checks and creates partitions for the current month and the next N months."""
    cur = conn.cursor()
    now = datetime.now()
    
    print(f"🛠️  Ensuring {FUTURE_MONTHS} months of future partitions exist...")
    
    for i in range(0, FUTURE_MONTHS + 1):
        target_month = now + relativedelta(months=i)
        next_month = target_month + relativedelta(months=1)
        
        y, m = target_month.year, target_month.month
        ny, nm = next_month.year, next_month.month
        
        start_str = f"{y}-{m:02d}-01"
        end_str = f"{ny}-{nm:02d}-01"
        suffix = f"y{y}m{m:02d}"
        
        for table in TABLES_TO_MAINTAIN:
            partition_name = f"{table}_{suffix}"
            
            # Check if partition exists
            cur.execute("SELECT 1 FROM pg_tables WHERE tablename = %s", (partition_name,))
            if not cur.fetchone():
                try:
                    # Create the partition
                    query = f"CREATE TABLE IF NOT EXISTS {partition_name} PARTITION OF {table} FOR VALUES FROM ('{start_str}') TO ('{end_str}')"
                    cur.execute(query)
                    print(f"   ✅ Created: {partition_name} ({start_str} to {end_str})")
                except Exception as e:
                    print(f"   ❌ Error creating {partition_name}: {e}")
                    conn.rollback()
            else:
                # Still check if it's already a partition, though name-wise it matches
                pass

    conn.commit()

def prune_old_partitions(conn):
    """Drops partitions older than RETENTION_MONTHS."""
    cur = conn.cursor()
    cutoff_date = datetime.now() - relativedelta(months=RETENTION_MONTHS)
    
    print(f"\n🧹 Checking for partitions older than {RETENTION_MONTHS} months (Before {cutoff_date.strftime('%Y-%m')})...")
    
    # Query all child partitions for our tables
    cur.execute("""
        SELECT nmbt.relname AS child
        FROM pg_inherits
        JOIN pg_class nmbt ON nmbt.oid = pg_inherits.inhrelid
        JOIN pg_class nmbt_parent ON nmbt_parent.oid = pg_inherits.inhparent
        WHERE nmbt_parent.relname = ANY(%s)
    """, (TABLES_TO_MAINTAIN,))
    
    partitions = cur.fetchall()
    
    for p in partitions:
        p_name = p['child']
        
        # Expected naming: table_y2026m04
        if '_y' in p_name:
            try:
                parts = p_name.split('_y')
                date_str = parts[-1] # e.g. 2026m04
                year = int(date_str[:4])
                month = int(date_str[5:7])
                
                p_date = datetime(year, month, 1)
                
                if p_date < datetime(cutoff_date.year, cutoff_date.month, 1):
                    # Safety Check: Never drop 'default' partitions or others with different naming
                    print(f"   🗑️  Pruning: {p_name} (Month: {year}-{month:02d})")
                    cur.execute(f"DROP TABLE {p_name}")
            except Exception as e:
                # Probably not a date-based partition or 'default'
                pass
                
    conn.commit()

def main():
    print(f"--- DATABASE MAINTENANCE: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
    try:
        conn = get_connection()
        ensure_future_partitions(conn)
        prune_old_partitions(conn)
        conn.close()
        print("\n✨ Maintenance complete. Your database is synchronized!")
    except Exception as e:
        print(f"\n💥 ERROR during maintenance: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
