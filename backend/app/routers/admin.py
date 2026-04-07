from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models import StockFundamental, StockFinancial, ReplayScene, User
from app.schemas import (
    StockFundamentalUpdate, 
    StockFinancialCreate, 
    ReplaySceneCreate, 
    ReplaySceneResponse
)
from app.dependencies import admin_required
from app.fundamental_service import FundamentalService
from app.services.fundamental_fetcher import FundamentalFetcherService
from sqlalchemy import text
from typing import List

router = APIRouter(prefix="/api/admin", tags=["admin"])

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
