from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, desc
from typing import List
from app.database import get_db
from app.models import Notification, User
from app import schemas, auth

router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"]
)

@router.get("/", response_model=List[schemas.Notification])
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    """
    Fetch notifications for the current user, including global broadcasts.
    """
    stmt = select(Notification).where(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id == None
        )
    ).order_by(desc(Notification.created_at))
    
    result = db.execute(stmt)
    return result.scalars().all()

@router.patch("/{notification_id}/read", response_model=schemas.Notification)
async def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    """
    Mark a notification as read.
    NOTE: For global notifications, this currently marks it read for everyone 
    (simplification for v1).
    """
    stmt = select(Notification).where(Notification.id == notification_id)
    result = db.execute(stmt)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification.user_id and notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification
