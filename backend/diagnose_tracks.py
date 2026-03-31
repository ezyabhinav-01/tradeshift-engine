import asyncio
import json
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import get_session, connect_to_database
from app.models import Track, Module, SubModule, Lesson

async def diagnose():
    await connect_to_database()
    session = await get_session()
    
    # Mirror the logic in get_tracks
    result = await session.execute(
        select(Track)
        .options(
            joinedload(Track.modules)
            .joinedload(Module.sub_modules)
            .joinedload(SubModule.lessons)
        )
        .order_by(Track.id)
    )
    tracks = result.unique().scalars().all()
    
    print(f"Total Tracks fetched by ORM: {len(tracks)}")
    for track in tracks:
        print(f"Track: {track.title} (ID: {track.id})")
        print(f"  Modules: {len(track.modules)}")
        for module in track.modules:
            print(f"    Module: {module.title} (ID: {module.id})")
            print(f"      SubModules: {len(module.sub_modules)}")
            for sub in module.sub_modules:
                print(f"        SubModule: {sub.title} (ID: {sub.id})")
                print(f"          Lessons: {len(sub.lessons)}")
                for lesson in sub.lessons:
                    print(f"            Lesson: {lesson.title} (ID: {lesson.id}, Published: {lesson.is_published})")

    await session.close()

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(diagnose())
