"""
Badge Gamification Service for TradeShift
Defines 21 badges and the logic for granting them.
"""
import logging
from datetime import datetime, time
from typing import List, Set, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload, selectinload
from app.models import UserBadge, LearningProgress, Lesson, Module, Track, UserStreak, User
from app.services.email_service import send_badge_earned_email
from app.database import get_session

logger = logging.getLogger(__name__)

# ─── Badge Registry ─────────────────────────────────────────────────────────
# Motif mappings for UI reference:
# Milestones: 🎯, 📚, 🛤️
# XP: 🥉, 🥈, 🥇, 💎, 💠
# Streaks: 🔥, 🐂, 📅, 👑
# Thematic: 🐃, 🐻, 🐺, 📉, 🦅, 📊
# Lifestyle: 🦉, 🌅
# Final: 🏆

BADGE_REGISTRY = {
    # --- Milestones ---
    "first_steps": {
        "title": "First Steps",
        "description": "Completed your first lesson in the Academy.",
        "motif": "🎯",
        "category": "Milestones"
    },
    "scholar": {
        "title": "Academy Scholar",
        "description": "Successfully completed your first full module.",
        "motif": "📚",
        "category": "Milestones"
    },
    "track_master": {
        "title": "Track Master",
        "description": "Mastered an entire learning track.",
        "motif": "🛤️",
        "category": "Milestones"
    },
    # --- XP Levels ---
    "bronze_trader": {
        "title": "Bronze Trader",
        "description": "Reached 100 XP in the Academy.",
        "motif": "🥉",
        "category": "XP Levels"
    },
    "silver_trader": {
        "title": "Silver Trader",
        "description": "Reached 500 XP in the Academy.",
        "motif": "🥈",
        "category": "XP Levels"
    },
    "gold_trader": {
        "title": "Gold Trader",
        "description": "Reached 1,000 XP in the Academy.",
        "motif": "🥇",
        "category": "XP Levels"
    },
    "emerald_elite": {
        "title": "Emerald Elite",
        "description": "Reached 2,500 XP in the Academy.",
        "motif": "💎",
        "category": "XP Levels"
    },
    "diamond_hands": {
        "title": "Diamond Hands",
        "description": "Reached 5,000 XP. True dedication!",
        "motif": "💠",
        "category": "XP Levels"
    },
    # --- Streaks ---
    "on_fire": {
        "title": "On Fire",
        "description": "Maintained a 3-day learning streak.",
        "motif": "🔥",
        "category": "Streaks"
    },
    "unstoppable": {
        "title": "Charging Bull",
        "description": "Maintained a 7-day learning streak.",
        "motif": "🐂",
        "category": "Streaks"
    },
    "market_regular": {
        "title": "Market Regular",
        "description": "A 14-day streak! You are becoming a pro.",
        "motif": "📅",
        "category": "Streaks"
    },
    "consistency_king": {
        "title": "Consistency King",
        "description": "30 days of consistent learning. Elite status.",
        "motif": "👑",
        "category": "Streaks"
    },
    # --- Thematic ---
    "baby_bull": {
        "title": "Baby Bull",
        "description": "Completed the 'Basics of Trading' module.",
        "motif": "🐃",
        "category": "Thematic"
    },
    "iron_bear": {
        "title": "Iron Bear",
        "description": "Mastered the 'Risk Management' module.",
        "motif": "🐻",
        "category": "Thematic"
    },
    "wolf_of_ts": {
        "title": "Wolf of TradeShift",
        "description": "Completed a high-difficulty learning track.",
        "motif": "🐺",
        "category": "Thematic"
    },
    "chart_wizard": {
        "title": "Chart Wizard",
        "description": "Completed the 'Technical Analysis' module.",
        "motif": "📉",
        "category": "Thematic"
    },
    "option_eagle": {
        "title": "Option Eagle",
        "description": "Mastered the 'Options Trading' module.",
        "motif": "🦅",
        "category": "Thematic"
    },
    "fundamental_pro": {
        "title": "Fundamental Pro",
        "description": "Completed the 'Fundamental Analysis' module.",
        "motif": "📊",
        "category": "Thematic"
    },
    # --- Lifestyle ---
    "night_owl": {
        "title": "Night Owl",
        "description": "Completed a lesson in the quiet of the night (10 PM - 4 AM).",
        "motif": "🦉",
        "category": "Lifestyle"
    },
    "early_bird": {
        "title": "Early Bird",
        "description": "Pre-market preparation! Completed a lesson between 5 AM and 8 AM.",
        "motif": "🌅",
        "category": "Lifestyle"
    },
    # --- Final ---
    "market_legend": {
        "title": "Market Legend",
        "description": "The ultimate achievement. Completed every module in the Academy.",
        "motif": "🏆",
        "category": "Final"
    }
}

