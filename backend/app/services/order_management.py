import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models import TradeLog
from app.database import get_session
from app.websocket_manager import order_manager
from app.trade_engine import TradeEngine

logger = logging.getLogger(__name__)

class OrderManagementSystem:
    """
    Enhanced OMS handles complex order lifecycles (Async).
    """

    def __init__(self):
        self._lock = asyncio.Lock()

    async def on_price_update(self, symbol: str, current_price: float, simulated_time: Optional[datetime] = None, session_type: str = "LIVE"):
        """
        Main entry point for price updates (Async).
        Scans for pending orders that should be triggered by the new price.
        """
        async with self._lock:
            # get_session is now async
            db: AsyncSession = await get_session()
            try:
                result = await db.execute(
                    select(TradeLog).filter(
                        TradeLog.symbol == symbol,
                        TradeLog.status == "PENDING",
                        TradeLog.session_type == session_type
                    )
                )
                pending_orders = result.scalars().all()

                if not pending_orders:
                    return

                for order in pending_orders:
                    await self._process_conditional_order(db, order, current_price, simulated_time)
                
                await db.commit()
            except Exception as e:
                logger.error(f"❌ Error in OMS price update for {symbol}: {e}")
                await db.rollback()
            finally:
                await db.close()

    async def _process_conditional_order(self, db: AsyncSession, order: TradeLog, current_price: float, simulated_time: Optional[datetime] = None):
        """Check conditions and trigger (Async)."""
        triggered = False
        
        # 1. Handle LIMIT Orders
        if order.order_type == "LIMIT":
            if order.direction == "BUY" and current_price <= order.limit_price:
                triggered = True
            elif order.direction == "SELL" and current_price >= order.limit_price:
                triggered = True

        # 2. Handle STOP Orders
        elif order.order_type == "STOP":
            if order.direction == "BUY" and current_price >= order.stop_price:
                triggered = True
            elif order.direction == "SELL" and current_price <= order.stop_price:
                triggered = True

        # 3. Handle GTT / Conditionals
        elif order.order_type == "GTT":
             if order.direction == "BUY" and current_price <= order.limit_price:
                triggered = True
             elif order.direction == "SELL" and current_price >= order.limit_price:
                triggered = True
        
        if triggered:
            await self._execute_triggered_order(db, order, current_price, simulated_time)

    async def _execute_triggered_order(self, db: AsyncSession, order: TradeLog, fill_price: float, simulated_time: Optional[datetime] = None):
        """Transition order and notify (Async)."""
        logger.info(f"🎯 ORDER TRIGGERED: {order.direction} {order.quantity} {order.symbol} @ {fill_price} (Session: {order.session_type})")
        
        if order.parent_trade_id:
            # If it's a child order (SL/TP), it should close the parent trade
            order.status = "FILLED"
            await self.close_trade(
                db, 
                order.parent_trade_id, 
                order.user_id, 
                fill_price, 
                exit_type=order.order_type,
                simulated_time=simulated_time or order.entry_time
            )
        else:
            order.status = "OPEN"
            
        order.entry_price = fill_price
        order.entry_time = simulated_time or datetime.utcnow()
        order.triggered = True
        
        db.add(order)
        # No need for flush here if close_trade already commits/flushes, 
        # but close_trade handles its own commits currently which might be tricky.
        # Wait, close_trade calls db.commit().
        
        # Prepare WS payload
        payload = TradeEngine.build_order_update_payload(order)
        payload["message"] = f"Conditional order {order.order_type} triggered and filled at {fill_price}"
        
        if order.user_id:
            await order_manager.emit_to_user(order.user_id, "order_update", payload)

    async def cancel_order(self, db: AsyncSession, order_id: int, user_id: int) -> bool:
        """Cancel a pending order (Async)."""
        result = await db.execute(
            select(TradeLog).filter(
                TradeLog.id == order_id,
                TradeLog.user_id == user_id,
                TradeLog.status == "PENDING"
            )
        )
        order = result.scalars().first()

        if not order:
            return False

        order.status = "CANCELLED"
        await db.commit()
        return True

    async def modify_order(self, db: AsyncSession, order_id: int, user_id: int, updates: dict) -> Optional[TradeLog]:
        """Modify an order's parameters (Async)."""
        result = await db.execute(
            select(TradeLog).filter(
                TradeLog.id == order_id,
                TradeLog.user_id == user_id,
                TradeLog.status.in_(["PENDING", "OPEN", "TRIGGERED"])
            )
        )
        order = result.scalars().first()

        if not order:
            return None

        # Fields that can be modified
        modifiable_fields = ["limit_price", "stop_price", "stop_loss", "take_profit", "quantity"]
        for field in modifiable_fields:
            if field in updates:
                setattr(order, field, updates[field])

        # If it's a parent trade being modified, sync with children
        if order.status == "OPEN":
            if "stop_loss" in updates:
                res_sl = await db.execute(
                    select(TradeLog).filter(
                        TradeLog.parent_trade_id == order.id,
                        TradeLog.order_type == "STOP",
                        TradeLog.status == "PENDING"
                    )
                )
                sl_child = res_sl.scalars().first()
                if sl_child:
                    sl_child.stop_price = updates["stop_loss"]
            
            if "take_profit" in updates:
                res_tp = await db.execute(
                    select(TradeLog).filter(
                        TradeLog.parent_trade_id == order.id,
                        TradeLog.order_type == "LIMIT",
                        TradeLog.status == "PENDING"
                    )
                )
                tp_child = res_tp.scalars().first()
                if tp_child:
                    tp_child.limit_price = updates["take_profit"]

        await db.commit()
        await db.refresh(order)
        return order

    async def close_trade(self, db: AsyncSession, trade_id: int, user_id: int, exit_price: float, exit_type: str = "MARKET", simulated_time: Optional[datetime] = None) -> Optional[TradeLog]:
        """Close an open trade (Async)."""
        result = await db.execute(
            select(TradeLog).filter(
                TradeLog.id == trade_id,
                TradeLog.user_id == user_id,
                TradeLog.status.in_(["OPEN", "TRIGGERED"])
            )
        )
        trade = result.scalars().first()

        if not trade:
            return None

        trade.status = "CLOSED"
        trade.exit_price = exit_price
        trade.exit_time = simulated_time or datetime.utcnow()
        
        # Calculate PnL
        multiplier = 1 if trade.direction == "BUY" else -1
        trade.pnl = (exit_price - trade.entry_price) * trade.quantity * multiplier

        # Cancel any linked PENDING orders (SL/TP)
        await db.execute(
            update(TradeLog).filter(
                TradeLog.parent_trade_id == trade.id,
                TradeLog.status == "PENDING"
            ).values(status="CANCELLED")
        )

        await db.commit()
        await db.refresh(trade)
        return trade

    async def close_all_trades(self, db: AsyncSession, user_id: int, exit_price_mapping: dict[str, float], session_type: str = "LIVE", simulated_time: Optional[datetime] = None) -> list[TradeLog]:
        """Close all open/triggered trades (Async)."""
        result = await db.execute(
            select(TradeLog).filter(
                TradeLog.user_id == user_id,
                TradeLog.status.in_(["OPEN", "TRIGGERED"]),
                TradeLog.session_type == session_type
            )
        )
        trades = result.scalars().all()

        closed_trades = []
        for trade in trades:
            exit_price = exit_price_mapping.get(trade.symbol)
            if exit_price is None:
                continue
                
            trade.status = "CLOSED"
            trade.exit_price = exit_price
            trade.exit_time = simulated_time or datetime.utcnow()
            
            # Calculate PnL
            multiplier = 1 if trade.direction == "BUY" else -1
            trade.pnl = (exit_price - trade.entry_price) * trade.quantity * multiplier

            # Cancel any linked PENDING orders (SL/TP)
            await db.execute(
                update(TradeLog).filter(
                    TradeLog.parent_trade_id == trade.id,
                    TradeLog.status == "PENDING"
                ).values(status="CANCELLED")
            )
            
            closed_trades.append(trade)

        await db.commit()
        for t in closed_trades:
            await db.refresh(t)
        return closed_trades

# Singleton instance
oms_service = OrderManagementSystem()
