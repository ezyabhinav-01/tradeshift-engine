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
from app.models import Lesson
from sqlalchemy import select

async def extract_topics():
    """
    Extracts all published lesson titles and IDs to used by the Chatbot
    for navigation links.
    """
    db = await get_session()
    try:
        result = await db.execute(select(Lesson).where(Lesson.is_published == True))
        lessons = result.scalars().all()
        
        topics = []
        for l in lessons:
            topics.append({
                "id": str(l.id),
                "title": l.title
            })
            
        return topics
    finally:
        await db.close()

if __name__ == "__main__":
    try:
        topics = asyncio.run(extract_topics())
        print("EXTRACTED_TOPICS_START")
        print(json.dumps(topics, indent=2))
        print("EXTRACTED_TOPICS_END")
    except Exception as e:
        print(f"ERROR: {e}")