async def check_and_grant_badges(user_id: int):
    """
    Analyzes user progress and awards unearned badges.
    To be called after lesson completion or streak updates.
    Creates its own session for background compatibility.
    """
    db = await get_session()
    try:
        # 1. Fetch current earned badges to avoid duplicates
        earned_res = await db.execute(select(UserBadge.badge_id).where(UserBadge.user_id == user_id))
        already_earned = set(earned_res.scalars().all())

        # 2. Collect user stats
        # Total XP
        xp_res = await db.execute(select(func.sum(LearningProgress.xp_earned)).where(LearningProgress.user_id == user_id))
        total_xp = xp_res.scalar() or 0

        # Completed Lessons
        prog_res = await db.execute(select(LearningProgress).where(LearningProgress.user_id == user_id).order_by(LearningProgress.completed_at.asc()))
        progress_records = prog_res.scalars().all()
        completed_lesson_ids = {str(p.lesson_id) for p in progress_records}
        
        # Streak
        streak_res = await db.execute(select(UserStreak).where(UserStreak.user_id == user_id))
        streak = streak_res.scalar_one_or_none()
        current_streak = streak.current_streak if streak else 0
        
        # Latest activity time (for Owl/Bird)
        last_activity = progress_records[-1].completed_at if progress_records else None
        
        # 3. Check each badge in the registry
        newly_earned = []
        
        for b_id, meta in BADGE_REGISTRY.items():
            if b_id in already_earned:
                continue
                
            is_eligible = await _eval_badge_logic(db, user_id, b_id, total_xp, completed_lesson_ids, current_streak, last_activity)
            
            if is_eligible:
                # Grant Badge
                badge = UserBadge(
                    user_id=user_id,
                    badge_id=b_id,
                    badge_title=meta["title"],
                    earned_at=datetime.utcnow()
                )
                db.add(badge)
                newly_earned.append(meta)

        # 4. Finalize and Notify
        if newly_earned:
            await db.commit()
            user_res = await db.execute(select(User).where(User.id == user_id))
            user = user_res.scalar_one_or_none()
            
            if user and user.email:
                for badge_meta in newly_earned:
                    try:
                        await send_badge_earned_email(
                            email=user.email,
                            name=user.full_name or "Trader",
                            badge_title=badge_meta["title"],
                            badge_description=badge_meta["description"]
                        )
                        logger.info(f"🏆 Badge '{badge_meta['title']}' granted to {user.email}")
                    except Exception as email_err:
                        logger.warning(f"Failed to send badge email to {user.email}: {email_err}")
    except Exception as e:
        logger.error(f"Error in check_and_grant_badges: {e}")
        await db.rollback()
    finally:
        await db.close()

async def _eval_badge_logic(db, user_id, b_id, total_xp, completed_ids, streak, last_active) -> bool:
    """Evaluates if a user qualifies for a specific badge."""
    
    # --- XP Levels ---
    if b_id == "bronze_trader" and total_xp >= 100: return True
    if b_id == "silver_trader" and total_xp >= 500: return True
    if b_id == "gold_trader" and total_xp >= 1000: return True
    if b_id == "emerald_elite" and total_xp >= 2500: return True
    if b_id == "diamond_hands" and total_xp >= 5000: return True

    # --- Streaks ---
    if b_id == "on_fire" and streak >= 3: return True
    if b_id == "unstoppable" and streak >= 7: return True
    if b_id == "market_regular" and streak >= 14: return True
    if b_id == "consistency_king" and streak >= 30: return True

    # --- Lifestyle (Time based) ---
    if last_active and (b_id == "night_owl" or b_id == "early_bird"):
        h = last_active.hour
        if b_id == "night_owl" and (h >= 22 or h <= 4): return True
        if b_id == "early_bird" and (h >= 5 and h <= 8): return True

    # --- Milestones (Basic) ---
    if b_id == "first_steps" and len(completed_ids) >= 1: return True

    # --- Complexity Checks (Modules/Tracks) ---
    # scholar: at least one module fully completed
    # track_master: at least one track fully completed
    # market_legend: ALL modules completed

    if b_id in ["scholar", "track_master", "market_legend", "baby_bull", "iron_bear", "chart_wizard", "option_eagle", "fundamental_pro", "wolf_of_ts"]:
        # We need the module/track structure to check completion percentages
        # This is expensive, so we only run it for these specific badges
        return await _check_complex_completion(db, b_id, completed_ids)

    return False

async def _check_complex_completion(db: AsyncSession, b_id: str, completed_ids: Set[str]) -> bool:
    """Detailed check for module/track completion."""
    
    # 1. Get all tracks/modules/lessons
    # Note: Optimization would be to cache this structure
    track_res = await db.execute(
        select(Track).options(
            selectinload(Track.modules).selectinload(Module.lessons)
        )
    )
    tracks = track_res.unique().scalars().all()
    
    total_academy_modules = 0
    completed_academy_modules = 0
    max_track_completion = 0.0

    for track in tracks:
        track_lessons_count = 0
        track_lessons_completed = 0
        
        for module in track.modules:
            total_academy_modules += 1
            mod_lessons = [str(l.id) for l in module.lessons if l.is_published]
            
            if not mod_lessons: 
                continue
                
            is_mod_complete = all(lid in completed_ids for lid in mod_lessons)
            if is_mod_complete:
                completed_academy_modules += 1
                
                # Check Specific Thematic Badges by Title
                title = module.title.lower()
                if b_id == "baby_bull" and "basic" in title: return True
                if b_id == "iron_bear" and "risk" in title: return True
                if b_id == "chart_wizard" and "technical" in title: return True
                if b_id == "fundamental_pro" and "fundamental" in title: return True
                if b_id == "option_eagle" and "option" in title: return True

            track_lessons_count += len(mod_lessons)
            track_lessons_completed += len([lid for lid in mod_lessons if lid in completed_ids])

        if track_lessons_count > 0:
            completion = track_lessons_completed / track_lessons_count
            if completion >= 1.0:
                if b_id == "track_master": return True
                if b_id == "wolf_of_ts" and track.id >= 3: # Assuming higher IDs are advanced
                    return True

    if b_id == "scholar" and completed_academy_modules >= 1: return True
    if b_id == "market_legend" and total_academy_modules > 0 and completed_academy_modules == total_academy_modules:
        return True

    return False
