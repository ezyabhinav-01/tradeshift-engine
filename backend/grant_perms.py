import asyncio
from sqlalchemy import text
from app.database import async_sessionmaker, create_async_engine
import os
from dotenv import load_dotenv

load_dotenv()

async def grant():
    db_url = os.getenv("DATABASE_URL")
    if "postgresql://" in db_url and "+asyncpg" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        print("Granting permissions to 'tradeshift_admin' user on shared curriculum tables...")
        
        # 1. Grant usage on public schema
        await conn.execute(text("GRANT USAGE ON SCHEMA public TO tradeshift_admin;"))
        
        # 2. Grant permissions on tables
        tables = ["tracks", "modules", "sub_modules", "lessons", "admins", "user_feedback"]
        for table in tables:
            try:
                await conn.execute(text(f"GRANT ALL PRIVILEGES ON TABLE {table} TO tradeshift_admin;"))
                print(f"✅ Granted ALL to '{table}'")
            except Exception as e:
                print(f"⚠️ Could not grant to '{table}': {e}")
                
        # 3. Grant usage on sequences (for SERIAL IDs)
        sequences = ["tracks_id_seq", "modules_id_seq", "sub_modules_id_seq", "lessons_id_seq", "admins_id_seq"]
        for seq in sequences:
            try:
                await conn.execute(text(f"GRANT USAGE, SELECT, UPDATE ON SEQUENCE {seq} TO tradeshift_admin;"))
                print(f"✅ Granted SEQUENCE '{seq}'")
            except Exception as e:
                print(f"⚠️ Could not grant to sequence '{seq}': {e}")

        await conn.commit()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(grant())
