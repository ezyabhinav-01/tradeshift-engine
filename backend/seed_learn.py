import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine
from app.database import get_session, connect_to_database, Base
from app.models import Track, Module, SubModule, Lesson

load_dotenv()

async def seed():
    await connect_to_database()
    
    # Ensure tables exist
    db_url = os.getenv("DATABASE_URL")
    if "postgresql://" in db_url and "+asyncpg" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    session = await get_session()
    
    # Check if we have data already
    res = await session.execute(select(Track))
    if res.scalars().first():
        print("Data already exists. Skipping seeding.")
        await session.close()
        return

    # Seed some data
    track1 = Track(title="Stock Market Foundations", description="Master the absolute basics of the equity market.")
    session.add(track1)
    await session.flush() # Get ID

    module1 = Module(track_id=track1.id, title="How Markets Work", description="Exchanges, brokers, and buyers.", sort_order=1, module_number="1")
    session.add(module1)
    await session.flush()

    sub1 = SubModule(module_id=module1.id, title="Order Matching", sub_module_number="1.1", sort_order=1)
    session.add(sub1)
    await session.flush()

    lesson1 = Lesson(
        module_id=module1.id,
        sub_module_id=sub1.id,
        title="Introduction to NSE/BSE",
        opening_hook="Ever wondered how a trade actually happens?",
        core_explanation="The National Stock Exchange (NSE) and Bombay Stock Exchange (BSE) are the backbones of Indian finance.",
        xp_reward=20,
        is_published=True,
        lesson_number="1.1.1"
    )
    session.add(lesson1)
    
    await session.commit()
    print("Seed data inserted successfully!")
    await session.close()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
