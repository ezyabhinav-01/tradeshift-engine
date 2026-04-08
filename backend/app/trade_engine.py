# File: backend/app/trade_engine.py

"""
Trade Engine — handles order execution logic.
Creates trade records with advanced order parameters and builds
WebSocket event payloads for order lifecycle notifications.
"""

from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import TradeLog, User
from app.schemas import TradeExecuteRequest, OrderType, TradeDirection
from sqlalchemy import update
from app.utils.portfolio_utils import sync_portfolio_holding
import logging

logger = logging.getLogger(__name__)


from app.services.risk_engine import risk_engine

class TradeEngine:
    """
    Stateless trade execution engine.
    Validates orders, persists them, and prepares WebSocket event payloads.
    """

    @staticmethod
    def _normalize_db_timestamp(ts: datetime | None) -> datetime | None:
        """
        Convert incoming timestamps to naive UTC-like datetime for DB columns
        that use TIMESTAMP WITHOUT TIME ZONE.
        """
        if ts is None:
            return None
        if ts.tzinfo is not None:
            return ts.astimezone(timezone.utc).replace(tzinfo=None)
        return ts

    @staticmethod
    async def execute_trade(request: TradeExecuteRequest, user_id: int, db: AsyncSession) -> dict:
        """
        Execute a trade order (Async).

        1. Performs Risk Engine validation.
        2. Creates the main trade record.
        3. If filled (MARKET), creates linked PENDING orders for SL and TP.
        4. For LIMIT/STOP/GTT: creates a pending order.
        """
        # --- 1. RISK VALIDATION ---
        order_data = request.model_dump()
        await risk_engine.check_order(db, user_id, order_data)

        order_type = request.order_type.value
        is_market = order_type == "MARKET"

        # Determination of entry time - use simulated time if provided and strip tzinfo
        entry_time = TradeEngine._normalize_db_timestamp(request.simulated_time) or datetime.utcnow()

        # Determine status and effective prices - MARKET orders are OPEN immediately
        status = "OPEN" if is_market else "PENDING"
        entry_price = request.price
        
        # If MARKET order and price is missing/0, try to get from live market service
        if is_market and (not entry_price or entry_price == 0):
            from app.live_market import live_market_service
            entry_price = live_market_service.get_last_price(request.symbol)
            logger.info(f"Fallbacked to market price for {request.symbol}: {entry_price}")

        # For MARKET orders, ignore limit_price/stop_price
        limit_price = None if is_market else request.limit_price
        stop_price = None if is_market else request.stop_price

        # --- 2. CREATE MAIN TRADE RECORD ---
        trade = TradeLog(
            symbol=request.symbol,
            direction=request.direction.value,
            entry_price=entry_price if is_market else None,
            quantity=request.quantity,
            pnl=0.0,
            entry_time=entry_time if is_market else None,
            exit_time=None,
            holding_time=None,
            user_id=user_id,
            alert=request.alert,
            order_type=order_type,
            limit_price=limit_price,
            stop_price=stop_price,
            status=status,
            stop_loss=request.stop_loss,
            take_profit=request.take_profit,
            session_type=request.session_type
        )

        db.add(trade)
        await db.flush() # Get trade.id before commit to link others

        # --- 3. CREATE LINKED ORDERS (for MARKET entry) ---
        if is_market:
            linked_orders = []
            if request.stop_loss:
                sl_order = TradeLog(
                    symbol=request.symbol,
                    direction="SELL" if request.direction.value == "BUY" else "BUY",
                    quantity=request.quantity,
                    entry_time=None,
                    exit_time=None,
                    holding_time=None,
                    stop_price=request.stop_loss,
                    order_type="STOP",
                    status="PENDING",
                    user_id=user_id,
                    parent_trade_id=trade.id,
                    alert=request.alert,
                    session_type=request.session_type
                )
                linked_orders.append(sl_order)

            if request.take_profit:
                tp_order = TradeLog(
                    symbol=request.symbol,
                    direction="SELL" if request.direction.value == "BUY" else "BUY",
                    quantity=request.quantity,
                    entry_time=None,
                    exit_time=None,
                    holding_time=None,
                    limit_price=request.take_profit,
                    order_type="LIMIT",
                    status="PENDING",
                    user_id=user_id,
                    parent_trade_id=trade.id,
                    alert=request.alert,
                    session_type=request.session_type
                )
                linked_orders.append(tp_order)
            
            if linked_orders:
                db.add_all(linked_orders)
            
            # --- UPDATE CASH BALANCE ---
            multiplier = -1 if request.direction == TradeDirection.BUY else 1
            transaction_value = request.quantity * entry_price
            
            await db.execute(
                update(User)
                .where(User.id == user_id)
                .values(balance=User.balance + (multiplier * transaction_value))
            )

            # 🔥 NEW: SYNC TO PORTFOLIO HOLDINGS
            await sync_portfolio_holding(
                db=db,
                user_id=user_id,
                symbol=request.symbol,
                quantity_delta=request.quantity,
                price=entry_price,
                direction=request.direction.value,
                session_type=request.session_type
            )

        await db.commit()
        await db.refresh(trade)
        from app.services.order_management import oms_service
        oms_service.invalidate_pending_cache(request.symbol, request.session_type, user_id)

        status_label = "filled" if is_market else "placed as pending"
        logger.info(
            f"📈 Trade {status_label}: {request.direction.value} {request.quantity}x "
            f"{request.symbol} @ {entry_price} ({order_type}) | ID: {trade.id}"
        )

        return {
            "trade_id": trade.id,
            "status": status,
            "symbol": trade.symbol,
            "direction": trade.direction,
            "quantity": trade.quantity,
            "entry_price": trade.entry_price,
            "order_type": order_type,
            "stop_loss": trade.stop_loss,
            "take_profit": trade.take_profit,
            "message": f"Order {status_label} successfully",
        }

    @staticmethod
    def build_order_update_payload(trade: TradeLog) -> dict:
        """
        Build the order_update WebSocket event payload from a TradeLog instance.
        """
        return {
            "trade_id": trade.id,
            "status": trade.status or "OPEN",
            "symbol": trade.symbol,
            "direction": trade.direction,
            "entry_price": trade.entry_price or 0.0,
            "exit_price": trade.exit_price or 0.0,
            "stop_loss": trade.stop_loss,
            "take_profit": trade.take_profit,
            "limit_price": trade.limit_price,
            "stop_price": trade.stop_price,
            "quantity": trade.quantity or 0,
            "pnl": trade.pnl or 0.0,
            "parent_trade_id": trade.parent_trade_id,
            "session_type": trade.session_type,
            "exit_reason": trade.exit_reason,
            "entry_time": trade.entry_time.isoformat() if trade.entry_time else None,
            "exit_time": trade.exit_time.isoformat() if trade.exit_time else None,
            "holding_time_seconds": round(trade.holding_time or 0, 1),
            "holding_time_mins": round((trade.holding_time or 0) / 60.0, 2),
        }
