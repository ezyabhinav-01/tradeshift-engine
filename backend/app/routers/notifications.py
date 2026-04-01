from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.models import Notification, User
from app.schemas import NotificationResponse
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[NotificationResponse])
async def get_user_notifications(
    skip: int = 0, 
    limit: int = 50, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Fetch all notifications for the current authenticated user.
    """
    try:
        query = select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        notifications = result.scalars().all()
        return notifications
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Mark a specific notification as read.
    """
    try:
        query = select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
        result = await db.execute(query)
        notification = result.scalars().first()
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
            
        notification.is_read = True
        await db.commit()
        await db.refresh(notification)
        return notification
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mark-all-read")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Mark all notifications as read for the current user.
    """
    try:
        # We can use an update statement, or fetch all and update
        from sqlalchemy import update
        stmt = update(Notification).where(
            Notification.user_id == current_user.id, 
            Notification.is_read == False
        ).values(is_read=True)
        
        await db.execute(stmt)
        await db.commit()
        
        return {"message": "All notifications marked as read"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

