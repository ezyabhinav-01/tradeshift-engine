import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import connect_to_database, get_session

load_dotenv()

async def fix_schema():
    await connect_to_database()
    session = await get_session()
    
    commands = [
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
        "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
        "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'"
    ]
    
    for cmd in commands:
        print(f"Executing: {cmd}")
        try:
            await session.execute(text(cmd))
            await session.commit()
            print("  Success!")
        except Exception as e:
            await session.rollback()
            print(f"  Failed: {str(e)}")
            
    await session.close()

if __name__ == "__main__":
    asyncio.run(fix_schema())
