from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import CommunityChannel, CommunityMessage, User
from app.schemas import Channel, ChannelCreate, Message, MessageCreate, CommunityUser
from app.routers.trading import _get_user_id
from app.websocket_manager import order_manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/community", tags=["community"])


def _to_message(m: CommunityMessage, sender_name: str) -> dict:
    """Convert a CommunityMessage ORM object to a dict compatible with the Message schema."""
    return {
        "id": m.id,
        "content": m.content,
        "sender_id": m.sender_id,
        "channel_id": m.channel_id,
        "recipient_id": m.recipient_id,
        "timestamp": m.timestamp,
        "sender_name": sender_name,
    }


@router.get("/channels", response_model=List[Channel])
async def get_channels(db: AsyncSession = Depends(get_db)):
    """List all community channels."""
    result = await db.execute(select(CommunityChannel))
    return result.scalars().all()


@router.post("/channels", response_model=Channel)
async def create_channel(channel: ChannelCreate, db: AsyncSession = Depends(get_db)):
    """Create a new community channel."""
    db_channel = CommunityChannel(**channel.model_dump())
    db.add(db_channel)
    await db.commit()
    await db.refresh(db_channel)
    return db_channel


@router.get("/channels/{channel_id}/messages", response_model=List[Message])
async def get_channel_messages(channel_id: int, db: AsyncSession = Depends(get_db)):
    """Get history for a specific channel."""
    result = await db.execute(
        select(CommunityMessage)
        .filter(CommunityMessage.channel_id == channel_id)
        .order_by(CommunityMessage.timestamp.asc())
    )
    messages = result.scalars().all()

    enriched_messages = []
    for m in messages:
        sender_res = await db.execute(select(User).filter(User.id == m.sender_id))
        sender = sender_res.scalars().first()
        sender_name = (sender.full_name or sender.email) if sender else "Unknown"
        enriched_messages.append(Message(**_to_message(m, sender_name)))

    return enriched_messages


@router.post("/messages", response_model=Message)
async def send_message(
    msg: MessageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Send a message to a channel or a specific user."""
    user_id = await _get_user_id(request, db)

    # Resolve the actual sender; fallback to first user if the dev user (999) is returned
    sender_res = await db.execute(select(User).filter(User.id == user_id))
    sender = sender_res.scalars().first()

    if not sender:
        first_user_res = await db.execute(select(User).limit(1))
        sender = first_user_res.scalars().first()
        if not sender:
            raise HTTPException(status_code=401, detail="User not found. Please log in.")
        user_id = sender.id

    db_msg = CommunityMessage(
        sender_id=user_id,
        content=msg.content,
        channel_id=msg.channel_id,
        recipient_id=msg.recipient_id,
        timestamp=datetime.utcnow()
    )
    db.add(db_msg)
    await db.commit()
    await db.refresh(db_msg)

    sender_name = sender.full_name or sender.email or "Unknown"
    response_dict = _to_message(db_msg, sender_name)

    # Broadcast via WebSocket
    ws_payload = {**response_dict, "timestamp": response_dict["timestamp"].isoformat()}

    if db_msg.channel_id:
        await order_manager.emit_to_channel(db_msg.channel_id, "community_message", ws_payload)
    elif db_msg.recipient_id:
        await order_manager.emit_to_user(db_msg.recipient_id, "direct_message", ws_payload)
        await order_manager.emit_to_user(user_id, "direct_message", ws_payload)

    return Message(**response_dict)


@router.get("/users", response_model=List[CommunityUser])
async def get_community_users(request: Request, db: AsyncSession = Depends(get_db)):
    """Get list of users for DMs."""
    current_user_id = await _get_user_id(request, db)

    result = await db.execute(select(User))
    users = result.scalars().all()

    connected_users = order_manager.get_connected_users()  # rooms like 'user-1'

    community_users = []
    for u in users:
        if u.id == current_user_id:
            continue  # Skip self
        is_online = f"user-{u.id}" in connected_users
        community_users.append(CommunityUser(
            id=u.id,
            full_name=u.full_name or u.email,
            email=u.email,
            is_online=is_online
        ))

    return community_users


@router.get("/direct-messages/{other_user_id}", response_model=List[Message])
async def get_direct_messages(
    other_user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get DM history between current user and another user."""
    user_id = await _get_user_id(request, db)

    result = await db.execute(
        select(CommunityMessage)
        .filter(
            or_(
                and_(CommunityMessage.sender_id == user_id, CommunityMessage.recipient_id == other_user_id),
                and_(CommunityMessage.sender_id == other_user_id, CommunityMessage.recipient_id == user_id)
            )
        )
        .order_by(CommunityMessage.timestamp.asc())
    )
    messages = result.scalars().all()

    enriched_messages = []
    for m in messages:
        sender_res = await db.execute(select(User).filter(User.id == m.sender_id))
        sender = sender_res.scalars().first()
        sender_name = (sender.full_name or sender.email) if sender else "Unknown"
        enriched_messages.append(Message(**_to_message(m, sender_name)))

    return enriched_messages
