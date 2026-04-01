import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models import UserSettings as UserSettingsModel, UserChartSettings as ChartSettingsModel, DrawingTemplate as TemplateModel, HelpRequest as HelpRequestModel
from app.schemas import UserSettings, UserSettingsUpdate, ChartSettings, ChartSettingsUpdate, DrawingTemplateCreate, DrawingTemplateResponse, HelpRequestCreate, HelpRequestResponse
from app.routers.trading import _get_user_id
from app.services.risk_engine import risk_engine
from app.config import conf, MAIL_USERNAME, MAIL_PASSWORD, MAIL_SERVER

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["user"])

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
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    await db.delete(template)
    await db.commit()
    
    return {"message": "Template deleted"}

# ─── Help Requests ──────────────────────────────────────────────

def send_help_email(user_id: str, message: str):
    import smtplib
    from email.mime.text import MIMEText
    
    # Use pre-loaded credentials from app.config
    sender = MAIL_USERNAME
    password = MAIL_PASSWORD
    smtp_server = MAIL_SERVER
    # SSL Port 465 was verified as working on current network
    port = 465
    
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
    msg["From"] = sender
    msg["To"] = "stabilityincrease1@gmail.com"
    
    try:
        logger.info(f"Attempting to send email via {smtp_server}:{port} for user {user_id}...")
        server = smtplib.SMTP_SSL(smtp_server, port, timeout=15)
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        logger.info(f"Successfully sent help email for user {user_id} via SMTP_SSL (Port 465)")
        print(f"✅ EMAIL SENT: Support request from {user_id} forwarded to stabilityincrease1@gmail.com")
    except Exception as e:
        logger.error(f"Failed to send help email for user {user_id}: {str(e)}")
        print(f"❌ EMAIL FAILED: {str(e)}")

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
