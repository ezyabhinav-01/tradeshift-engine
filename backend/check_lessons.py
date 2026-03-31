import asyncio
from sqlalchemy import select
from app.database import get_session, connect_to_database, Base
from app.models import Track, Module, SubModule, Lesson

async def check():
    await connect_to_database()
    session = await get_session()
    
    res = await session.execute(select(Lesson))
    lessons = res.scalars().all()
    print(f"Total Lessons Found: {len(lessons)}")
    for lesson in lessons:
        print(f"Lesson: {lesson.title} (ID: {lesson.id}) - Published: {lesson.is_published} - SubModuleID: {lesson.sub_module_id}")

    await session.close()

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(check())
