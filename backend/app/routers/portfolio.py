from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
from app.portfolio_service import portfolio_service
from app.config import SECRET_KEY, ALGORITHM
import jwt
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Try to get current user from cookie/header, return None if unauthenticated."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        result = await db.execute(select(User).filter(User.email == email))
        user = result.scalars().first()
        return user
    except Exception:
        return None


async def _get_user_id(request: Request, db: AsyncSession) -> int:
    """Helper to extract user_id, fallback to 1 for dev."""
    user = await get_optional_user(request, db)
    return user.id if user else 1


@router.get("/summary")
async def get_portfolio_summary(request: Request, session_type: str = 'LIVE', db: AsyncSession = Depends(get_db)):
    """Portfolio summary: XIRR, total invested, P&L, equity curve."""
    try:
        user_id = await _get_user_id(request, db)
        return await portfolio_service.get_summary(db, user_id, session_type)
    except Exception as e:
        logger.error(f"Error fetching portfolio summary: {e}")
        return {
            "total_invested": 0, "current_value": 0, "total_pnl": 0,
            "pnl_percent": 0, "xirr_percent": 0, "is_positive": True, "equity_curve": []
        }


@router.get("/holdings")
async def get_portfolio_holdings(request: Request, session_type: str = 'LIVE', db: AsyncSession = Depends(get_db)):
    """All held equity positions with LTP and P&L."""
    try:
        user_id = await _get_user_id(request, db)
        holdings = await portfolio_service.get_holdings(db, user_id, session_type)
        return {"holdings": holdings}
    except Exception as e:
        logger.error(f"Error fetching portfolio holdings: {e}")
        return {"holdings": []}


@router.get("/positions")
async def get_portfolio_positions(request: Request, session_type: str = 'LIVE', db: AsyncSession = Depends(get_db)):
    """Open trade positions from TradeLog."""
    try:
        user_id = await _get_user_id(request, db)
        positions = await portfolio_service.get_positions(db, user_id, session_type)
        return {"positions": positions}
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        return {"positions": []}


@router.get("/sectors")
async def get_sector_analysis(request: Request, session_type: str = 'LIVE', db: AsyncSession = Depends(get_db)):
    """Sector allocation breakdown with concentration risk alerts."""
    try:
        user_id = await _get_user_id(request, db)
        return await portfolio_service.get_sector_analysis(db, user_id, session_type)
    except Exception as e:
        logger.error(f"Error fetching sector analysis: {e}")
        return {"allocation": [], "risks": [], "diversity_score": 0, "total_sectors": 0, "risk_level": "Unknown"}


@router.get("/research")
async def get_trade_research(request: Request, session_type: str = 'LIVE', db: AsyncSession = Depends(get_db)):
    """Trade behavior analytics and insights."""
    try:
        user_id = await _get_user_id(request, db)
        return await portfolio_service.get_trade_research(db, user_id, session_type)
    except Exception as e:
        logger.error(f"Error fetching trade research: {e}")
        return {
            "total_trades": 0, "win_rate": 0, "avg_holding_time_mins": 0, "avg_pnl": 0,
            "best_trade": None, "worst_trade": None, "sector_bias": [],
            "direction_split": {"BUY": 0, "SELL": 0}, "insights": []
        }
