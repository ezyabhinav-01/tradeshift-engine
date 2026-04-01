import asyncio
import os
import sys
import json
from dotenv import load_dotenv

# Add the parent directory to sys.path so we can import app modules
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(base_dir)

# Load environment variables from .env
load_dotenv(os.path.join(base_dir, ".env"))

from app.database import get_session
from app.models import Lesson, Module, Track
from sqlalchemy import select

async def extract_all_learning_resources():
    """
    Extracts all Tracks, Modules, and Lessons to build a comprehensive
    navigation map for the Chatbot.
    """
    db = await get_session()
    try:
        # Get lessons
        result = await db.execute(select(Lesson).where(Lesson.is_published == True))
        lessons = result.scalars().all()
        
        # Get modules
        result = await db.execute(select(Module))
        modules = result.scalars().all()
        
        # Get tracks
        result = await db.execute(select(Track))
        tracks = result.scalars().all()
        
        return {
            "lessons": [{"id": str(l.id), "title": l.title} for l in lessons],
            "modules": [{"id": str(m.id), "title": m.title} for m in modules],
            "tracks": [{"id": str(t.id), "title": t.title} for t in tracks]
        }
    finally:
        await db.close()

if __name__ == "__main__":
    try:
        resources = asyncio.run(extract_all_learning_resources())
        print("RESOURCES_START")
        print(json.dumps(resources, indent=2))
        print("RESOURCES_END")
    except Exception as e:
        print(f"ERROR: {e}")
