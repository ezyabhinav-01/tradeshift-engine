import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import create_async_engine

load_dotenv()

async def fix():
    db_url = os.getenv("DATABASE_URL")
    if "postgresql://" in db_url and "+asyncpg" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, title, module_id FROM sub_modules WHERE title ilike '%money%';"))
        subs = res.fetchall()
        print(f"Sub-modules found: {subs}")

        if subs:
            sub_id = subs[0][0]
            
            res2 = await conn.execute(text("SELECT id, title, module_id, sub_module_id FROM lessons WHERE title ilike '%money%';"))
            lessons = res2.fetchall()
            print(f"Lessons found: {lessons}")

            if lessons:
                lesson_id = lessons[0][0]
                await conn.execute(text(f"UPDATE lessons SET sub_module_id = {sub_id} WHERE id = {lesson_id};"))
                await conn.commit()
                print("Successfully attached lesson to sub_module!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix())
