import json
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List
from app.database import get_db
from app.models import UserSettings as UserSettingsModel, UserChartSettings as ChartSettingsModel, DrawingTemplate as TemplateModel, HelpRequest as HelpRequestModel, UserFeedback as UserFeedbackModel
from app.schemas import UserSettings, UserSettingsUpdate, ChartSettings, ChartSettingsUpdate, DrawingTemplateCreate, DrawingTemplateResponse, HelpRequestCreate, HelpRequestResponse, UserFeedbackCreate, UserFeedbackResponse
from app.routers.trading import _get_user_id
from app.services.risk_engine import risk_engine
from app.config import conf, MAIL_USERNAME, MAIL_PASSWORD, MAIL_SERVER, MAIL_PORT, MAIL_FROM, MAIL_FROM_NAME

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["user"])


async def _ensure_user_feedback_table(db: AsyncSession) -> None:
    # Keep production resilient even when explicit SQL migrations were skipped.
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS user_feedback (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            feedback_type VARCHAR(100),
            rating INT CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            status VARCHAR(20) DEFAULT 'OPEN',
            admin_reply TEXT,
            admin_reply_sent_at TIMESTAMP WITH TIME ZONE,
            admin_reply_sent_by INT REFERENCES users(id) ON DELETE SET NULL,
            resolved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """))
    await db.execute(text("""
        ALTER TABLE user_feedback
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'OPEN'
    """))
    await db.execute(text("""
        ALTER TABLE user_feedback
        ADD COLUMN IF NOT EXISTS admin_reply TEXT
    """))
    await db.execute(text("""
        ALTER TABLE user_feedback
        ADD COLUMN IF NOT EXISTS admin_reply_sent_at TIMESTAMP WITH TIME ZONE
    """))
    await db.execute(text("""
        ALTER TABLE user_feedback
        ADD COLUMN IF NOT EXISTS admin_reply_sent_by INT REFERENCES users(id) ON DELETE SET NULL
    """))
    await db.execute(text("""
        ALTER TABLE user_feedback
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE
    """))
    await db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at
        ON user_feedback(created_at DESC)
    """))
    await db.commit()

