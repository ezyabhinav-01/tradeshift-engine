import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import create_async_engine

load_dotenv()

async def check():
    db_url = os.getenv("DATABASE_URL")
    if "postgresql://" in db_url and "+asyncpg" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'tracks';"))
        print(f"Tracks columns: {[r[0] for r in res.fetchall()]}")

        res = await conn.execute(text("SELECT id, title, sort_order FROM tracks ORDER BY id;"))
        try:
             print([r for r in res.fetchall()])
        except Exception as e:
             pass

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
