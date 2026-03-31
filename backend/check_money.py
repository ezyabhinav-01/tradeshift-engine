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
        res = await conn.execute(text("SELECT id, title, is_published, module_id, sub_module_id FROM lessons WHERE title ilike '%money%';"))
        lessons = res.fetchall()
        print(f"Total Lessons with 'money': {len(lessons)}")
        for lesson in lessons:
            print(f"Lesson: {lesson.title} (ID: {lesson.id}) - Published: {lesson.is_published} - Module: {lesson.module_id} - SubModule: {lesson.sub_module_id}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
