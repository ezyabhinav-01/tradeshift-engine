import asyncio
import os
from sqlalchemy import select
from app.database import get_session, connect_to_database, Base
from app.models import Track, Module, SubModule, Lesson

async def check():
    await connect_to_database()
    session = await get_session()
    
    # Check if we have data already
    res = await session.execute(select(Track))
    tracks = res.scalars().all()
    print(f"Total Tracks Found: {len(tracks)}")
    for track in tracks:
        print(f"Track: {track.title} (ID: {track.id})")
        # Check modules
        mod_res = await session.execute(select(Module).where(Module.track_id == track.id))
        modules = mod_res.scalars().all()
        print(f"  - Modules: {len(modules)}")
        for module in modules:
            print(f"    - Module: {module.title} (ID: {module.id})")

    await session.close()

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(check())
