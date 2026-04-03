import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import connect_to_database, get_session

load_dotenv()

async def check_raw_data():
    await connect_to_database()
    session = await get_session()
    
    queries = [
        "SELECT count(*) FROM tracks",
        "SELECT count(*) FROM modules",
        "SELECT count(*) FROM lessons",
        "SELECT * FROM tracks LIMIT 5"
    ]
    
    for q in queries:
        print(f"\nQuery: {q}")
        res = await session.execute(text(q))
        rows = res.all()
        for row in rows:
            print(f"  {row}")
            
    await session.close()

if __name__ == "__main__":
    asyncio.run(check_raw_data())
