# File: backend/app/routers/learn.py
# Learning Progress API Router

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks,Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from typing import Optional, List

from sqlalchemy.orm import joinedload
from app.database import get_db
from app.models import LearningProgress, UserStreak, UserBadge, Track, Module, SubModule, Lesson
from app.services.badge_service import check_and_grant_badges

router = APIRouter(prefix="/api/learn", tags=["learn"])


# ═══════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════

class CompleteLessonRequest(BaseModel):
    lesson_id: str
    track_id: str
    xp_earned: int = 15

class AddTimeRequest(BaseModel):
    minutes: int

class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_active_date: Optional[str]

class StatsResponse(BaseModel):
    total_xp: int
    level: int
    current_streak: int
    longest_streak: int
    completed_lessons: List[str]
    badges: List[dict]

class BadgeAwardRequest(BaseModel):
    badge_id: str
    badge_title: str


# ═══════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════

@router.get("/stats")
async def get_learning_stats(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """
    Get comprehensive learning stats for a user.
    Returns XP, streak, completed lessons, and badges.
    """
    try:
        # Get all completed lessons
        result = await db.execute(
            select(LearningProgress).where(LearningProgress.user_id == user_id)
        )
        progress_records = result.scalars().all()
        completed_lessons = [p.lesson_id for p in progress_records]
        total_xp = sum(p.xp_earned for p in progress_records)

        # Get streak
        streak_result = await db.execute(
            select(UserStreak).where(UserStreak.user_id == user_id)
        )
        streak = streak_result.scalar_one_or_none()

        # Get badges
        badge_result = await db.execute(
            select(UserBadge).where(UserBadge.user_id == user_id)
        )
        badges = badge_result.scalars().all()

        # Calculate level
        level = calculate_level(total_xp)

        return {
            "total_xp": total_xp,
            "level": level,
            "current_streak": streak.current_streak if streak else 0,
            "longest_streak": streak.longest_streak if streak else 0,
            "learning_minutes": streak.learning_minutes if streak else 0,
            "last_active_date": streak.last_active_date.isoformat() if streak and streak.last_active_date else None,
            "completed_lessons": completed_lessons,
            "badges": [
                {
                    "badge_id": b.badge_id,
                    "badge_title": b.badge_title,
                    "earned_at": b.earned_at.isoformat() if b.earned_at else None,
                }
                for b in badges
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@router.post("/progress")
async def complete_lesson(
    request: CompleteLessonRequest, 
    background_tasks: BackgroundTasks,
    user_id: int = 1, 
    db: AsyncSession = Depends(get_db)
):
    """
    Mark a lesson as completed and award XP.
    """
    try:
        # Check if already completed
        existing = await db.execute(
            select(LearningProgress).where(
                LearningProgress.user_id == user_id,
                LearningProgress.lesson_id == request.lesson_id,
            )
        )
        if existing.scalar_one_or_none():
            return {"status": "already_completed", "xp_earned": 0}

        # Get lesson xp_reward from DB
        lesson_res = await db.execute(select(Lesson).where(Lesson.id == int(request.lesson_id)))
        lesson = lesson_res.scalar_one_or_none()
        actual_xp = lesson.xp_reward if (lesson and lesson.xp_reward) else request.xp_earned

        # Create progress record
        progress = LearningProgress(
            user_id=user_id,
            lesson_id=request.lesson_id,
            track_id=request.track_id,
            xp_earned=actual_xp,
            completed_at=datetime.utcnow(),
        )
        db.add(progress)

        # Update streak
        await update_streak(db, user_id)

        await db.commit()

        # [GAMIFICATION] Check for badges in background
        background_tasks.add_task(check_and_grant_badges, user_id)

        return {"status": "completed", "xp_earned": actual_xp}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to complete lesson: {str(e)}")

@router.post("/time")
async def add_learning_time(request: AddTimeRequest, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """
    Increment user's total learning time (active session tracking).
    """
    try:
        # Get or setup streak model since that's where learning_minutes lives
        streak = await update_streak(db, user_id)
        
        # Add time
        streak.learning_minutes = (streak.learning_minutes or 0) + request.minutes
        await db.commit()
        
        return {
            "status": "success", 
            "added": request.minutes, 
            "total_learning_minutes": streak.learning_minutes
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to log learning time: {str(e)}")


@router.post("/streak")
async def update_user_streak(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """
    Update the user's daily learning streak.
    """
    try:
        streak = await update_streak(db, user_id)
        await db.commit()
        return {
            "current_streak": streak.current_streak,
            "longest_streak": streak.longest_streak,
            "last_active_date": streak.last_active_date.isoformat() if streak.last_active_date else None,
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update streak: {str(e)}")


@router.post("/badge")
async def award_badge(request: BadgeAwardRequest, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """
    Award a badge to the user.
    """
    try:
        # Check if already awarded
        existing = await db.execute(
            select(UserBadge).where(
                UserBadge.user_id == user_id,
                UserBadge.badge_id == request.badge_id,
            )
        )
        if existing.scalar_one_or_none():
            return {"status": "already_awarded"}

        badge = UserBadge(
            user_id=user_id,
            badge_id=request.badge_id,
            badge_title=request.badge_title,
            earned_at=datetime.utcnow(),
        )
        db.add(badge)
        await db.commit()

        return {"status": "awarded", "badge_id": request.badge_id}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to award badge: {str(e)}")


@router.get("/tracks")
async def get_tracks(db: AsyncSession = Depends(get_db)):
    """
    Returns the structured learning tracks from the CMS database.
    (Tracks -> Modules -> SubModules -> Lessons)
    """
    try:
        # Fetch tracks with sub-resources eagerly loaded
        result = await db.execute(
            select(Track)
            .options(
                joinedload(Track.modules).joinedload(Module.sub_modules).joinedload(SubModule.lessons),
                joinedload(Track.modules).joinedload(Module.lessons)
            )
            .order_by(Track.sort_order.asc(), Track.id.asc())
        )
        tracks = result.unique().scalars().all()
        
        tracks_data = []
        for track in tracks:
            t_data = {
                "id": str(track.id),
                "title": track.title,
                "description": track.description,
                "modules": [],
                "totalLessons": 0
            }
            
            sorted_modules = sorted(track.modules, key=lambda m: (getattr(m, 'sort_order', 0), m.id))
            for module in sorted_modules:
                m_data = {
                    "id": str(module.id),
                    "title": module.title,
                    "description": module.description,
                    "estimatedMinutes": 0,
                    "subModules": [],
                    "lessons": [] # Direct lessons if any
                }
                
                # 1. Process SubModules (Chapters)
                sorted_sub_modules = sorted(module.sub_modules, key=lambda sm: (getattr(sm, 'sort_order', 0), sm.id))
                for sm in sorted_sub_modules:
                    sm_data = {
                        "id": str(sm.id),
                        "title": sm.title,
                        "description": sm.description,
                        "subModuleNumber": sm.sub_module_number,
                        "lessons": []
                    }
                    
                    # Lessons in this sub-module
                    published_sm_lessons = [l for l in sm.lessons if l.is_published]
                    sorted_sm_lessons = sorted(published_sm_lessons, key=lambda l: (getattr(l, 'sort_order', 0), l.id))
                    
                    for lesson in sorted_sm_lessons:
                        duration = lesson.read_time or 5
                        lesson_data = {
                            "id": str(lesson.id),
                            "title": lesson.title,
                            "duration": duration,
                            "type": "article",
                            "xpReward": lesson.xp_reward or 50
                        }
                        if lesson.quiz_questions:
                            lesson_data["type"] = "quiz"
                        if getattr(lesson, 'practice_scene_id', None) and lesson.practice_scene_id != "None":
                            lesson_data["type"] = "interactive"
                            
                        sm_data["lessons"].append(lesson_data)
                        t_data["totalLessons"] += 1
                        m_data["estimatedMinutes"] += duration
                        
                    m_data["subModules"].append(sm_data)
                
                # 2. Check for direct lessons on the module (fallback or special items)
                direct_lessons = [l for l in module.lessons if getattr(l, 'sub_module_id', None) is None and l.is_published]
                sorted_direct = sorted(direct_lessons, key=lambda l: (getattr(l, 'sort_order', 0), l.id))
                for lesson in sorted_direct:
                    duration = lesson.read_time or 5
                    
                    lesson_data = {
                        "id": str(lesson.id),
                        "title": lesson.title,
                        "duration": duration,
                        "type": "article",
                        "xpReward": lesson.xp_reward or 50
                    }
                    if lesson.quiz_questions:
                        lesson_data["type"] = "quiz"
                    if getattr(lesson, 'practice_scene_id', None) and lesson.practice_scene_id != "None":
                        lesson_data["type"] = "interactive"
                        
                    m_data["lessons"].append(lesson_data)
                    t_data["totalLessons"] += 1
                    m_data["estimatedMinutes"] += duration
                    
                t_data["modules"].append(m_data)
                
            tracks_data.append(t_data)
            
        return tracks_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tracks: {str(e)}")

# ═══════════════════════════════════════════
# TOPIC TAGS (#TopicRef Knowledge Graph)
# ═══════════════════════════════════════════

@router.get("/tags")
async def get_all_tags(db: AsyncSession = Depends(get_db)):
    """Returns all registered topic tags for client-side matching."""
    try:
        result = await db.execute(select(TopicTag).order_by(TopicTag.usage_count.desc()))
        tags = result.scalars().all()
        return [
            {
                "id": t.id,
                "tagName": t.tag_name,
                "displayName": t.display_name,
                "shortSummary": t.short_summary,
                "targetType": t.target_type,
                "targetId": str(t.target_id),
                "iconEmoji": t.icon_emoji,
                "usageCount": t.usage_count
            }
            for t in tags
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tags: {str(e)}")


@router.get("/tags/{tag_name}")
async def get_tag_detail(tag_name: str, db: AsyncSession = Depends(get_db)):
    """Returns a single tag with full resolution (target title, breadcrumb, navigate URL)."""
    try:
        result = await db.execute(
            select(TopicTag).where(TopicTag.tag_name == tag_name.lower())
        )
        tag = result.scalar_one_or_none()
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        # Resolve target title and build navigation URL
        target_title = ""
        navigate_to = "/learn"
        breadcrumb = ""
        
        if tag.target_type == 'track':
            res = await db.execute(select(Track).where(Track.id == tag.target_id))
            t = res.scalar_one_or_none()
            if t:
                target_title = t.title
                navigate_to = f"/learn/track/{t.id}"
                breadcrumb = t.title
        elif tag.target_type == 'module':
            res = await db.execute(select(Module).options(joinedload(Module.track)).where(Module.id == tag.target_id))
            m = res.scalar_one_or_none()
            if m:
                target_title = m.title
                navigate_to = f"/learn/module/{m.id}"
                breadcrumb = f"{m.track.title} > {m.title}" if m.track else m.title
        elif tag.target_type == 'chapter':
            res = await db.execute(
                select(SubModule).options(joinedload(SubModule.module).joinedload(Module.track))
                .where(SubModule.id == tag.target_id)
            )
            sm = res.scalar_one_or_none()
            if sm:
                target_title = sm.title
                navigate_to = f"/learn/chapter/{sm.id}"
                breadcrumb = f"{sm.module.track.title} > {sm.module.title} > {sm.title}" if sm.module and sm.module.track else sm.title
        elif tag.target_type == 'lesson':
            res = await db.execute(
                select(Lesson).options(joinedload(Lesson.module).joinedload(Module.track))
                .where(Lesson.id == tag.target_id)
            )
            l = res.scalar_one_or_none()
            if l:
                target_title = l.title
                navigate_to = f"/learn/chapter/{l.sub_module_id}" if l.sub_module_id else f"/learn/module/{l.module_id}"
                breadcrumb = f"{l.module.track.title} > {l.module.title} > {l.title}" if l.module and l.module.track else l.title
        
        return {
            "tagName": tag.tag_name,
            "displayName": tag.display_name,
            "shortSummary": tag.short_summary,
            "targetType": tag.target_type,
            "targetId": str(tag.target_id),
            "targetTitle": target_title,
            "breadcrumb": breadcrumb,
            "navigateTo": navigate_to,
            "iconEmoji": tag.icon_emoji
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve tag: {str(e)}")


@router.post("/tags/{tag_id}/click")
async def record_tag_click(tag_id: int, db: AsyncSession = Depends(get_db)):
    """Increment usage count for analytics (fire-and-forget)."""
    try:
        await db.execute(
            update(TopicTag).where(TopicTag.id == tag_id).values(usage_count=TopicTag.usage_count + 1)
        )
        await db.commit()
        return {"status": "ok"}
    except Exception:
        return {"status": "ok"}  # Don't fail the UX for analytics


# ═══════════════════════════════════════════
# TIPTAP JSON → HTML CONVERTER
# ═══════════════════════════════════════════

def tiptap_to_html(doc: dict) -> str:
    """Convert TipTap/ProseMirror JSON document to HTML string."""
    if not doc or not isinstance(doc, dict):
        return ""
    
    content = doc.get("content", [])
    return "".join(_render_node(node) for node in content)


def _render_node(node: dict) -> str:
    """Recursively render a TipTap node to HTML."""
    node_type = node.get("type", "")
    attrs = node.get("attrs", {})
    children = node.get("content", [])
    marks = node.get("marks", [])
    text = node.get("text", "")
    
    # Text node
    if node_type == "text":
        html = _escape_html(text)
        for mark in marks:
            mark_type = mark.get("type", "")
            if mark_type == "bold":
                html = f"<strong>{html}</strong>"
            elif mark_type == "italic":
                html = f"<em>{html}</em>"
            elif mark_type == "underline":
                html = f"<u>{html}</u>"
            elif mark_type == "strike":
                html = f"<s>{html}</s>"
            elif mark_type == "code":
                html = f"<code>{html}</code>"
            elif mark_type == "link":
                href = mark.get("attrs", {}).get("href", "#")
                html = f'<a href="{href}" target="_blank" rel="noopener">{html}</a>'
        return html
    
    inner = "".join(_render_node(child) for child in children)
    
    if node_type == "paragraph":
        align = attrs.get("textAlign")
        style = f' style="text-align:{align}"' if align else ""
        return f"<p{style}>{inner}</p>"
    elif node_type == "heading":
        level = attrs.get("level", 1)
        return f"<h{level}>{inner}</h{level}>"
    elif node_type == "bulletList":
        return f"<ul>{inner}</ul>"
    elif node_type == "orderedList":
        return f"<ol>{inner}</ol>"
    elif node_type == "listItem":
        return f"<li>{inner}</li>"
    elif node_type == "blockquote":
        return f"<blockquote>{inner}</blockquote>"
    elif node_type == "codeBlock":
        return f"<pre><code>{inner}</code></pre>"
    elif node_type == "image":
        src = attrs.get("src", "")
        alt = attrs.get("alt", "")
        return f'<img src="{src}" alt="{alt}" />'
    elif node_type == "hardBreak":
        return "<br />"
    elif node_type == "horizontalRule":
        return "<hr />"
    elif node_type == "topicTag":
        tag_name = attrs.get("tagName", "")
        display = attrs.get("displayName", tag_name)
        return f'<span class="topic-tag" data-tag="{_escape_html(tag_name)}" data-display="{_escape_html(display)}">#{_escape_html(display)}</span>'
    elif node_type == "doc":
        return inner
    else:
        return inner


def _escape_html(text: str) -> str:
    """Basic HTML entity escaping."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ═══════════════════════════════════════════
# MODULE DETAIL ENDPOINT
# ═══════════════════════════════════════════

@router.get("/modules/{module_id}")
async def get_module_detail(module_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns the module details with all its lessons listed (Varsity-style chapter index).
    """
    try:
        result = await db.execute(
            select(Module)
            .options(
                joinedload(Module.sub_modules).joinedload(SubModule.lessons),
                joinedload(Module.lessons),
                joinedload(Module.track)
            )
            .where(Module.id == module_id)
        )
        module = result.unique().scalar_one_or_none()
        
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
        
        # Collect sub-modules and their lessons
        sub_modules_data = []
        sorted_sms = sorted(module.sub_modules, key=lambda x: (getattr(x, 'sort_order', 0), x.id))
        
        total_lessons_count = 0
        for sm in sorted_sms:
            sm_lessons = []
            published_lessons = [l for l in sm.lessons if l.is_published]
            for lesson in sorted(published_lessons, key=lambda x: (getattr(x, 'sort_order', 0), x.id)):
                sm_lessons.append({
                    "id": str(lesson.id),
                    "title": lesson.title,
                    "lessonNumber": lesson.lesson_number,
                    "description": _get_lesson_preview(lesson),
                    "duration": lesson.read_time or 5,
                    "xpReward": lesson.xp_reward or 50,
                    "type": "quiz" if lesson.quiz_questions else "article"
                })
                total_lessons_count += 1
            
            sub_modules_data.append({
                "id": str(sm.id),
                "title": sm.title,
                "description": sm.description,
                "lessons": sm_lessons
            })

        # Also check direct lessons
        direct_lessons_data = []
        direct_lessons = [l for l in module.lessons if getattr(l, 'sub_module_id', None) is None and l.is_published]
        sorted_direct = sorted(direct_lessons, key=lambda l: (getattr(l, 'sort_order', 0), l.id))
        for lesson in sorted_direct:
            direct_lessons_data.append({
                "id": str(lesson.id),
                "title": lesson.title,
                "lessonNumber": lesson.lesson_number,
                "description": _get_lesson_preview(lesson),
                "duration": lesson.read_time or 5,
                "xpReward": lesson.xp_reward or 50,
                "type": "quiz" if lesson.quiz_questions else "article"
            })
            total_lessons_count += 1
        
        return {
            "id": str(module.id),
            "title": module.title,
            "description": module.description,
            "moduleNumber": module.module_number,
            "trackId": str(module.track_id),
            "trackTitle": module.track.title if module.track else "",
            "subModules": sub_modules_data,
            "directLessons": direct_lessons_data,
            "totalLessons": total_lessons_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch module: {str(e)}")


def _get_lesson_preview(lesson) -> str:
    """Extract a short text preview from the lesson content JSON."""
    if not lesson.content or not isinstance(lesson.content, dict):
        return ""
    content_nodes = lesson.content.get("content", [])
    texts = []
    for node in content_nodes:
        if node.get("type") == "paragraph":
            for child in node.get("content", []):
                if child.get("type") == "text":
                    texts.append(child.get("text", ""))
        if len(" ".join(texts)) > 150:
            break
    preview = " ".join(texts)
    return (preview[:150] + " ..") if len(preview) > 150 else preview


# ═══════════════════════════════════════════
# LESSON DETAIL ENDPOINT
# ═══════════════════════════════════════════

@router.get("/sub-modules/{sub_module_id}")
async def get_sub_module_detail(sub_module_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns full detail of a sub-module (chapter) including all lessons with their content.
    This is for the 'long-scrolling' chapter page.
    """
    try:
        result = await db.execute(
            select(SubModule)
            .options(
                joinedload(SubModule.lessons),
                joinedload(SubModule.module).joinedload(Module.track)
            )
            .where(SubModule.id == sub_module_id)
        )
        sub_module = result.unique().scalar_one_or_none()
        
        if not sub_module:
            raise HTTPException(status_code=404, detail="Chapter not found")
        
        lessons_data = []
        published_lessons = [l for l in sub_module.lessons if l.is_published]
        for lesson in sorted(published_lessons, key=lambda x: (getattr(x, 'sort_order', 0), x.id)):
            # Convert TipTap JSON to HTML
            content_html = tiptap_to_html(lesson.content) if lesson.content else ""
            if not content_html:
                parts = []
                if lesson.opening_hook: parts.append(f"<p>{lesson.opening_hook}</p>")
                if lesson.core_explanation: parts.append(lesson.core_explanation)
                if lesson.real_life_application: parts.append(f"<h3>Application</h3>{lesson.real_life_application}")
                content_html = "".join(parts)

            lessons_data.append({
                "id": str(lesson.id),
                "title": lesson.title,
                "lessonNumber": lesson.lesson_number,
                "contentHtml": content_html,
                "duration": lesson.read_time or 5,
                "xpReward": lesson.xp_reward or 50,
                "type": "quiz" if lesson.quiz_questions else "article",
                "quizQuestions": lesson.quiz_questions if lesson.quiz_questions else [],
                "practiceSceneId": getattr(lesson, 'practice_scene_id', None)
            })
            
        # ═══════════════════════════════════════════
        # CALCULATE PREV/NEXT CHAPTER NAVIGATION
        # ═══════════════════════════════════════════
        # We find all sub-modules in the same track to allow crossing module boundaries
        track_id = sub_module.module.track_id
        all_sm_result = await db.execute(
            select(SubModule)
            .join(Module)
            .where(Module.track_id == track_id)
            .options(joinedload(SubModule.module))
            .order_by(Module.sort_order, Module.id, SubModule.sort_order, SubModule.id)
        )
        all_track_sms = all_sm_result.scalars().all()
        
        sm_ids = [sm.id for sm in all_track_sms]
        current_idx = sm_ids.index(sub_module.id)
        
        prev_id = str(sm_ids[current_idx - 1]) if current_idx > 0 else None
        next_id = str(sm_ids[current_idx + 1]) if current_idx < len(sm_ids) - 1 else None

        return {
            "id": str(sub_module.id),
            "title": sub_module.title,
            "description": sub_module.description,
            "subModuleNumber": sub_module.sub_module_number,
            "moduleId": str(sub_module.module_id),
            "moduleTitle": sub_module.module.title,
            "trackId": str(sub_module.module.track_id),
            "trackTitle": sub_module.module.track.title,
            "prev_id": prev_id,
            "next_id": next_id,
            "lessons": lessons_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch chapter: {str(e)}")


@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns the full lesson content as HTML, with sibling lessons for prev/next navigation.
    """
    try:
        result = await db.execute(
            select(Lesson).where(Lesson.id == lesson_id)
        )
        lesson = result.scalar_one_or_none()
        
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")
        
        # Convert TipTap JSON to HTML
        content_html = tiptap_to_html(lesson.content) if lesson.content else ""
        
        # If content_html is empty, try the legacy fields
        if not content_html:
            parts = []
            if lesson.opening_hook:
                parts.append(lesson.opening_hook)
            if lesson.core_explanation:
                parts.append(lesson.core_explanation)
            if lesson.real_life_application:
                parts.append(f"<h2>Real-World Application</h2>{lesson.real_life_application}")
            content_html = "".join(parts)
        
        # Get module info and sibling lessons for navigation
        module_title = ""
        track_id = ""
        siblings = []
        
        if lesson.module_id:
            mod_result = await db.execute(
                select(Module)
                .options(
                    joinedload(Module.lessons),
                    joinedload(Module.sub_modules).joinedload(SubModule.lessons)
                )
                .where(Module.id == lesson.module_id)
            )
            module = mod_result.unique().scalar_one_or_none()
            if module:
                module_title = module.title
                track_id = str(module.track_id)
                
                # Gather all published lessons in this module in order
                all_mod_lessons = []
                
                direct = [l for l in module.lessons if getattr(l, 'sub_module_id', None) is None and l.is_published]
                for l in sorted(direct, key=lambda x: (getattr(x, 'sort_order', 0), x.id)):
                    all_mod_lessons.append({"id": str(l.id), "title": l.title})
                
                siblings = all_mod_lessons
        
        return {
            "id": str(lesson.id),
            "title": lesson.title,
            "lessonNumber": lesson.lesson_number,
            "contentHtml": content_html,
            "moduleId": str(lesson.module_id) if lesson.module_id else None,
            "moduleTitle": module_title,
            "trackId": track_id,
            "duration": lesson.read_time or 5,
            "xpReward": lesson.xp_reward or 50,
            "type": "quiz" if lesson.quiz_questions else "article",
            "quizQuestions": lesson.quiz_questions if lesson.quiz_questions else [],
            "practiceSceneId": getattr(lesson, 'practice_scene_id', None),
            "siblings": siblings
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch lesson: {str(e)}")

# ═══════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════

async def update_streak(db: AsyncSession, user_id: int) -> "UserStreak":
    """
    Update the user's learning streak based on the current date.
    """
    result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    )
    streak = result.scalar_one_or_none()

    today = date.today()

    if not streak:
        streak = UserStreak(
            user_id=user_id,
            current_streak=1,
            longest_streak=1,
            last_active_date=today,
        )
        db.add(streak)
        return streak

    if streak.last_active_date == today:
        return streak  # Already active today

    yesterday = today - timedelta(days=1)
    if streak.last_active_date == yesterday:
        streak.current_streak += 1
    else:
        streak.current_streak = 1  # Streak broken, reset

    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
    streak.last_active_date = today

    return streak


def calculate_level(xp: int) -> int:
    """Calculate level from total XP."""
    thresholds = [0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250, 3000]
    for i in range(len(thresholds) - 1, -1, -1):
        if xp >= thresholds[i]:
            return i + 1
    return 1
