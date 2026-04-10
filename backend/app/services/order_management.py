import logging
import asyncio
from datetime import datetime, timezone
import time
from typing import Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, update
from app.models import TradeLog, User
from app.database import get_session
from app.websocket_manager import order_manager
from app.trade_engine import TradeEngine
from app.portfolio_service import portfolio_service
from app.utils.portfolio_utils import sync_portfolio_holding
from app.utils.money import money_float, pnl as calc_pnl
from app.services.execution_simulator import execution_simulator

logger = logging.getLogger(__name__)

class OrderManagementSystem:
    """
    Enhanced OMS handles complex order lifecycles (Async).
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self._pending_presence_cache: Dict[Tuple[Optional[int], str, str], Tuple[bool, float]] = {}
        self._queued_price_updates: Dict[Tuple[Optional[int], str, str], Tuple[float, Optional[datetime]]] = {}
        self._price_update_workers: Dict[Tuple[Optional[int], str, str], asyncio.Task] = {}

    @staticmethod
    def _normalize_db_timestamp(ts: Optional[datetime]) -> Optional[datetime]:
        """
        Convert aware datetimes to naive UTC-like values because our DB columns
        are TIMESTAMP WITHOUT TIME ZONE.
        """
        if ts is None:
            return None
        if ts.tzinfo is not None:
            return ts.astimezone(timezone.utc).replace(tzinfo=None)
        return ts

    def _pending_cache_key(self, symbol: str, session_type: str, user_id: Optional[int] = None) -> Tuple[Optional[int], str, str]:
        return (user_id, (session_type or "REPLAY").upper(), symbol)

    def invalidate_pending_cache(
        self,
        symbol: Optional[str] = None,
        session_type: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> None:
        keys_to_delete = []
        normalized_session = (session_type or "REPLAY").upper() if session_type is not None else None
        for key in list(self._pending_presence_cache.keys()):
            key_user_id, key_session_type, key_symbol = key
            if user_id is not None and key_user_id != user_id:
                continue
            if normalized_session is not None and key_session_type != normalized_session:
                continue
            if symbol is not None and key_symbol != symbol:
                continue
            keys_to_delete.append(key)
        for key in keys_to_delete:
            self._pending_presence_cache.pop(key, None)

    async def _has_pending_orders(
        self,
        db: AsyncSession,
        symbol: str,
        session_type: str = "REPLAY",
        user_id: Optional[int] = None,
    ) -> bool:
        session_type = (session_type or "REPLAY").upper()
        cache_key = self._pending_cache_key(symbol, session_type, user_id)
        cached = self._pending_presence_cache.get(cache_key)
        now = time.monotonic()
        if cached and (now - cached[1]) < 2.0:
            return cached[0]

        stmt = select(func.count()).select_from(TradeLog).filter(
            TradeLog.symbol == symbol,
            TradeLog.status == "PENDING",
            TradeLog.session_type == session_type,
        )
        if user_id is not None:
            stmt = stmt.filter(TradeLog.user_id == user_id)

        result = await db.execute(stmt)
        has_pending = (result.scalar() or 0) > 0
        self._pending_presence_cache[cache_key] = (has_pending, now)
        return has_pending

    def queue_price_update(
        self,
        symbol: str,
        current_price: float,
        simulated_time: Optional[datetime] = None,
        session_type: str = "REPLAY",
        user_id: Optional[int] = None,
    ) -> None:
        key = self._pending_cache_key(symbol, session_type, user_id)
        self._queued_price_updates[key] = (current_price, simulated_time)
        worker = self._price_update_workers.get(key)
        if worker and not worker.done():
            return
        self._price_update_workers[key] = asyncio.create_task(self._drain_price_updates(key))

    async def _drain_price_updates(self, key: Tuple[Optional[int], str, str]) -> None:
        user_id, session_type, symbol = key
        try:
            while key in self._queued_price_updates:
                current_price, simulated_time = self._queued_price_updates.pop(key)
                await self.on_price_update(
                    symbol=symbol,
                    current_price=current_price,
                    simulated_time=simulated_time,
                    session_type=session_type,
                    user_id=user_id,
                )
                await asyncio.sleep(0)
        finally:
            self._price_update_workers.pop(key, None)

    async def on_price_update(
        self,
        symbol: str,
        current_price: float,
        simulated_time: Optional[datetime] = None,
        session_type: str = "REPLAY",
        user_id: Optional[int] = None,
    ):
        """
        Main entry point for price updates (Async).
        Scans for pending orders that should be triggered by the new price.
        """
        async with self._lock:
            # get_session is now async
            db: AsyncSession = await get_session()
            try:
                session_type = (session_type or "REPLAY").upper()
                has_pending = await self._has_pending_orders(db, symbol, session_type, user_id)
                if not has_pending:
                    return

                stmt = select(TradeLog).filter(
                    TradeLog.symbol == symbol,
                    TradeLog.status == "PENDING",
                    TradeLog.session_type == session_type
                )
                if user_id is not None:
                    stmt = stmt.filter(TradeLog.user_id == user_id)

                result = await db.execute(stmt)
                pending_orders = result.scalars().all()

                if not pending_orders:
                    self._pending_presence_cache[self._pending_cache_key(symbol, session_type, user_id)] = (False, time.monotonic())
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
        if order.order_type == "LIMIT" and order.limit_price is not None:
            if order.direction == "BUY" and current_price <= order.limit_price:
                triggered = True
            elif order.direction == "SELL" and current_price >= order.limit_price:
                triggered = True

        # 2. Handle STOP Orders
        elif order.order_type == "STOP" and order.stop_price is not None:
            if order.direction == "BUY" and current_price >= order.stop_price:
                triggered = True
            elif order.direction == "SELL" and current_price <= order.stop_price:
                triggered = True

        # 3. Handle GTT / Conditionals
        elif order.order_type == "GTT" and order.limit_price is not None:
             if order.direction == "BUY" and current_price <= order.limit_price:
                triggered = True
             elif order.direction == "SELL" and current_price >= order.limit_price:
                triggered = True
        
        if triggered:
            await self._execute_triggered_order(db, order, current_price, simulated_time)

    async def _execute_triggered_order(self, db: AsyncSession, order: TradeLog, fill_price: float, simulated_time: Optional[datetime] = None):
        """Transition order and notify (Async)."""
        execution = execution_simulator.simulate_fill(
            side=order.direction,
            quantity=order.quantity or 1,
            reference_price=fill_price,
            limit_price=order.limit_price if order.order_type == "LIMIT" else None,
            simulated_time=simulated_time,
        )
        effective_fill_price = money_float(execution.fill_price)
        normalized_time = self._normalize_db_timestamp(execution.execution_time)
        logger.info(
            f"🎯 ORDER TRIGGERED: {order.direction} {order.quantity} {order.symbol} @ {effective_fill_price} "
            f"(Session: {order.session_type}, latency={execution.latency_ms}ms, slip={execution.slippage_bps}bps)"
        )

        if order.parent_trade_id:
            # If it's a child order (SL/TP), it should close the parent trade
            order.status = "FILLED"
            await self.close_trade(
                db, 
                order.parent_trade_id, 
                order.user_id, 
                effective_fill_price, 
                exit_type=order.order_type,
                simulated_time=normalized_time or order.entry_time
            )
        else:
            order.status = "OPEN"
            order.quantity = execution.fill_quantity
            
        order.entry_price = effective_fill_price
        if order.entry_time is None:
            order.entry_time = normalized_time or datetime.utcnow()
        order.exit_time = None
        order.holding_time = None
        order.triggered = True
        
        # --- UPDATE CASH BALANCE (for triggered primary entries) ---
        if not order.parent_trade_id:
            multiplier = -1 if order.direction == "BUY" else 1
            transaction_value = money_float((order.quantity or 0) * effective_fill_price)
            
            await db.execute(
                update(User)
                .where(User.id == order.user_id)
                .values(balance=User.balance + (multiplier * transaction_value))
            )

        db.add(order)
        
        # 🔥 NEW: SYNC TO PORTFOLIO HOLDINGS
        # Only for primary entries (not children as they will trigger close_trade)
        if not order.parent_trade_id:
            await sync_portfolio_holding(
                db=db,
                user_id=order.user_id,
                symbol=order.symbol,
                quantity_delta=order.quantity,
                price=effective_fill_price,
                direction=order.direction,
                session_type=order.session_type
            )

        # No need for flush here...
        
        # Prepare WS payload
        payload = TradeEngine.build_order_update_payload(order)
        payload["requested_quantity"] = execution.requested_quantity
        payload["fill_ratio"] = execution.fill_ratio
        payload["simulated_latency_ms"] = execution.latency_ms
        payload["simulated_slippage_bps"] = execution.slippage_bps
        payload["message"] = f"Conditional order {order.order_type} triggered and filled at {effective_fill_price}"
        
        if order.user_id:
            await order_manager.emit_to_user(order.user_id, "order_update", payload)
            # 🔥 Snapshot: Update equity curve after triggered order fill
            asyncio.create_task(portfolio_service.save_portfolio_snapshot(order.user_id, order.session_type))
        self.invalidate_pending_cache(order.symbol, order.session_type, order.user_id)

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
        self.invalidate_pending_cache(order.symbol, order.session_type, order.user_id)
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
        self.invalidate_pending_cache(order.symbol, order.session_type, order.user_id)
        return order

    async def close_trade(self, db: AsyncSession, trade_id: int, user_id: int, exit_price: float, exit_type: str = "MARKET", simulated_time: Optional[datetime] = None) -> Optional[TradeLog]:
        """Close an open trade (Async)."""
        normalized_time = self._normalize_db_timestamp(simulated_time)
        exit_price = money_float(exit_price)
        close_time = normalized_time or datetime.utcnow()
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
        if trade.entry_price is None:
            logger.warning(f"Trade {trade.id} has no entry_price; cannot compute close PnL safely.")
            return None
        if trade.entry_time and close_time < trade.entry_time:
            # Guard against accidental replay clock rewind on UI side.
            close_time = trade.entry_time

        # Calculate PnL
        multiplier = 1 if trade.direction == "BUY" else -1
        pnl = calc_pnl(trade.entry_price, exit_price, trade.quantity or 0, multiplier)
        holding_time = None
        if trade.entry_time:
            holding_time = max(0.0, (close_time - trade.entry_time).total_seconds())

        await db.execute(
            update(TradeLog)
            .where(TradeLog.id == trade.id)
            .values(
                status="CLOSED",
                exit_price=exit_price,
                exit_time=close_time,
                exit_reason=f"manual_{exit_type.lower()}",
                pnl=pnl,
                holding_time=holding_time,
            )
        )

        # Cancel any linked PENDING orders (SL/TP)
        await db.execute(
            update(TradeLog).filter(
                TradeLog.parent_trade_id == trade.id,
                TradeLog.status == "PENDING"
            ).values(status="CANCELLED")
        )
        self.invalidate_pending_cache(trade.symbol, trade.session_type, trade.user_id)

        # --- UPDATE CASH BALANCE ---
        # For a BUY trade, closing (SELLING) adds cash.
        # For a SELL trade, closing (BUYING) removes cash.
        multiplier = 1 if trade.direction == "BUY" else -1
        exit_value = money_float((trade.quantity or 0) * exit_price)
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(balance=User.balance + (multiplier * exit_value))
        )

        # 🔥 NEW: SYNC TO PORTFOLIO HOLDINGS (CLOSING)
        # To close, we perform an opposite action to the holding pool
        close_direction = "SELL" if trade.direction == "BUY" else "BUY"
        await sync_portfolio_holding(
            db=db,
            user_id=user_id,
            symbol=trade.symbol,
            quantity_delta=trade.quantity,
            price=exit_price,
            direction=close_direction,
            session_type=trade.session_type or "REPLAY"
        )

        await db.commit()
        result = await db.execute(select(TradeLog).filter(TradeLog.id == trade.id))
        trade = result.scalars().first()
        
        # Persist the post-close snapshot before returning so request/test lifecycles
        # don't leave detached DB writers behind.
        await portfolio_service.save_portfolio_snapshot(user_id, trade.session_type or "REPLAY")

        return trade

    async def close_all_trades(self, db: AsyncSession, user_id: int, exit_price_mapping: dict[str, float], session_type: str = "REPLAY", simulated_time: Optional[datetime] = None) -> list[TradeLog]:
        """Close all open/triggered trades (Async)."""
        normalized_time = self._normalize_db_timestamp(simulated_time)
        close_time = normalized_time or datetime.utcnow()
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
            exit_price = money_float(exit_price)
            if trade.entry_price is None:
                logger.warning(f"Trade {trade.id} has no entry_price; skipping bulk close for safety.")
                continue
            trade_close_time = close_time
            if trade.entry_time and trade_close_time < trade.entry_time:
                trade_close_time = trade.entry_time
            
            # Calculate PnL
            multiplier = 1 if trade.direction == "BUY" else -1
            pnl = calc_pnl(trade.entry_price, exit_price, trade.quantity or 0, multiplier)
            holding_time = None
            if trade.entry_time:
                holding_time = max(0.0, (trade_close_time - trade.entry_time).total_seconds())

            await db.execute(
                update(TradeLog)
                .where(TradeLog.id == trade.id)
                .values(
                    status="CLOSED",
                    exit_price=exit_price,
                    exit_time=trade_close_time,
                    exit_reason="manual_bulk",
                    pnl=pnl,
                    holding_time=holding_time,
                )
            )

            # Cancel any linked PENDING orders (SL/TP)
            await db.execute(
                update(TradeLog).filter(
                    TradeLog.parent_trade_id == trade.id,
                    TradeLog.status == "PENDING"
                ).values(status="CANCELLED")
            )
            self.invalidate_pending_cache(trade.symbol, trade.session_type, trade.user_id)
            
            # Update Cash Balance for each trade
            multiplier = 1 if trade.direction == "BUY" else -1
            exit_value = money_float((trade.quantity or 0) * exit_price)
            await db.execute(
                update(User)
                .where(User.id == user_id)
                .values(balance=User.balance + (multiplier * exit_value))
            )

            close_direction = "SELL" if trade.direction == "BUY" else "BUY"
            await sync_portfolio_holding(
                db=db,
                user_id=user_id,
                symbol=trade.symbol,
                quantity_delta=trade.quantity,
                price=exit_price,
                direction=close_direction,
                session_type=trade.session_type or session_type
            )
            
            closed_trades.append(trade)

        await db.commit()
        if closed_trades:
            result = await db.execute(
                select(TradeLog).filter(TradeLog.id.in_([t.id for t in closed_trades]))
            )
            refreshed = {trade.id: trade for trade in result.scalars().all()}
            closed_trades = [refreshed[t.id] for t in closed_trades if t.id in refreshed]
            
        # 🔥 Snapshot: Update equity curve after closing all trades
        if closed_trades:
            asyncio.create_task(portfolio_service.save_portfolio_snapshot(user_id, session_type))
            
        return closed_trades

# Singleton instance
oms_service = OrderManagementSystem()
