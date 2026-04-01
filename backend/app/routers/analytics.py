from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from app.database import get_db
from app.models import User, PageEngagement
from app.dependencies import get_current_user
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/analytics", tags=["analytics"])

class PageEngagementRequest(BaseModel):
    page_path: str
    duration_seconds: int
    session_id: Optional[str] = None

@router.post("/heartbeat")
async def user_heartbeat(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the user's last_active_at timestamp to track real-time active users.
    Called periodically (e.g., every 60s) from the frontend.
    """
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(last_active_at=datetime.utcnow())
    )
    await db.commit()
    return {"status": "ok", "last_active_at": datetime.utcnow()}

@router.post("/page-engagement")
async def log_page_engagement(
    req: PageEngagementRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Logs time spent on a specific page. 
    Called on route change or periodically with incremental duration.
    """
    new_engagement = PageEngagement(
        user_id=current_user.id,
        page_path=req.page_path,
        duration_seconds=req.duration_seconds,
        session_id=req.session_id,
        timestamp=datetime.utcnow()
    )
    db.add(new_engagement)
    
    # Also update heartbeat during engagement logging
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(last_active_at=datetime.utcnow())
    )
    
    await db.commit()
    return {"status": "logged", "page": req.page_path}
