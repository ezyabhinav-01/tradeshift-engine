import asyncio
from dotenv import load_dotenv
load_dotenv()
from app.database import get_database_url_async
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def alter_table():
    url = get_database_url_async()
    print("Connecting to:", url)
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("""
                ALTER TABLE user_streaks ADD COLUMN learning_minutes INT DEFAULT 0;
            """))
            print("Successfully added learning_minutes column to user_streaks.")
        except Exception as e:
            print("Column may already exist or error:", e)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(alter_table())
