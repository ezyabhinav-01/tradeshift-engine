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
    wait_for_persist: bool = False,
):
    """
    Core logic for handling a new community or direct message:
    1. Resolve sender info
    2. Broadcast immediately with a temporary ID
    3. Persist after broadcast and reconcile the saved DB ID
    """
    if not content or not content.strip():
        raise ValueError("Message content cannot be empty")
    if bool(channel_id) == bool(recipient_id):
        raise ValueError("Message must target exactly one channel or recipient")

    now = datetime.utcnow()
    temp_id = client_temp_id or -int(now.timestamp() * 1000)
    
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

    ws_payload = {
        "id": temp_id,
        "client_temp_id": temp_id,
        "content": content.strip(),
        "sender_id": sender_id,
        "sender_name": sender_name,
        "channel_id": channel_id,
        "recipient_id": recipient_id,
        "timestamp": now.isoformat(),
    }

    # Broadcast first so active clients see the message without waiting for DB I/O.
    if channel_id:
        await order_manager.emit_to_channel(channel_id, "community_message", ws_payload)
    elif recipient_id:
        await order_manager.emit_to_user(recipient_id, "direct_message", ws_payload)
        if recipient_id != sender_id:
            await order_manager.emit_to_user(sender_id, "direct_message", ws_payload)

    persist_coro = _persist_message(
        sender_id=sender_id,
        content=content.strip(),
        channel_id=channel_id,
        recipient_id=recipient_id,
        timestamp=now,
        client_temp_id=temp_id,
    )
    if wait_for_persist:
        await persist_coro
    else:
        asyncio.create_task(persist_coro)

    return ws_payload


async def _emit_persistence_status(
    sender_id: int,
    channel_id: int | None,
    recipient_id: int | None,
    payload: dict,
) -> None:
    if channel_id:
        await order_manager.emit_to_channel(channel_id, "community_message_status", payload)
    elif recipient_id:
        await order_manager.emit_to_user(recipient_id, "community_message_status", payload)
        if recipient_id != sender_id:
            await order_manager.emit_to_user(sender_id, "community_message_status", payload)
    else:
        await order_manager.emit_to_user(sender_id, "community_message_status", payload)


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

        # Notify all viewers of this realtime message so temporary IDs become DB IDs.
        if client_temp_id is not None:
            await _emit_persistence_status(
                sender_id,
                channel_id,
                recipient_id,
                {
                    "client_temp_id": client_temp_id,
                    "saved": True,
                    "server_id": db_msg.id,
                    "timestamp": db_msg.timestamp.isoformat(),
                },
            )
        return db_msg
    except Exception as exc:
        logger.exception("❌ Failed to persist community message: %s", exc)
        if client_temp_id is not None:
            await _emit_persistence_status(
                sender_id,
                channel_id,
                recipient_id,
                {
                    "client_temp_id": client_temp_id,
                    "saved": False,
                    "error": str(exc),
                },
            )
        raise
    finally:
        await db.close()
