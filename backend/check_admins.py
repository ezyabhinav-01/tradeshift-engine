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
        res = await conn.execute(text("SELECT email, is_active FROM admins;"))
        admins = res.fetchall()
        print(f"Total Admins: {len(admins)}")
        for admin in admins:
            print(f"Admin: {admin.email} (Active: {admin.is_active})")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
