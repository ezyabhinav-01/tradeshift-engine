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
from datetime import datetime, timezone
import jwt, io, csv, logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/history", tags=["history"])


from app.dependencies import get_current_user

async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Try to get current user from cookie/header, return None if unauthenticated."""
    # 1. Check Session Token First
    session_token = request.cookies.get("session_id")
    if session_token:
        from app.models import UserSession
        result = await db.execute(
            select(UserSession)
            .filter(UserSession.session_token == session_token)
            .filter(UserSession.expires_at > datetime.utcnow())
        )
        session = result.scalars().first()
        if session:
            result = await db.execute(select(User).filter(User.id == session.user_id))
            user = result.scalars().first()
            if user:
                return user

    # 2. Fallback to access_token
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


async def _get_user_id(request: Request, db: AsyncSession, session_type: str = 'REPLAY') -> int:
    """Helper to extract user_id. Allows fallback to user 1 for REPLAY mode."""
    session_type = (session_type or "REPLAY").upper()
    if session_type == "LIVE":
        session_type = "REPLAY"
    user = await get_optional_user(request, db)
    if not user:
        if session_type == 'REPLAY':
            return 1  # Default simulation user
        raise HTTPException(status_code=401, detail="Authentication required")
    return user.id


def _apply_filters(stmt, date_from, date_to, symbol, direction, search, session_type):
    """Apply common filters to a TradeLog statement."""
    if session_type:
        # Replay-only product. Keep compatibility for callers still sending LIVE.
        stmt = stmt.filter(TradeLog.session_type == "REPLAY")
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


def _seconds_to_minutes(seconds: float | None) -> float:
    return round((seconds or 0.0) / 60.0, 2)


def _resolve_replay_now(symbol: str) -> datetime:
    """
    Use replay clock timestamp for symbol when available, so open-position
    holding time remains accurate during simulation.
    """
    try:
        from app.live_market import shoonya_live
        raw = (shoonya_live.latest_data.get(symbol) or {}).get("timestamp")
        if isinstance(raw, datetime):
            return raw.astimezone(timezone.utc).replace(tzinfo=None) if raw.tzinfo else raw
        if raw:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            return parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed
    except Exception:
        pass
    return datetime.utcnow()


@router.get("/trades")
async def get_trade_history(
    request: Request,
    db: AsyncSession = Depends(get_db),
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    symbol: str = Query(None),
    direction: str = Query(None),
    search: str = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session_type: str = Query('REPLAY'),
    include_children: bool = Query(True),
):
    """Paginated, filterable order/trade ledger across statuses."""
    try:
        user_id = await _get_user_id(request, db, session_type)
        
        stmt = select(TradeLog).filter(TradeLog.user_id == user_id)
        if not include_children:
            stmt = stmt.filter(TradeLog.parent_trade_id.is_(None))
        stmt = _apply_filters(stmt, date_from, date_to, symbol, direction, search, session_type)

        # Count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        # Sort
        allowed_sorts = {
            "id": TradeLog.id,
            "entry_time": TradeLog.entry_time,
            "symbol": TradeLog.symbol,
            "pnl": TradeLog.pnl,
            "quantity": TradeLog.quantity,
            "holding_time": TradeLog.holding_time,
            "direction": TradeLog.direction,
        }
        sort_col = allowed_sorts.get(sort_by, TradeLog.id)
        stmt = stmt.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

        # Paginate
        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)
        
        result = await db.execute(stmt)
        trades = result.scalars().all()

        rows = []
        for t in trades:
            status = (t.status or "OPEN").upper()
            is_open_like = status in {"OPEN", "PENDING", "TRIGGERED"}
            if is_open_like and t.entry_time:
                now_ref = _resolve_replay_now(t.symbol or "")
                holding_seconds = max(0.0, round((now_ref - t.entry_time).total_seconds(), 1))
            else:
                # Closed trades: derive strictly from entry/exit timestamps.
                if t.entry_time and t.exit_time:
                    holding_seconds = round(abs((t.exit_time - t.entry_time).total_seconds()), 1)
                else:
                    holding_seconds = round(t.holding_time or 0, 1)
            holding_minutes = _seconds_to_minutes(holding_seconds)
            if is_open_like:
                holding_minutes = round(holding_seconds / 60.0, 2)
            rows.append({
                "id": t.id,
                "symbol": t.symbol,
                "direction": t.direction,
                "status": status,
                "order_type": t.order_type,
                "parent_trade_id": t.parent_trade_id,
                "quantity": t.quantity,
                "entry_price": round(t.entry_price or 0, 2),
                "exit_price": round(t.exit_price or 0, 2),
                "pnl": round(t.pnl or 0, 2),
                "entry_time": t.entry_time.strftime("%Y-%m-%d %H:%M:%S") if t.entry_time else None,
                "exit_time": None if is_open_like else (t.exit_time.strftime("%Y-%m-%d %H:%M:%S") if t.exit_time else None),
                "entry_time_iso": t.entry_time.isoformat() if t.entry_time else None,
                "exit_time_iso": None if is_open_like else (t.exit_time.isoformat() if t.exit_time else None),
                # Backward compatible field now normalized to minutes.
                "holding_time": holding_minutes,
                "holding_time_seconds": holding_seconds,
                "holding_time_mins": holding_minutes,
                "exit_reason": None if is_open_like else t.exit_reason,
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
    except HTTPException:
        raise
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
    session_type: str = Query('REPLAY'),
    include_children: bool = Query(True),
):
    """Export filtered order/trade ledger as CSV download."""
    try:
        user_id = await _get_user_id(request, db, session_type)
        stmt = select(TradeLog).filter(TradeLog.user_id == user_id)
        if not include_children:
            stmt = stmt.filter(TradeLog.parent_trade_id.is_(None))
        stmt = _apply_filters(stmt, date_from, date_to, symbol, direction, search, session_type)
        stmt = stmt.order_by(desc(TradeLog.entry_time))
        
        result = await db.execute(stmt)
        trades = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Date", "Symbol", "Direction", "Order Type", "Status", "Parent Trade ID",
            "Qty", "Entry Price", "Exit Price", "P&L", "Holding Time (min)", "Exit Reason", "Sector",
        ])
        for t in trades:
            writer.writerow([
                t.entry_time.strftime("%Y-%m-%d %H:%M") if t.entry_time else "",
                t.symbol, t.direction, t.order_type or "", t.status or "", t.parent_trade_id or "",
                t.quantity,
                round(t.entry_price or 0, 2), round(t.exit_price or 0, 2),
                round(t.pnl or 0, 2), _seconds_to_minutes(t.holding_time),
                t.exit_reason or "", get_sector(t.symbol) if t.symbol else "Other",
            ])

        output.seek(0)
        filename = f"trade_history_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting trades CSV: {e}")
        return {"error": "Failed to export CSV"}


@router.get("/monthly-summary")
async def get_monthly_summary(
    request: Request,
    session_type: str = Query('REPLAY'),
    db: AsyncSession = Depends(get_db),
):
    """Monthly aggregated trade stats."""
    try:
        user_id = await _get_user_id(request, db, session_type)
        stmt = select(TradeLog).filter(
            TradeLog.user_id == user_id,
            TradeLog.session_type == "REPLAY",
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
                    "total_holding_time_seconds": 0,
                }
            m = months_map[key]
            m["total_trades"] += 1
            if (t.pnl or 0) > 0: m["wins"] += 1
            else: m["losses"] += 1
            m["total_pnl"] += (t.pnl or 0)
            m["total_holding_time_seconds"] += (t.holding_time or 0)

        months = []
        for m in sorted(months_map.values(), key=lambda x: x["month"], reverse=True):
            m["win_rate"] = round(m["wins"] / m["total_trades"] * 100, 1) if m["total_trades"] else 0
            m["avg_holding_time"] = round((m["total_holding_time_seconds"] / m["total_trades"]) / 60.0, 2) if m["total_trades"] else 0
            m["total_pnl"] = round(m["total_pnl"], 2)
            months.append(m)

        return {"months": months}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching monthly summary: {e}")
        return {"months": []}


@router.get("/symbols")
async def get_traded_symbols(session_type: str = Query('REPLAY'), db: AsyncSession = Depends(get_db)):
    """Get distinct symbols from trade history for filter dropdown."""
    try:
        stmt = select(distinct(TradeLog.symbol)).filter(TradeLog.session_type == "REPLAY").order_by(TradeLog.symbol)
        result = await db.execute(stmt)
        symbols = result.scalars().all()
        return {"symbols": [s for s in symbols if s]}
    except Exception as e:
        logger.error(f"Error fetching symbols: {e}")
        return {"symbols": []}
