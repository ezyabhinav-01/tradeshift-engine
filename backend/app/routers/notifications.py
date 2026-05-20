from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_
from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from app.database import get_db
from app.models import Notification, User, BroadcastRead
from app.schemas import NotificationResponse
from app.dependencies import get_current_user, admin_or_internal
from app.websocket_manager import order_manager

router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"],
    responses={404: {"description": "Not found"}},
)


class BroadcastRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=140)
    content: str = Field(..., min_length=1, max_length=2000)
    type: Literal["info", "warning", "success", "error"] = "info"


def _notification_payload(notification: Notification, is_read: Optional[bool] = None) -> dict:
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "title": notification.title,
        "content": notification.content,
        "type": notification.type,
        "is_read": notification.is_read if is_read is None else is_read,
        "category": notification.category,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


@router.get("/", response_model=List[NotificationResponse])
async def get_user_notifications(
    skip: int = Query(0, ge=0, le=5000),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Fetch all notifications for the current authenticated user,
    including broadcast notifications (user_id IS NULL).
    """
    try:
        # Fetch user-specific + broadcast notifications
        query = (
            select(Notification)
            .where(
                or_(
                    Notification.user_id == current_user.id,
                    Notification.user_id.is_(None)  # Broadcast notifications
                )
            )
            .order_by(Notification.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        notifications = result.scalars().all()

        # Fetch broadcast read status for this user
        broadcast_ids = [n.id for n in notifications if n.user_id is None]
        read_broadcast_ids = set()
        if broadcast_ids:
            reads_result = await db.execute(
                select(BroadcastRead.notification_id).where(
                    BroadcastRead.user_id == current_user.id,
                    BroadcastRead.notification_id.in_(broadcast_ids)
                )
            )
            read_broadcast_ids = {row[0] for row in reads_result.all()}

        # Build response: for broadcasts, override is_read based on BroadcastRead
        response = []
        for n in notifications:
            data = _notification_payload(
                n,
                is_read=n.is_read if n.user_id is not None else (n.id in read_broadcast_ids),
            )
            response.append(data)

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch notifications")


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Mark a specific notification as read.
    For broadcast notifications, creates a BroadcastRead entry.
    """
    try:
        query = select(Notification).where(Notification.id == notification_id)
        result = await db.execute(query)
        notification = result.scalars().first()
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        # Handle broadcast notifications differently
        if notification.user_id is None:
            # Check if already read by this user
            existing = await db.execute(
                select(BroadcastRead).where(
                    BroadcastRead.user_id == current_user.id,
                    BroadcastRead.notification_id == notification_id
                )
            )
            if not existing.scalar_one_or_none():
                from datetime import datetime
                db.add(BroadcastRead(
                    user_id=current_user.id,
                    notification_id=notification_id,
                    read_at=datetime.utcnow()
                ))
                await db.commit()
            
            # Return the notification with is_read = True
            return _notification_payload(notification, is_read=True)
        else:
            # User-specific notification
            if notification.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Notification not found")
            
            notification.is_read = True
            await db.commit()
            await db.refresh(notification)
            return notification

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update notification")


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Mark all notifications as read for the current user.
    Handles both user-specific and broadcast notifications.
    """
    try:
        from sqlalchemy import update
        from datetime import datetime

        # 1. Mark user-specific notifications as read
        stmt = update(Notification).where(
            Notification.user_id == current_user.id, 
            Notification.is_read == False
        ).values(is_read=True)
        await db.execute(stmt)

        # 2. Mark all unread broadcasts as read for this user
        broadcast_result = await db.execute(
            select(Notification.id, Notification.created_at).where(Notification.user_id.is_(None))
        )
        # Create a mapping of id -> created_at for all broadcasts
        broadcast_map = {row[0]: row[1] for row in broadcast_result.all()}
        all_broadcast_ids = set(broadcast_map.keys())

        already_read = await db.execute(
            select(BroadcastRead.notification_id).where(
                BroadcastRead.user_id == current_user.id
            )
        )
        already_read_ids = {row[0] for row in already_read.all()}

        unread_broadcast_ids = all_broadcast_ids - already_read_ids
        for bid in unread_broadcast_ids:
            db.add(BroadcastRead(
                user_id=current_user.id,
                notification_id=bid,
                read_at=datetime.utcnow()
            ))
        
        await db.commit()
        
        return {"message": "All notifications marked as read"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to mark notifications")


@router.post("/broadcast")
async def send_broadcast(
    request: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(admin_or_internal),
):
    """
    Send a broadcast notification to all users.
    Creates a notification with user_id = NULL.
    """
    try:
        from datetime import datetime

        notification = Notification(
            user_id=None,  # NULL = broadcast to all
            title=request.title,
            content=request.content,
            type=request.type,
            category='official',
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        payload = _notification_payload(notification, is_read=False)
        await order_manager.emit_to_all("notification:new", payload)

        return {
            "status": "sent",
            "id": notification.id,
            "title": notification.title,
            "content": notification.content,
            "type": notification.type,
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to send broadcast")
