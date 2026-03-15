from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models import UserSettings as UserSettingsModel
from app.schemas import UserSettings, UserSettingsUpdate
from app.routers.trading import _get_user_id # Reusing the mock/auth helper
from app.services.risk_engine import risk_engine

router = APIRouter(prefix="/api/user", tags=["user"])

@router.get("/settings", response_model=UserSettings)
async def get_user_settings(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Retrieve current settings for the authenticated user.
    Creates default settings if none exist.
    """
    user_id = _get_user_id(request, db)
    
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
    user_id = _get_user_id(request, db)
    
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
