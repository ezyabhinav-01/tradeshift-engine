import asyncio
import os
from sqlalchemy import text
from app.database import get_session

async def run_migration():
    """
    Run migration to add balance column to users table if not exists.
    """
    print("🔄 Running balance migration...")
    db = await get_session()
    try:
        # Add column if not exists
        await db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS balance FLOAT DEFAULT 100000.0;"))
        # Update existing records
        await db.execute(text("UPDATE users SET balance = 100000.0 WHERE balance IS NULL;"))
        await db.commit()
        print("✅ Migration successful: balance column added and initialized to 100,000.")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        await db.rollback()
    finally:
        await db.close()

if __name__ == "__main__":
    # Ensure current directory is in PYTHONPATH
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    asyncio.run(run_migration())
