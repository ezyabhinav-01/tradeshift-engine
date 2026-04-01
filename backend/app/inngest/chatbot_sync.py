import inngest
import os
import sys
import json
from pathlib import Path
from sqlalchemy import select
from app.database import get_session
from app.models import Lesson, Module, Track

# Add the chatbot directory for its helper
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "chatbot"))
from navigation_map import update_navigation_cache

def create_chatbot_sync_function(inngest_client: inngest.Inngest):
    @inngest_client.create_function(
        fn_id="sync-chatbot-navigation",
        trigger=inngest.TriggerCron(cron="0 * * * *"), # Every hour
    )
    async def sync_chatbot_navigation(ctx: inngest.Context, step: inngest.Step):
        """
        Extract Academy topics and update the Chatbot's dynamic navigation cache.
        """
        async def fetch_resources():
            print("🚀 [HEARTBEAT] Fetching Academy resources for Chatbot sync...")
            db = await get_session()
            try:
                # 1. Fetch Published Lessons
                res_lessons = await db.execute(select(Lesson).where(Lesson.is_published == True))
                lessons = res_lessons.scalars().all()
                
                # 2. Fetch Modules
                res_modules = await db.execute(select(Module))
                modules = res_modules.scalars().all()
                
                # 3. Fetch Tracks
                res_tracks = await db.execute(select(Track))
                tracks = res_tracks.scalars().all()
                
                # 4. Map them to a dictionary of (lowercase_name -> Title)
                concepts = {}
                db_topics = {}
                
                for l in lessons:
                    concepts[l.title.lower()] = l.title
                for m in modules:
                    db_topics[m.title.lower()] = m.title
                for t in tracks:
                    db_topics[t.title.lower()] = t.title
                    
                return {"concepts": concepts, "db_topics": db_topics}
            finally:
                await db.close()

        # Step 1: Extract from DB
        mapping_data = await step.run("extract-academy-resources", fetch_resources)
        
        # Step 2: Update local JSON cache
        async def update_cache():
             update_navigation_cache(mapping_data["concepts"], mapping_data["db_topics"])
             return {"status": "success", "topicsCount": len(mapping_data["concepts"]) + len(mapping_data["db_topics"])}
             
        result = await step.run("update-chatbot-cache", update_cache)
        
        print(f"✅ [HEARTBEAT] Chatbot Sync complete. {result['topicsCount']} topics updated.")
        return result
    
    return sync_chatbot_navigation
