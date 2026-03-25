"""
History API Router — trade history with filtering, pagination, CSV export,
and monthly summary aggregation.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, extract, desc, asc, select, distinct
from app.database import get_db
from app.models import TradeLog, User
from app.config import SECRET_KEY, ALGORITHM
from app.sector_mapping import get_sector
from datetime import datetime
import jwt, io, csv, logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/history", tags=["history"])


async def _get_user_id(request: Request, db: AsyncSession) -> int:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if email:
                result = await db.execute(select(User).filter(User.email == email))
                user = result.scalars().first()
                if user :
                    return user.id
        except Exception:
            pass
    return 1  # fallback for dev


def _apply_filters(stmt, date_from, date_to, symbol, direction, search, session_type):
    """Apply common filters to a TradeLog statement."""
    if session_type:
        stmt = stmt.filter(TradeLog.session_type == session_type)
    if date_from:
        try:
            dt = datetime.strptime(date_from, "%Y-%m-%d")
            stmt = stmt.filter(TradeLog.entry_time >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d")
            dt = dt.replace(hour=23, minute=59, second=59)
            stmt = stmt.filter(TradeLog.entry_time <= dt)
        except ValueError:
            pass
    if symbol and symbol.strip():
        stmt = stmt.filter(TradeLog.symbol.ilike(f"%{symbol.strip()}%"))
    if direction and direction.strip().upper() in ("BUY", "SELL"):
        stmt = stmt.filter(TradeLog.direction == direction.strip().upper())
    if search and search.strip():
        s = f"%{search.strip()}%"
        stmt = stmt.filter(
            (TradeLog.symbol.ilike(s)) |
            (TradeLog.exit_reason.ilike(s)) |
            (TradeLog.direction.ilike(s))
        )
    return stmt


@router.get("/trades")
async def get_trade_history(
    request: Request,
    db: AsyncSession = Depends(get_db),
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    symbol: str = Query(None),
    direction: str = Query(None),
    search: str = Query(None),
    sort_by: str = Query("entry_time"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session_type: str = Query('LIVE'),
):
    """Paginated, filterable trade history."""
    try:
        user_id = await _get_user_id(request, db)
        
        stmt = select(TradeLog).filter(
            TradeLog.user_id == user_id,
            TradeLog.exit_price.isnot(None),
            TradeLog.exit_price != 0,
        )
        stmt = _apply_filters(stmt, date_from, date_to, symbol, direction, search, session_type)

        # Count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        # Sort
        allowed_sorts = {
            "entry_time": TradeLog.entry_time,
            "symbol": TradeLog.symbol,
            "pnl": TradeLog.pnl,
            "quantity": TradeLog.quantity,
            "holding_time": TradeLog.holding_time,
            "direction": TradeLog.direction,
        }
        sort_col = allowed_sorts.get(sort_by, TradeLog.entry_time)
        stmt = stmt.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

        # Paginate
        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)
        
        result = await db.execute(stmt)
        trades = result.scalars().all()

        rows = []
        for t in trades:
            rows.append({
                "id": t.id,
                "symbol": t.symbol,
                "direction": t.direction,
                "quantity": t.quantity,
                "entry_price": round(t.entry_price or 0, 2),
                "exit_price": round(t.exit_price or 0, 2),
                "pnl": round(t.pnl or 0, 2),
                "entry_time": t.entry_time.strftime("%Y-%m-%d %H:%M") if t.entry_time else None,
                "exit_time": t.exit_time.strftime("%Y-%m-%d %H:%M") if t.exit_time else None,
                "holding_time": round(t.holding_time or 0, 1),
                "exit_reason": t.exit_reason,
                "stop_loss": t.stop_loss,
                "take_profit": t.take_profit,
                "sector": get_sector(t.symbol) if t.symbol else "Other",
                "is_win": (t.pnl or 0) > 0,
            })

        return {
            "trades": rows,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": max(1, -(-total // limit)),
        }
    except Exception as e:
        logger.error(f"Error fetching trade history: {e}")
        return {"trades": [], "total": 0, "page": 1, "limit": limit, "total_pages": 1}


@router.get("/trades/export")
async def export_trades_csv(
    request: Request,
    db: AsyncSession = Depends(get_db),
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    symbol: str = Query(None),
    direction: str = Query(None),
    search: str = Query(None),
    session_type: str = Query('LIVE'),
):
    """Export filtered trades as CSV download."""
    try:
        user_id = await _get_user_id(request, db)
        stmt = select(TradeLog).filter(
            TradeLog.user_id == user_id,
            TradeLog.exit_price.isnot(None),
            TradeLog.exit_price != 0,
        )
        stmt = _apply_filters(stmt, date_from, date_to, symbol, direction, search, session_type)
        stmt = stmt.order_by(desc(TradeLog.entry_time))
        
        result = await db.execute(stmt)
        trades = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Date", "Symbol", "Direction", "Qty", "Entry Price", "Exit Price",
            "P&L", "Holding Time (min)", "Exit Reason", "Sector",
        ])
        for t in trades:
            writer.writerow([
                t.entry_time.strftime("%Y-%m-%d %H:%M") if t.entry_time else "",
                t.symbol, t.direction, t.quantity,
                round(t.entry_price or 0, 2), round(t.exit_price or 0, 2),
                round(t.pnl or 0, 2), round(t.holding_time or 0, 1),
                t.exit_reason or "", get_sector(t.symbol) if t.symbol else "Other",
            ])

        output.seek(0)
        filename = f"trade_history_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        logger.error(f"Error exporting trades CSV: {e}")
        return {"error": "Failed to export CSV"}


@router.get("/monthly-summary")
async def get_monthly_summary(
    request: Request,
    session_type: str = Query('LIVE'),
    db: AsyncSession = Depends(get_db),
):
    """Monthly aggregated trade stats."""
    try:
        user_id = await _get_user_id(request, db)
        stmt = select(TradeLog).filter(
            TradeLog.user_id == user_id,
            TradeLog.session_type == session_type,
            TradeLog.exit_price.isnot(None),
            TradeLog.exit_price != 0,
        ).order_by(TradeLog.entry_time)
        
        result = await db.execute(stmt)
        trades = result.scalars().all()

        if not trades:
            return {"months": []}

        months_map = {}
        for t in trades:
            if not t.entry_time: continue
            key = t.entry_time.strftime("%Y-%m")
            if key not in months_map:
                months_map[key] = {
                    "month": key,
                    "label": t.entry_time.strftime("%b %Y"),
                    "total_trades": 0,
                    "wins": 0,
                    "losses": 0,
                    "total_pnl": 0,
                    "total_holding_time": 0,
                }
            m = months_map[key]
            m["total_trades"] += 1
            if (t.pnl or 0) > 0: m["wins"] += 1
            else: m["losses"] += 1
            m["total_pnl"] += (t.pnl or 0)
            m["total_holding_time"] += (t.holding_time or 0)

        months = []
        for m in sorted(months_map.values(), key=lambda x: x["month"], reverse=True):
            m["win_rate"] = round(m["wins"] / m["total_trades"] * 100, 1) if m["total_trades"] else 0
            m["avg_holding_time"] = round(m["total_holding_time"] / m["total_trades"], 1) if m["total_trades"] else 0
            m["total_pnl"] = round(m["total_pnl"], 2)
            months.append(m)

        return {"months": months}
    except Exception as e:
        logger.error(f"Error fetching monthly summary: {e}")
        return {"months": []}


@router.get("/symbols")
async def get_traded_symbols(session_type: str = Query('LIVE'), db: AsyncSession = Depends(get_db)):
    """Get distinct symbols from trade history for filter dropdown."""
    try:
        stmt = select(distinct(TradeLog.symbol)).filter(TradeLog.session_type == session_type).order_by(TradeLog.symbol)
        result = await db.execute(stmt)
        symbols = result.scalars().all()
        return {"symbols": [s for s in symbols if s]}
    except Exception as e:
        logger.error(f"Error fetching symbols: {e}")
        return {"symbols": []}
