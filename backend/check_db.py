import asyncio
from sqlalchemy import select, func
from app.database import get_db, async_session_maker
from app.models import Track, Module, SubModule, Lesson

async def check():
    async with async_session_maker() as session:
        tracks = await session.execute(select(func.count(Track.id)))
        modules = await session.execute(select(func.count(Module.id)))
        lessons = await session.execute(select(func.count(Lesson.id)))
        print(f"Tracks: {tracks.scalar()}")
        print(f"Modules: {modules.scalar()}")
        print(f"Lessons: {lessons.scalar()}")

if __name__ == "__main__":
    asyncio.run(check())
