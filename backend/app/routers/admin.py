from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models import StockFundamental, StockFinancial, ReplayScene, User, UserFeedback, Notification, CommunityMessage
from app.schemas import (
    StockFundamentalUpdate, 
    StockFinancialCreate, 
    ReplaySceneCreate, 
    ReplaySceneResponse,
    AdminUserFeedbackResponse,
    AdminFeedbackReplyRequest,
)
from app.dependencies import admin_required, admin_or_internal
from app.fundamental_service import FundamentalService
from app.services.fundamental_fetcher import FundamentalFetcherService
from app.services.email_service import send_feedback_reply_email
from app.websocket_manager import order_manager
from app.routers.user import _ensure_user_feedback_table
from sqlalchemy import text
from typing import List
from app.redis_utils import get_redis_client

redis_client = get_redis_client()

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def _get_admin_sender_id(db: AsyncSession) -> int | None:
    result = await db.execute(select(User.id).where(User.email == "admin@gmail.com").limit(1))
    return result.scalar_one_or_none()

@router.get("/active-learn-users")
async def get_active_learn_users(
    admin_user: User = Depends(admin_required)
):
    """
    Get the count of currently active users/guests on the Learn platform.
    """
    try:
        keys = []
        async for key in redis_client.scan_iter(match="learn_active_session:*", count=100):
            keys.append(key)
        return {"active_users": len(keys)}
    except Exception as e:
        return {"active_users": 0, "error": str(e)}

# ─── Stock Data Management ──────────────────────────────────────

@router.post("/stocks/{symbol}/fundamentals")
async def upsert_fundamentals(
    symbol: str, 
    data: StockFundamentalUpdate, 
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(admin_required)
):
    """Update or create fundamental record for a stock."""
    # Convert Pydantic to dict, excluding None values
    update_dict = data.model_dump(exclude_unset=True)
    fundamental = await FundamentalService.update_fundamentals(db, symbol.upper(), update_dict)
    return fundamental

@router.post("/stocks/financials")
async def add_financial_record(
    data: StockFinancialCreate, 
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(admin_required)
):
    """Add a yearly financial record for a stock."""
    # Check if entry already exists
    result = await db.execute(
        select(StockFinancial).where(
            StockFinancial.symbol == data.symbol.upper(),
            StockFinancial.year == data.year
        )
    )
    existing = result.scalars().first()
    if existing:
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(existing, key, value)
    else:
        existing = StockFinancial(**data.model_dump())
        db.add(existing)
    
    await db.commit()
    await db.refresh(existing)
    return existing

@router.post("/stocks/sync-all")
async def sync_all_stock_data(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(admin_required)
):
    """
    Manually trigger a full refresh of stock fundamentals and financials.
    Fetches symbols from market metadata to sync with yfinance.
    """
    # 1. Get symbols from metadata 
    query = text("SELECT DISTINCT instrument FROM index_metadata LIMIT 50")
    try:
        result = await db.execute(query)
        symbols = [row[0] for row in result.all()]
    except:
        symbols = []
    
    if not symbols:
        # Fallback to a curated list of Nifty 50 leaders
        symbols = ["RELIANCE", "HDFCBANK", "TCS", "ICICIBANK", "INFY", "BHARTIARTL", "SBIN", "ITC", "HINDUNILVR", "BAJFINANCE"]
        
    await FundamentalFetcherService.sync_stock_data(db, symbols)
    return {"status": "sync_completed", "symbols_processed": symbols}

# ─── Replay Scene Management ────────────────────────────────────

@router.post("/replay-scenes", response_model=ReplaySceneResponse)
async def create_replay_scene(
    scene_data: ReplaySceneCreate, 
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(admin_required)
):
    """Create a new Market Replay scenario."""
    db_scene = ReplayScene(**scene_data.model_dump())
    db.add(db_scene)
    await db.commit()
    await db.refresh(db_scene)
    return db_scene

@router.get("/replay-scenes", response_model=List[ReplaySceneResponse])
async def list_replay_scenes(
    db: AsyncSession = Depends(get_db)
):
    """List all available replay scenarios."""
    result = await db.execute(select(ReplayScene).order_by(ReplayScene.created_at.desc()))
    return result.scalars().all()

@router.get("/replay-scenes/{scene_id}", response_model=ReplaySceneResponse)
async def get_replay_scene(
    scene_id: int, 
    db: AsyncSession = Depends(get_db)
):
    """Fetch detail for a specific scenario."""
    result = await db.execute(select(ReplayScene).where(ReplayScene.id == scene_id))
    scene = result.scalars().first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene

