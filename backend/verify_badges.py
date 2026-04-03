import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models import User, LearningProgress, UserBadge, Lesson
from app.database import get_session, connect_to_database
from app.services.badge_service import check_and_grant_badges

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_badge_system():
    from app.database import get_database_url_async
    logger.info(f"Using Database URL: {get_database_url_async()}")
    await connect_to_database()
    db = await get_session()
    
    try:
        # 1. Find or Create a test user
        test_email = "badge_tester@gmail.com"
        result = await db.execute(select(User).where(User.email == test_email))
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(email=test_email, full_name="Badge Tester", hashed_password="pw")
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info(f"Created test user: {user.id}")
        else:
            # Clean up old badges/progress for clean test
            await db.execute(delete(UserBadge).where(UserBadge.user_id == user.id))
            await db.execute(delete(LearningProgress).where(LearningProgress.user_id == user.id))
            await db.commit()
            logger.info(f"Cleaned up user: {user.id}")

        # 2. Add a lesson completion
        # We need a valid lesson ID from the DB
        lesson_res = await db.execute(select(Lesson).limit(1))
        lesson = lesson_res.scalar_one_or_none()
        
        if not lesson:
            logger.error("No lessons found in database to test with.")
            # Create a mock lesson if needed, but usually there's data
            return

        logger.info(f"Simulating completion of lesson {lesson.id}")
        progress = LearningProgress(
            user_id=user.id,
            lesson_id=str(lesson.id),
            track_id="1",
            xp_earned=150 # Grant enough for bronze_trader too
        )
        db.add(progress)
        await db.commit()

        # 3. Manually trigger badge check (simulating background task)
        logger.info("Triggering badge check...")
        await check_and_grant_badges(user.id)

        # 4. Verify badges were created
        badge_res = await db.execute(select(UserBadge).where(UserBadge.user_id == user.id))
        badges = badge_res.scalars().all()
        
        logger.info(f"Found {len(badges)} badges for user:")
        for b in badges:
            logger.info(f" - [{b.badge_id}] {b.badge_title}")

        if any(b.badge_id == "first_steps" for b in badges) and any(b.badge_id == "bronze_trader" for b in badges):
            logger.info("✅ SUCCESS: 'first_steps' and 'bronze_trader' badges granted.")
        else:
            logger.warning("❌ FAILURE: Expected badges not found.")

    except Exception as e:
        logger.error(f"Verification failed: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(verify_badge_system())
