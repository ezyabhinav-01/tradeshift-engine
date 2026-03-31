import asyncio
from dotenv import load_dotenv
load_dotenv()
from app.database import get_database_url_async
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def init_scenes():
    url = get_database_url_async()
    print("Connecting to:", url)
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        # Check if table exists
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS replay_scenes (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        # Insert mock data
        await conn.execute(text("""
            INSERT INTO replay_scenes (id, title, description)
            VALUES 
            (1, 'NIFTY 50 - Bull Trap (March 24)', 'Practice identifying and trading a classic bull trap setup on NIFTY index.'),
            (2, 'BANKNIFTY - Gap Down Support', 'Trade a strong gap down open that finds support at the previous day low.')
            ON CONFLICT DO NOTHING;
        """))
        print("Replay scenes initialized.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_scenes())