@router.delete("/replay-scenes/{scene_id}")
async def delete_replay_scene(
    scene_id: int, 
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(admin_required)
):
    """Delete a replay scenario."""
    result = await db.execute(delete(ReplayScene).where(ReplayScene.id == scene_id))
    await db.commit()
    return {"status": "ok", "message": f"Scene {scene_id} deleted"}


@router.get("/feedback", response_model=List[AdminUserFeedbackResponse])
async def list_feedback(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(admin_or_internal),
):
    await _ensure_user_feedback_table(db)
    result = await db.execute(
        select(UserFeedback, User.email, User.full_name, User.demat_id)
        .join(User, User.id == UserFeedback.user_id)
        .order_by(UserFeedback.created_at.desc())
    )

    feedback_rows: list[AdminUserFeedbackResponse] = []
    for feedback, email, full_name, demat_id in result.all():
        feedback_rows.append(
            AdminUserFeedbackResponse(
                id=feedback.id,
                user_id=feedback.user_id,
                feedback_type=feedback.feedback_type,
                rating=feedback.rating,
                comment=feedback.comment,
                status=feedback.status or "OPEN",
                admin_reply=feedback.admin_reply,
                admin_reply_sent_at=feedback.admin_reply_sent_at,
                admin_reply_sent_by=feedback.admin_reply_sent_by,
                resolved_at=feedback.resolved_at,
                created_at=feedback.created_at,
                user_email=email,
                user_full_name=full_name,
                user_demat_id=demat_id,
            )
        )
    return feedback_rows


@router.post("/feedback/{feedback_id}/reply")
async def reply_to_feedback(
    feedback_id: int,
    payload: AdminFeedbackReplyRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(admin_or_internal),
):
    await _ensure_user_feedback_table(db)
    message = payload.message.strip()
    title = (payload.title or "TradeShift support update").strip()

    if not message:
        raise HTTPException(status_code=400, detail="Reply message cannot be empty.")

    result = await db.execute(
        select(UserFeedback, User)
        .join(User, User.id == UserFeedback.user_id)
        .where(UserFeedback.id == feedback_id)
        .limit(1)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Feedback entry not found.")

    feedback, target_user = row
    now = datetime.utcnow()
    admin_sender_id = await _get_admin_sender_id(db)

    feedback.admin_reply = message
    feedback.admin_reply_sent_at = now
    feedback.admin_reply_sent_by = admin_sender_id
    if payload.mark_resolved:
        feedback.status = "RESOLVED"
        feedback.resolved_at = now
    else:
        feedback.status = "REPLIED"

    user_notification = None
    if payload.send_notification:
        user_notification = Notification(
            user_id=target_user.id,
            title=title,
            content=message,
            type="success" if payload.mark_resolved else "info",
            category="personal",
            is_read=False,
            created_at=now,
        )
        db.add(user_notification)

    if payload.send_dm and admin_sender_id and admin_sender_id != target_user.id:
        db.add(CommunityMessage(
            sender_id=admin_sender_id,
            recipient_id=target_user.id,
            channel_id=None,
            content=message,
            timestamp=now,
        ))

    await db.commit()
    await db.refresh(feedback)
    if user_notification:
        await db.refresh(user_notification)
        await order_manager.emit_to_user(
            target_user.id,
            "notification:new",
            {
                "id": user_notification.id,
                "user_id": user_notification.user_id,
                "title": user_notification.title,
                "content": user_notification.content,
                "type": user_notification.type,
                "category": user_notification.category,
                "is_read": user_notification.is_read,
                "created_at": user_notification.created_at.isoformat() if user_notification.created_at else None,
            },
        )

    if payload.send_email and target_user.email:
        background_tasks.add_task(
            send_feedback_reply_email,
            target_user.email,
            target_user.full_name,
            title,
            message,
            feedback.comment,
            target_user.demat_id,
        )

    return {
        "status": "sent",
        "feedback_id": feedback.id,
        "user_id": target_user.id,
        "user_email": target_user.email,
        "user_demat_id": target_user.demat_id,
        "feedback_status": feedback.status,
        "sent_notification": payload.send_notification,
        "sent_dm": bool(payload.send_dm and admin_sender_id and admin_sender_id != target_user.id),
        "sent_email": payload.send_email,
    }
