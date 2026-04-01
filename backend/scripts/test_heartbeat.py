import asyncio
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Add the parent directory to sys.path so we can import app modules
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(base_dir)

# Load environment variables from .env
load_dotenv(os.path.join(base_dir, ".env"))

from app.database import get_session
from app.models import Lesson, Module, Track
from sqlalchemy import select

# Mock the update_navigation_cache locally for the test
sys.path.append(os.path.join(base_dir, "chatbot"))
from navigation_map import update_navigation_cache, get_learn_navigation_hint

async def test_heartbeat_sync():
    """
    Simulates the Inngest heartbeat sync logic and verifies the cache update.
    """
    print("\n🚀 Starting Heartbeat Sync Verification...")
    
    db = await get_session()
    try:
        # 1. Fetch from DB (same logic as in chatbot_sync.py)
        result_lessons = await db.execute(select(Lesson).where(Lesson.is_published == True))
        lessons = result_lessons.scalars().all()
        
        concepts = {l.title.lower(): l.title for l in lessons}
        db_topics = {} # simplification for test
        
        print(f"📊 Found {len(lessons)} published lessons in DB.")
        for l in lessons:
             print(f"  - {l.title}")
             
        # 2. Update the cache
        print("💾 Updating Chatbot navigation cache...")
        update_navigation_cache(concepts, db_topics)
        
        # 3. Verify the chatbot picks it up
        if lessons:
            sample_topic = lessons[0].title
            print(f"📡 Testing chatbot hint for topic: '{sample_topic}'")
            hint = get_learn_navigation_hint(sample_topic)
            
            print("\n📝 Generated Hint:")
            print(hint)
            
            if "[OPEN_LEARN:" in hint and sample_topic in hint:
                print("\n✨ SUCCESS: Heartbeat sync works and chatbot correctly identified dynamic content!")
            else:
                print("\n❌ FAILURE: Hint did not contain the expected navigation tag.")
        else:
            print("⚠️ Skipping hint verification as no published lessons were found in DB.")

    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(test_heartbeat_sync())