@router.get("/settings", response_model=UserSettings)
async def get_user_settings(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Retrieve current settings for the authenticated user.
    Creates default settings if none exist.
    """
    user_id = await _get_user_id(request, db)
    
    result = await db.execute(select(UserSettingsModel).filter(UserSettingsModel.user_id == user_id))
    settings = result.scalars().first()
    
    if not settings:
        settings = UserSettingsModel(user_id=user_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        
    return settings

@router.put("/settings", response_model=UserSettings)
async def update_user_settings(
    settings_update: UserSettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Update settings for the authenticated user.
    """
    user_id = await _get_user_id(request, db)
    
    result = await db.execute(select(UserSettingsModel).filter(UserSettingsModel.user_id == user_id))
    settings = result.scalars().first()
    
    if not settings:
        settings = UserSettingsModel(user_id=user_id)
        db.add(settings)
    
    update_data = settings_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
        
    await db.commit()
    await db.refresh(settings)
    
    # Invalidate Cache to ensure latency optimization stays consistent
    risk_engine.invalidate_settings_cache(user_id)
    
    return settings


# ─── Chart Settings & Template Endpoints ────────────────────────

@router.get("/chart-settings", response_model=ChartSettings)
async def get_chart_settings(request: Request, db: AsyncSession = Depends(get_db)):
    """Fetch user's technical indicators and active drawings."""
    user_id = await _get_user_id(request, db)
    result = await db.execute(select(ChartSettingsModel).filter(ChartSettingsModel.user_id == user_id))
    settings = result.scalars().first()
    
    if not settings:
        return {
            "active_indicators": [],
            "indicator_settings": {},
            "active_drawings": [],
            "tool_templates": {}
        }
        
    return {
        "active_indicators": json.loads(settings.active_indicators),
        "indicator_settings": json.loads(settings.indicator_settings),
        "active_drawings": json.loads(settings.active_drawings),
        "tool_templates": json.loads(settings.tool_templates or "{}")
    }

@router.put("/chart-settings", response_model=ChartSettings)
async def update_chart_settings(
    update: ChartSettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Save user's chart configuration."""
    user_id = await _get_user_id(request, db)
    result = await db.execute(select(ChartSettingsModel).filter(ChartSettingsModel.user_id == user_id))
    settings = result.scalars().first()
    
    if not settings:
        settings = ChartSettingsModel(user_id=user_id)
        db.add(settings)
    
    if update.active_indicators is not None:
        settings.active_indicators = json.dumps(update.active_indicators)
    if update.indicator_settings is not None:
        settings.indicator_settings = json.dumps(update.indicator_settings)
    if update.active_drawings is not None:
        settings.active_drawings = json.dumps(update.active_drawings)
    if update.tool_templates is not None:
        settings.tool_templates = json.dumps(update.tool_templates)
        
    await db.commit()
    await db.refresh(settings)
    
    return {
        "active_indicators": json.loads(settings.active_indicators),
        "indicator_settings": json.loads(settings.indicator_settings),
        "active_drawings": json.loads(settings.active_drawings),
        "tool_templates": json.loads(settings.tool_templates or "{}")
    }

@router.get("/templates", response_model=List[DrawingTemplateResponse])
async def get_templates(request: Request, db: AsyncSession = Depends(get_db)):
    """List all saved drawing templates."""
    user_id = await _get_user_id(request, db)
    result = await db.execute(select(TemplateModel).filter(TemplateModel.user_id == user_id).order_by(TemplateModel.timestamp.desc()))
    templates = result.scalars().all()
    
    return [{
        "id": t.id,
        "name": t.name,
        "category": t.category,
        "tags": json.loads(t.tags),
        "data": json.loads(t.data),
        "thumbnail": t.thumbnail,
        "timestamp": t.timestamp
    } for t in templates]

@router.post("/templates", response_model=DrawingTemplateResponse)
async def create_template(
    template: DrawingTemplateCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Save a new drawing template."""
    user_id = await _get_user_id(request, db)
    
    db_template = TemplateModel(
        id=template.id,
        user_id=user_id,
        name=template.name,
        category=template.category,
        tags=json.dumps(template.tags),
        data=json.dumps(template.data),
        thumbnail=template.thumbnail
    )
    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)
    
    return {
        "id": db_template.id,
        "name": db_template.name,
        "category": db_template.category,
        "tags": json.loads(db_template.tags),
        "data": json.loads(db_template.data),
        "thumbnail": db_template.thumbnail,
        "timestamp": db_template.timestamp
    }

@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Delete a drawing template."""
    user_id = await _get_user_id(request, db)
    result = await db.execute(select(TemplateModel).filter(TemplateModel.id == template_id, TemplateModel.user_id == user_id))
    template = result.   scalars().first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    await db.delete(template)
    await db.commit()
    
    return {"message": "Template deleted"}

# ─── Help Requests ──────────────────────────────────────────────

async def send_help_email(user_id: str, message: str):
    import smtplib
    from email.mime.text import MIMEText
    
    # Use pre-loaded credentials from app.config
    sender = MAIL_USERNAME
    password = MAIL_PASSWORD
    smtp_server = MAIL_SERVER
    port = MAIL_PORT
    
    if not sender or not password or "your-email" in sender:
        logger.error(f"Email credentials not configured correctly in .env. Current sender: {sender}")
        return
        
    html = f"""
    <p><strong>New Support Request</strong></p>
    <p><strong>User ID:</strong> {user_id}</p>
    <p><strong>Message:</strong></p>
    <p>{message}</p>
    """
    
    msg = MIMEText(html, "html")
    msg["Subject"] = f"New User Help Request - {user_id}"
    msg["From"] = f"{MAIL_FROM_NAME} <{MAIL_FROM}>"
    msg["To"] = "mannat07kumar@gmail.com"
    
    def _do_send():
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_server, port, timeout=8)
        else:
            server = smtplib.SMTP(smtp_server, port, timeout=8)
            server.starttls()
        server.login(sender, password)
        server.send_message(msg)
        server.quit()

    try:
        # Run the blocking SMTP call in a thread so it never stalls the async event loop
        await asyncio.to_thread(_do_send)
        logger.info(f"Help email sent for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to send help email for user {user_id}: {str(e)}")


@router.post("/help", response_model=HelpRequestResponse)
async def submit_help_request(
    help_request: HelpRequestCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Submit a concern or help request."""
    user_id = await _get_user_id(request, db)
    
    db_request = HelpRequestModel(
        user_id=user_id,
        message=help_request.message
    )
    db.add(db_request)
    await db.commit()
    await db.refresh(db_request)
    
    background_tasks.add_task(send_help_email, user_id, help_request.message)
    
    return db_request


@router.post("/feedback", response_model=UserFeedbackResponse)
async def submit_user_feedback(
    payload: UserFeedbackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Submit a help-page user feedback entry for admin review."""
    user_id = await _get_user_id(request, db)
    await _ensure_user_feedback_table(db)

    comment = payload.comment.strip()
    feedback_type = (payload.feedback_type or "help_page").strip()[:100]
    if not comment:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    row = UserFeedbackModel(
        user_id=user_id,
        feedback_type=feedback_type,
        rating=payload.rating,
        comment=comment,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/feedback", response_model=List[UserFeedbackResponse])
async def list_user_feedback(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """List authenticated user's feedback history."""
    user_id = await _get_user_id(request, db)
    await _ensure_user_feedback_table(db)

    result = await db.execute(
        select(UserFeedbackModel)
        .filter(UserFeedbackModel.user_id == user_id)
        .order_by(UserFeedbackModel.created_at.desc())
        .limit(20)
    )
    return result.scalars().all()
