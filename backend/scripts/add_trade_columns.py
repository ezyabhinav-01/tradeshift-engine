#!/usr/bin/env python3
"""
Migration script to add advanced order columns to the trade_logs table.
Safe to run multiple times — checks if each column exists before adding.

Usage:
    cd backend
    python scripts/add_trade_columns.py
"""

import os
import sys

# Add backend to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import connect_to_database

# Columns to add: (column_name, column_type, default_value_or_None)
NEW_COLUMNS = [
    ("user_id", "INTEGER", None),
    ("alert", "BOOLEAN", "FALSE"),
    ("order_type", "VARCHAR", "'MARKET'"),
    ("limit_price", "DOUBLE PRECISION", None),
    ("stop_price", "DOUBLE PRECISION", None),
    ("triggered", "BOOLEAN", "FALSE"),
    ("status", "VARCHAR", "'OPEN'"),
]


def column_exists(conn, table_name: str, column_name: str) -> bool:
    """Check if a column exists in the given table."""
    result = conn.execute(
        text("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = :table AND column_name = :col
        """),
        {"table": table_name, "col": column_name},
    )
    return result.scalar() > 0


def run_migration():
    """Add new columns to trade_logs table if they don't already exist."""
    print("🔄 Running trade_logs migration...")

    engine = connect_to_database()

    with engine.begin() as conn:
        for col_name, col_type, default in NEW_COLUMNS:
            if column_exists(conn, "trade_logs", col_name):
                print(f"  ✅ Column '{col_name}' already exists — skipping")
                continue

            default_clause = f" DEFAULT {default}" if default else ""
            sql = f"ALTER TABLE trade_logs ADD COLUMN {col_name} {col_type}{default_clause}"
            conn.execute(text(sql))
            print(f"  ➕ Added column '{col_name}' ({col_type}{default_clause})")

        # Add index on user_id if it doesn't exist
        result = conn.execute(
            text("""
                SELECT COUNT(*) FROM pg_indexes
                WHERE tablename = 'trade_logs' AND indexname = 'ix_trade_logs_user_id'
            """)
        )
        if result.scalar() == 0:
            conn.execute(text("CREATE INDEX ix_trade_logs_user_id ON trade_logs (user_id)"))
            print("  ➕ Created index on user_id")
        else:
            print("  ✅ Index on user_id already exists — skipping")

    print("✅ Migration complete!")


if __name__ == "__main__":
    run_migration()
