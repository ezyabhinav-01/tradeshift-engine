from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, distinct
from typing import List
from datetime import datetime
import asyncio
import time
from app.database import get_db
from app.database import get_session
from app.models import CommunityChannel, CommunityMessage, User
from app.schemas import Channel, ChannelCreate, Message, MessageCreate, CommunityUser
from app.routers.trading import _get_user_id
from app.websocket_manager import order_manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/community", tags=["community"])

DEFAULT_COMMUNITY_CHANNELS = [
    {"name": "general", "description": "General discussion for everyone."},
    {"name": "news", "description": "Breaking market and macro news discussion."},
    {"name": "trading-strategies", "description": "Share setups, entries, and strategy ideas."},
    {"name": "module-discussion", "description": "Discuss course modules and learning content."},
    {"name": "market-insights", "description": "Market trends, sentiment, and observations."},
]
_DEFAULT_CHANNEL_ORDER = {name: idx for idx, name in enumerate(ch["name"] for ch in DEFAULT_COMMUNITY_CHANNELS)}


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


async def _ensure_default_channels(db: AsyncSession) -> None:
    names_result = await db.execute(select(CommunityChannel.name))
    existing_names = {name for (name,) in names_result.all()}
    missing = [ch for ch in DEFAULT_COMMUNITY_CHANNELS if ch["name"] not in existing_names]
    if not missing:
        return
    for channel in missing:
        db.add(CommunityChannel(**channel))
    await db.commit()
    logger.info("✅ Added %s missing community channels.", len(missing))


async def _persist_message_async(
    sender_id: int,
    content: str,
    channel_id: int | None,
    recipient_id: int | None,
    timestamp: datetime,
    client_temp_id: int,
) -> None:
    db = await get_session()
    try:
        db_msg = CommunityMessage(
            sender_id=sender_id,
            content=content,
            channel_id=channel_id,
            recipient_id=recipient_id,
            timestamp=timestamp,
        )
        db.add(db_msg)
        await db.commit()
        await db.refresh(db_msg)

        await order_manager.emit_to_user(
            sender_id,
            "community_message_status",
            {
                "client_temp_id": client_temp_id,
                "saved": True,
                "server_id": db_msg.id,
                "timestamp": db_msg.timestamp.isoformat(),
            },
        )
    except Exception as exc:
        logger.exception("❌ Failed to persist community message asynchronously: %s", exc)
        try:
            await db.rollback()
        except Exception:
            pass
        await order_manager.emit_to_user(
            sender_id,
            "community_message_status",
            {
                "client_temp_id": client_temp_id,
                "saved": False,
                "error": "Could not save message",
            },
        )
    finally:
        await db.close()


@router.get("/channels", response_model=List[Channel])
async def get_channels(db: AsyncSession = Depends(get_db)):
    """List all community channels."""
    await _ensure_default_channels(db)
    result = await db.execute(select(CommunityChannel))
    channels = result.scalars().all()
    return sorted(channels, key=lambda ch: _DEFAULT_CHANNEL_ORDER.get(ch.name, 999))


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
    """Save message to DB async and broadcast via WebSocket instantly."""
    user_id = await _get_user_id(request, db)
    
    # Use shared service for instant broadcast and background persistence
    from app.services.community_service import process_and_broadcast_message
    
    ws_payload = await process_and_broadcast_message(
        sender_id=user_id,
        content=msg.content,
        channel_id=msg.channel_id,
        recipient_id=msg.recipient_id,
        client_temp_id=msg.client_temp_id,
        wait_for_persist=True,
    )

    return Message(**ws_payload)



@router.get("/users", response_model=List[CommunityUser])
async def get_community_users(request: Request, db: AsyncSession = Depends(get_db)):
    """Get list of users for DMs (kept for backward compat)."""
    current_user_id = await _get_user_id(request, db)

    result = await db.execute(select(User))
    users = result.scalars().all()

    connected_users = order_manager.get_connected_users()

    community_users = []
    for u in users:
        if u.id == current_user_id:
            continue
        is_online = f"user-{u.id}" in connected_users
        community_users.append(CommunityUser(
            id=u.id,
            full_name=u.full_name or u.email,
            email=u.email,
            is_online=is_online
        ))

    return community_users


@router.get("/users/lookup", response_model=CommunityUser)
async def lookup_user(
    q: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Find a user by exact email or demat_id. Used before initiating a new DM."""
    current_user_id = await _get_user_id(request, db)
    q = q.strip()

    result = await db.execute(
        select(User).filter(
            or_(User.email == q, User.demat_id == q)
        )
    )
    target = result.scalars().first()

    if not target:
        raise HTTPException(status_code=404, detail="No user found with that email or Demat ID.")
    if target.id == current_user_id:
        raise HTTPException(status_code=400, detail="You cannot message yourself.")

    connected_users = order_manager.get_connected_users()
    is_online = f"user-{target.id}" in connected_users

    return CommunityUser(
        id=target.id,
        full_name=target.full_name or target.email,
        email=target.email,
        is_online=is_online
    )


@router.get("/dm-contacts", response_model=List[CommunityUser])
async def get_dm_contacts(request: Request, db: AsyncSession = Depends(get_db)):
    """Return all users the current user has ever exchanged a DM with, ordered by most recent."""
    user_id = await _get_user_id(request, db)

    # Find all messages where current user is sender OR recipient (direct messages only)
    result = await db.execute(
        select(CommunityMessage)
        .filter(
            CommunityMessage.channel_id.is_(None),  # DMs have no channel_id
            or_(
                CommunityMessage.sender_id == user_id,
                CommunityMessage.recipient_id == user_id,
            )
        )
        .order_by(CommunityMessage.timestamp.desc())
    )
    dms = result.scalars().all()

    # Collect unique partner IDs preserving recency order
    seen: set[int] = set()
    partner_ids: list[int] = []
    for dm in dms:
        partner = dm.recipient_id if dm.sender_id == user_id else dm.sender_id
        if partner and partner not in seen:
            seen.add(partner)
            partner_ids.append(partner)

    if not partner_ids:
        return []

    # Fetch user records for those partners
    users_result = await db.execute(select(User).filter(User.id.in_(partner_ids)))
    users_map = {u.id: u for u in users_result.scalars().all()}

    connected_users = order_manager.get_connected_users()

    contacts = []
    for pid in partner_ids:
        u = users_map.get(pid)
        if not u:
            continue
        contacts.append(CommunityUser(
            id=u.id,
            full_name=u.full_name or u.email,
            email=u.email,
            is_online=f"user-{u.id}" in connected_users,
        ))

    return contacts


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
