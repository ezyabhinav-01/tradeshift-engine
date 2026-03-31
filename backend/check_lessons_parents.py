import asyncio
from sqlalchemy import select
from app.database import get_session, connect_to_database
from app.models import Lesson

async def check():
    await connect_to_database()
    session = await get_session()
    
    res = await session.execute(select(Lesson))
    lessons = res.scalars().all()
    for l in lessons:
        print(f"Lesson: {l.title} (ID: {l.id}) - Module: {l.module_id} - SubModule: {l.sub_module_id} - Published: {l.is_published}")
    await session.close()

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(check())
