# File: backend/app/trade_engine.py

"""
Trade Engine — handles order execution logic.
Creates trade records with advanced order parameters and builds
WebSocket event payloads for order lifecycle notifications.
"""

from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import TradeLog, User
from app.schemas import TradeExecuteRequest, TradeDirection
from sqlalchemy import update
from app.utils.portfolio_utils import sync_portfolio_holding
from app.utils.money import money_float
from app.services.execution_simulator import execution_simulator
from app.portfolio_service import portfolio_service
import logging

import logging
from app.database import get_session

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

        drafter = await TradeEngine.calculate_execution_draft(request, user_id)
        
        trade = drafter["trade"]
        db.add(trade)
        await db.flush() # Get trade.id before commit to link others
        
        # Link children to the real DB ID
        trade_id = trade.id
        execution_meta = drafter["meta"]

        # --- 3. CREATE LINKED ORDERS (for MARKET entry) ---
        if drafter["is_market"]:
            linked_orders = []
            if request.stop_loss:
                sl_order = TradeLog(
                    symbol=request.symbol,
                    direction="SELL" if request.direction.value == "BUY" else "BUY",
                    quantity=drafter["filled_quantity"],
                    entry_time=None,
                    exit_time=None,
                    holding_time=None,
                    stop_price=request.stop_loss,
                    order_type="STOP",
                    status="PENDING",
                    user_id=user_id,
                    parent_trade_id=trade_id,
                    alert=request.alert,
                    session_type=request.session_type
                )
                linked_orders.append(sl_order)

            if request.take_profit:
                tp_order = TradeLog(
                    symbol=request.symbol,
                    direction="SELL" if request.direction.value == "BUY" else "BUY",
                    quantity=drafter["filled_quantity"],
                    entry_time=None,
                    exit_time=None,
                    holding_time=None,
                    limit_price=request.take_profit,
                    order_type="LIMIT",
                    status="PENDING",
                    user_id=user_id,
                    parent_trade_id=trade_id,
                    alert=request.alert,
                    session_type=request.session_type
                )
                linked_orders.append(tp_order)
            
            if linked_orders:
                db.add_all(linked_orders)
            
            # --- UPDATE CASH BALANCE ---
            multiplier = -1 if request.direction == TradeDirection.BUY else 1
            transaction_value = money_float(drafter["filled_quantity"] * drafter["entry_price"])
            
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
                quantity_delta=drafter["filled_quantity"],
                price=drafter["entry_price"],
                direction=request.direction.value,
                session_type=request.session_type
            )

        await db.commit()
        await db.refresh(trade)
        from app.services.order_management import oms_service
        oms_service.invalidate_pending_cache(request.symbol, request.session_type, user_id)

        # 🔥 Emit WebSocket Payload instantly after commit
        from app.websocket_manager import order_manager
        ws_payload = TradeEngine.build_order_update_payload(trade)
        ws_payload["simulated_latency_ms"] = execution_meta["simulated_latency_ms"]
        ws_payload["simulated_slippage_bps"] = execution_meta["simulated_slippage_bps"]
        # order_manager.emit_to_user is async, so we await it
        await order_manager.emit_to_user(user_id, "order_update", ws_payload)
        
        # 🔥 Update snapshots in background
        import asyncio
        asyncio.create_task(portfolio_service.save_portfolio_snapshot(user_id, request.session_type))

        is_partial_fill = drafter["is_market"] and execution_meta["fill_ratio"] < 1.0
        status_label = "partially filled" if is_partial_fill else ("filled" if drafter["is_market"] else "placed as pending")
        logger.info(
            f"📈 Trade {status_label}: {request.direction.value} {request.quantity}x "
            f"{request.symbol} @ {drafter['entry_price']} ({drafter['trade'].order_type}) | ID: {trade.id}"
        )

        return {
            "trade_id": trade.id,
            "status": trade.status,
            "symbol": trade.symbol,
            "direction": trade.direction,
            "quantity": trade.quantity,
            "entry_price": trade.entry_price,
            "order_type": drafter["trade"].order_type,
            "stop_loss": trade.stop_loss,
            "take_profit": trade.take_profit,
            "requested_quantity": execution_meta["requested_quantity"],
            "fill_ratio": execution_meta["fill_ratio"],
            "simulated_latency_ms": execution_meta["simulated_latency_ms"],
            "simulated_slippage_bps": execution_meta["simulated_slippage_bps"],
            "message": f"Order {status_label} successfully",
        }

    @staticmethod
    async def calculate_execution_draft(request: TradeExecuteRequest, user_id: int) -> dict:
        """
        Calculate the trade result without touching the database.
        Returns a dictionary with a TradeLog object (unsaved) and metadata.
        """
        order_type = request.order_type.value
        is_market = order_type == "MARKET"

        # Determination of entry time
        entry_time = TradeEngine._normalize_db_timestamp(request.simulated_time) or datetime.utcnow()

        # Determine status and effective prices
        status = "OPEN" if is_market else "PENDING"
        entry_price = money_float(request.price)
        filled_quantity = request.quantity
        execution_meta = {
            "requested_quantity": request.quantity,
            "fill_ratio": 1.0,
            "simulated_latency_ms": 0,
            "simulated_slippage_bps": 0.0,
        }
        
        if is_market and (not entry_price or entry_price == 0):
            from app.live_market import live_market_service
            entry_price = live_market_service.get_last_price(request.symbol)

        if is_market and entry_price:
            execution = execution_simulator.simulate_fill(
                side=request.direction.value,
                quantity=request.quantity,
                reference_price=entry_price,
                simulated_time=request.simulated_time,
            )
            entry_price = money_float(execution.fill_price)
            filled_quantity = execution.fill_quantity
            entry_time = TradeEngine._normalize_db_timestamp(execution.execution_time) or entry_time
            execution_meta = {
                "requested_quantity": execution.requested_quantity,
                "fill_ratio": execution.fill_ratio,
                "simulated_latency_ms": execution.latency_ms,
                "simulated_slippage_bps": execution.slippage_bps,
            }

        limit_price = None if is_market else request.limit_price
        stop_price = None if is_market else request.stop_price

        trade = TradeLog(
            symbol=request.symbol,
            direction=request.direction.value,
            entry_price=entry_price if is_market else None,
            quantity=filled_quantity if is_market else request.quantity,
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

        return {
            "trade": trade,
            "meta": execution_meta,
            "is_market": is_market,
            "entry_price": entry_price,
            "filled_quantity": filled_quantity
        }

    @staticmethod
    async def save_trade_async(request: TradeExecuteRequest, user_id: int):
        """
        Background worker that performs the real DB persistence.
        Starts a fresh session to ensure atomicity outside router context.
        """
        db = await get_session()
        try:
            # Re-verify risk in the background just in case state changed
            order_data = request.model_dump()
            await risk_engine.check_order(db, user_id, order_data)

            # Re-calculate to keep logic consistent with drafting
            drafter = await TradeEngine.calculate_execution_draft(request, user_id)
            trade = drafter["trade"]
            db.add(trade)
            await db.flush()

            trade_id = trade.id
            if drafter["is_market"]:
                linked_orders = []
                if request.stop_loss:
                    linked_orders.append(TradeLog(
                        symbol=request.symbol, direction="SELL" if request.direction.value == "BUY" else "BUY",
                        quantity=drafter["filled_quantity"], status="PENDING", user_id=user_id,
                        parent_trade_id=trade_id, order_type="STOP", stop_price=request.stop_loss,
                        session_type=request.session_type
                    ))
                if request.take_profit:
                    linked_orders.append(TradeLog(
                        symbol=request.symbol, direction="SELL" if request.direction.value == "BUY" else "BUY",
                        quantity=drafter["filled_quantity"], status="PENDING", user_id=user_id,
                        parent_trade_id=trade_id, order_type="LIMIT", limit_price=request.take_profit,
                        session_type=request.session_type
                    ))
                if linked_orders: db.add_all(linked_orders)

                multiplier = -1 if request.direction == TradeDirection.BUY else 1
                tx_value = money_float(drafter["filled_quantity"] * drafter["entry_price"])
                await db.execute(update(User).where(User.id == user_id).values(balance=User.balance + (multiplier * tx_value)))
                
                await sync_portfolio_holding(db, user_id, request.symbol, drafter["filled_quantity"], drafter["entry_price"], request.direction.value, request.session_type)

            await db.commit()
            
            # 🔥 Emit WebSocket Payload instantly after commit
            from app.websocket_manager import order_manager
            await db.refresh(trade)
            ws_payload = TradeEngine.build_order_update_payload(trade)
            ws_payload["simulated_latency_ms"] = drafter["meta"]["simulated_latency_ms"]
            ws_payload["simulated_slippage_bps"] = drafter["meta"]["simulated_slippage_bps"]
            await order_manager.emit_to_user(user_id, "order_update", ws_payload)

            from app.services.order_management import oms_service
            oms_service.invalidate_pending_cache(request.symbol, request.session_type, user_id)
            logger.info(f"✅ Async background save complete for trade {trade_id}")
            
            # 🔥 Update snapshots in background too
            await portfolio_service.save_portfolio_snapshot(user_id, request.session_type)
        except Exception as e:
            import traceback
            logger.error(f"❌ Async background save failed: {e}\n{traceback.format_exc()}")
            await db.rollback()
        finally:
            await db.close()

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
            "order_type": trade.order_type,
            "entry_price": money_float(trade.entry_price or 0.0),
            "exit_price": money_float(trade.exit_price or 0.0),
            "stop_loss": trade.stop_loss,
            "take_profit": trade.take_profit,
            "limit_price": trade.limit_price,
            "stop_price": trade.stop_price,
            "quantity": trade.quantity or 0,
            "pnl": money_float(trade.pnl or 0.0),
            "parent_trade_id": trade.parent_trade_id,
            "session_type": trade.session_type,
            "exit_reason": trade.exit_reason,
            "entry_time": trade.entry_time.isoformat() if trade.entry_time else None,
            "exit_time": trade.exit_time.isoformat() if trade.exit_time else None,
            "holding_time_seconds": round(trade.holding_time or 0, 1),
            "holding_time_mins": round((trade.holding_time or 0) / 60.0, 2),
            "requested_quantity": trade.quantity or 0,
            "fill_ratio": 1.0,
            "simulated_latency_ms": None,
            "simulated_slippage_bps": None,
        }
