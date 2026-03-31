import asyncio
import os
from sqlalchemy import select
from app.database import get_session, connect_to_database, Base
from app.models import Track, Module, SubModule, Lesson

async def seed():
    await connect_to_database()
    session = await get_session()
    
    # 1. Create Track
    sync_track = Track(
        title="Sync Test: Founder Academy", 
        description="Verify this content shows up on the Learn Page."
    )
    session.add(sync_track)
    await session.flush()

    # 2. Create Module
    sync_mod = Module(
        track_id=sync_track.id, 
        title="Verification Basics", 
        description="Testing the 4-layer hierarchy.", 
        sort_order=1, 
        module_number="T1"
    )
    session.add(sync_mod)
    await session.flush()

    # 3. Create SubModule
    sync_sub = SubModule(
        module_id=sync_mod.id, 
        title="Sync Confirmation", 
        sub_module_number="T1.1", 
        sort_order=1
    )
    session.add(sync_sub)
    await session.flush()

    # 4. Create Lesson (PUBLISHED)
    sync_lesson = Lesson(
        module_id=sync_mod.id,
        sub_module_id=sync_sub.id,
        title="Database Content Live!",
        opening_hook="If you see this, the sync is working.",
        core_explanation="This lesson was pulled directly from the shared PostgreSQL database.",
        xp_reward=50,
        is_published=True,
        lesson_number="T1.1.1"
    )
    session.add(sync_lesson)
    
    await session.commit()
    print(f"✅ Sync test track created with ID: {sync_track.id}")
    await session.close()

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(seed())
