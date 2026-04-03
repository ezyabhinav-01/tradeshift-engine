import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import connect_to_database, get_session

load_dotenv()

async def check_schema():
    await connect_to_database()
    session = await get_session()
    
    tables = ['tracks', 'modules', 'sub_modules', 'lessons']
    
    for table in tables:
        print(f"\n--- Columns in '{table}' ---")
        res = await session.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'"))
        for row in res.all():
            print(f"  {row[0]} ({row[1]})")
            
    await session.close()

if __name__ == "__main__":
    asyncio.run(check_schema())
