"""
History API Router — trade history with filtering, pagination, CSV export,
and monthly summary aggregation.
"""
from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, desc, asc
from app.database import get_db, get_db_sync
from app.models import TradeLog, User
from app.config import SECRET_KEY, ALGORITHM
from app.sector_mapping import get_sector
from datetime import datetime
import jwt, io, csv, logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/history", tags=["history"])


def _get_user_id(request: Request, db: Session) -> int:
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
                user = db.query(User).filter(User.email == email).first()
                if user:
                    return user.id
        except Exception:
            pass
    return 1  # fallback for dev


def _apply_filters(query, date_from, date_to, symbol, direction, search, session_type):
    """Apply common filters to a TradeLog query."""
    if session_type:
        query = query.filter(TradeLog.session_type == session_type)
    if date_from:
        try:
            dt = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(TradeLog.entry_time >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d")
            # Include the entire 'to' day
            dt = dt.replace(hour=23, minute=59, second=59)
            query = query.filter(TradeLog.entry_time <= dt)
        except ValueError:
            pass
    if symbol and symbol.strip():
        query = query.filter(TradeLog.symbol.ilike(f"%{symbol.strip()}%"))
    if direction and direction.strip().upper() in ("BUY", "SELL"):
        query = query.filter(TradeLog.direction == direction.strip().upper())
    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            (TradeLog.symbol.ilike(s)) |
            (TradeLog.exit_reason.ilike(s)) |
            (TradeLog.direction.ilike(s))
        )
    return query


@router.get("/trades")
def get_trade_history(
    request: Request,
    db: Session = Depends(get_db_sync),
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
        q = db.query(TradeLog).filter(
            TradeLog.exit_price.isnot(None),
            TradeLog.exit_price != 0,
        )
        q = _apply_filters(q, date_from, date_to, symbol, direction, search, session_type)

        # Count before pagination
        total = q.count()

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
        q = q.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

        # Paginate
        offset = (page - 1) * limit
        trades = q.offset(offset).limit(limit).all()

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
            "total_pages": max(1, -(-total // limit)),  # ceil division
        }
    except Exception as e:
        logger.error(f"Error fetching trade history: {e}")
        return {"trades": [], "total": 0, "page": 1, "limit": limit, "total_pages": 1}


@router.get("/trades/export")
def export_trades_csv(
    request: Request,
    db: Session = Depends(get_db_sync),
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    symbol: str = Query(None),
    direction: str = Query(None),
    search: str = Query(None),
    session_type: str = Query('LIVE'),
):
    """Export filtered trades as CSV download."""
    try:
        q = db.query(TradeLog).filter(
            TradeLog.exit_price.isnot(None),
            TradeLog.exit_price != 0,
        )
        q = _apply_filters(q, date_from, date_to, symbol, direction, search, session_type)
        q = q.order_by(desc(TradeLog.entry_time))
        trades = q.all()

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
def get_monthly_summary(
    request: Request,
    session_type: str = Query('LIVE'),
    db: Session = Depends(get_db_sync),
):
    """Monthly aggregated trade stats."""
    try:
        trades = db.query(TradeLog).filter(
            TradeLog.session_type == session_type,
            TradeLog.exit_price.isnot(None),
            TradeLog.exit_price != 0,
        ).order_by(TradeLog.entry_time).all()

        if not trades:
            return {"months": []}

        months_map = {}
        for t in trades:
            if not t.entry_time:
                continue
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
            if (t.pnl or 0) > 0:
                m["wins"] += 1
            else:
                m["losses"] += 1
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
def get_traded_symbols(session_type: str = Query('LIVE'), db: Session = Depends(get_db_sync)):
    """Get distinct symbols from trade history for filter dropdown."""
    try:
        symbols = db.query(TradeLog.symbol).filter(TradeLog.session_type == session_type).distinct().order_by(TradeLog.symbol).all()
        return {"symbols": [s[0] for s in symbols if s[0]]}
    except Exception as e:
        logger.error(f"Error fetching symbols: {e}")
        return {"symbols": []}
