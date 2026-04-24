from datetime import datetime
import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.models import CommunityMessage, User
from app.websocket_manager import order_manager
from sqlalchemy import select

logger = logging.getLogger(__name__)

async def process_and_broadcast_message(
    sender_id: int,
    content: str,
    channel_id: int | None = None,
    recipient_id: int | None = None,
    client_temp_id: int | None = None,
):
    """
    Core logic for handling a new community or direct message:
    1. Resolve sender info
    2. Broadcast immediately via WebSocket
    3. Persist to database in background
    """
    now = datetime.utcnow()
    
    # 1. Resolve sender name
    db = await get_session()
    try:
        sender_res = await db.execute(
            select(User.full_name, User.email).filter(User.id == sender_id)
        )
        sender = sender_res.first()
        sender_name = (sender[0] or sender[1]) if sender else "Unknown"
    finally:
        await db.close()

    # 2. Prepare broadcast payload
    # Use client_temp_id if provided (and ensure it's negative to denote 'not yet saved')
    msg_id = client_temp_id if (client_temp_id and client_temp_id < 0) else -int(now.timestamp())
    
    ws_payload = {
        "id": msg_id,
        "content": content,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "channel_id": channel_id,
        "recipient_id": recipient_id,
        "timestamp": now.isoformat(),
    }

    # 3. Broadcast immediately
    if channel_id:
        asyncio.create_task(
            order_manager.emit_to_channel(channel_id, "community_message", ws_payload)
        )
    elif recipient_id:
        # Broadcast to both recipient and sender (for sync across multiple tabs)
        asyncio.create_task(
            order_manager.emit_to_user(recipient_id, "direct_message", ws_payload)
        )
        if recipient_id != sender_id:
            asyncio.create_task(
                order_manager.emit_to_user(sender_id, "direct_message", ws_payload)
            )

    # 4. Persist to DB in background
    asyncio.create_task(
        _persist_message(
            sender_id=sender_id,
            content=content,
            channel_id=channel_id,
            recipient_id=recipient_id,
            timestamp=now,
            client_temp_id=msg_id
        )
    )
    
    return ws_payload

async def _persist_message(
    sender_id: int,
    content: str,
    channel_id: int | None,
    recipient_id: int | None,
    timestamp: datetime,
    client_temp_id: int,
):
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

        # Notify the sender that it was saved and give them the real ID
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
        logger.exception("❌ Failed to persist community message: %s", exc)
        await order_manager.emit_to_user(
            sender_id,
            "community_message_status",
            {
                "client_temp_id": client_temp_id,
                "saved": False,
                "error": str(exc),
            },
        )
    finally:
        await db.close()
