import logging
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from app.database import get_session
from app.models import Lesson, Module, Track
from chatbot.navigation_map import update_navigation_cache

logger = logging.getLogger(__name__)

async def sync_chatbot_navigation():
    """
    Extract Academy topics (Lessons, Modules, Tracks) and update the Chatbot's dynamic navigation cache.
    This replaces the old Inngest Cron job.
    """
    logger.info("🚀 [SCHEDULER] Fetching Academy resources for Chatbot sync...")
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
        concepts = {l.title.lower(): l.title for l in lessons}
        db_topics = {m.title.lower(): m.title for m in modules}
        for t in tracks:
            db_topics[t.title.lower()] = t.title
            
        # 5. Update local JSON cache
        update_navigation_cache(concepts, db_topics)
        logger.info(f"✅ [SCHEDULER] Chatbot Sync complete. {len(concepts) + len(db_topics)} topics updated.")
        
    except Exception as e:
        logger.error(f"❌ [SCHEDULER] Chatbot Sync failed: {e}")
    finally:
        await db.close()

def setup_scheduler():
    """
    Initialize the scheduler and add the 6-hour sync job.
    """
    if os.getenv("RUN_ASYNC_SCHEDULER", "true").lower() not in ("1", "true", "yes", "on"):
        logger.info("⏸️ Async scheduler disabled via RUN_ASYNC_SCHEDULER=false")
        return None

    scheduler = AsyncIOScheduler()
    
    # Add the sync job - run every 6 hours
    scheduler.add_job(sync_chatbot_navigation, 'interval', hours=6, id='chatbot_nav_sync')
    
    # Optional startup sync (disabled by default to reduce startup DB pressure)
    if os.getenv("RUN_ASYNC_STARTUP_SYNC", "false").lower() in ("1", "true", "yes", "on"):
        scheduler.add_job(sync_chatbot_navigation, 'date', id='startup_sync')
    
    scheduler.start()
    logger.info("🛠️ APScheduler initialized with 6-hour Chatbot Sync job.")
    return scheduler
