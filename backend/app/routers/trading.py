from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct, insert, text
from app.database import get_db
from app.models import User, TradeLog, Notification, UserEvent, SystemAlertLog
from app.schemas import TradeExecuteRequest, TradeResponse, OrderModifyRequest, TradeExitRequest, AlertTriggerRequest
from app.trade_engine import TradeEngine
from app.services.order_management import oms_service
from app.websocket_manager import order_manager
from app.config import SECRET_KEY, ALGORITHM
from app.services.email_service import send_trade_confirmation_email, send_trade_closed_email
import jwt
import logging
from datetime import datetime
from app.live_market import live_market_service
from app.portfolio_service import portfolio_service
from app.services.execution_simulator import execution_simulator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trade", tags=["trading"])

from app.dependencies import get_current_user

async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Try to get current user from cookie/header, return None if unauthenticated."""
    # 1. Check Session Token First
    session_token = request.cookies.get("session_id")
    if session_token:
        from app.models import UserSession
        from datetime import datetime
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


async def _get_user_id(request: Request, db: AsyncSession, session_type_arg: str = None) -> int:
    """Helper to extract authenticated user_id."""
    # Check session_type from query, headers, or passed argument
    session_type = (session_type_arg or request.query_params.get("session_type") or request.headers.get("X-Session-Type") or "REPLAY").upper()
    if session_type == "LIVE":
        session_type = "REPLAY"
    
    user = await get_optional_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user.id

@router.post("/", response_model=TradeResponse)
async def execute_trade(
    trade_request: TradeExecuteRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a new trade (Async).
    """
    user_id = await _get_user_id(request, db, trade_request.session_type)
    try:
        result = await TradeEngine.execute_trade(trade_request, user_id, db)
        
        # Emit WebSocket update
        res_trade = await db.execute(select(TradeLog).filter(TradeLog.id == result["trade_id"]))
        trade = res_trade.scalars().first()
        if trade:
            ws_payload = TradeEngine.build_order_update_payload(trade)
            ws_payload["requested_quantity"] = result.get("requested_quantity")
            ws_payload["fill_ratio"] = result.get("fill_ratio")
            ws_payload["simulated_latency_ms"] = result.get("simulated_latency_ms")
            ws_payload["simulated_slippage_bps"] = result.get("simulated_slippage_bps")
            await order_manager.emit_to_user(user_id, "order_update", ws_payload)

        # Send trade confirmation email in background
        user_result = await db.execute(select(User).filter(User.id == user_id))
        user = user_result.scalars().first()
        if user and user.email:
            executed_at_dt = trade.entry_time or datetime.utcnow()
            executed_at = executed_at_dt.strftime("%Y-%m-%d %H:%M:%S UTC")
            background_tasks.add_task(
                send_trade_confirmation_email,
                user.email,
                user.full_name or "Trader",
                result["trade_id"],
                trade_request.symbol,
                trade_request.direction,
                result.get("quantity", trade_request.quantity),
                result.get("entry_price", 0.0),
                trade_request.order_type,
                executed_at,
                trade_request.stop_loss,
                trade_request.take_profit,
                user.demat_id,
            )
        
        notification_price = result.get('entry_price')
        if notification_price is None or notification_price == 0:
            notification_price = "market price"
            
        # Add Notification
        notification = Notification(
            user_id=user_id,
            title="Order Executed",
            content=f"Filled {trade_request.direction} for {result.get('quantity', trade_request.quantity)}x {trade_request.symbol} at {notification_price}.",
            type="success"
        )
        db.add(notification)
        
        # Log User Event
        await db.execute(
            insert(UserEvent).values(
                user_id=user_id,
                event_name="trade_order_placed",
                event_data={
                    "symbol": trade_request.symbol,
                    "direction": trade_request.direction,
                    "quantity": result.get("quantity", trade_request.quantity),
                    "requested_quantity": result.get("requested_quantity", trade_request.quantity),
                    "fill_ratio": result.get("fill_ratio"),
                    "simulated_latency_ms": result.get("simulated_latency_ms"),
                    "simulated_slippage_bps": result.get("simulated_slippage_bps"),
                    "order_type": trade_request.order_type,
                    "trade_id": result["trade_id"]
                },
                created_at=text("CURRENT_TIMESTAMP")
            )
        )
        
        await db.commit()
        
        # 🔥 Snapshot: Update equity curve after trade execution
        background_tasks.add_task(portfolio_service.save_portfolio_snapshot, user_id, trade_request.session_type)
            
        return TradeResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        logger.error(f"Error executing trade: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to execute trade")

@router.get("/orders")
async def get_active_orders(request: Request, db: AsyncSession = Depends(get_db)):
    """Return all active orders (Async)."""
    user_id = await _get_user_id(request, db, request.query_params.get("session_type"))
    result = await db.execute(
        select(TradeLog).filter(
            TradeLog.user_id == user_id,
            TradeLog.status.in_(["OPEN", "PENDING", "TRIGGERED"])
        )
    )
    orders = result.scalars().all()
    return [TradeEngine.build_order_update_payload(o) for o in orders]

@router.patch("/order/{order_id}", response_model=TradeResponse)
async def modify_order(
    order_id: int,
    modify_request: OrderModifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Modify a pending order (Async).
    """
    user_id = await _get_user_id(request, db, request.query_params.get("session_type"))
    updates = modify_request.model_dump(exclude_unset=True)
    
    order = await oms_service.modify_order(db, order_id, user_id, updates)
    if not order:
        raise HTTPException(status_code=404, detail="Pending order not found or not owned by user")
    
    # Log User Event
    await db.execute(
        insert(UserEvent).values(
            user_id=user_id,
            event_name="trade_order_modified",
            event_data={
                "order_id": order_id,
                "updates": updates
            },
            created_at=text("CURRENT_TIMESTAMP")
        )
    )
    await db.commit()
    
    return TradeResponse(
        trade_id=order.id,
        status=order.status,
        symbol=order.symbol,
        direction=order.direction,
        quantity=order.quantity,
        entry_price=order.entry_price or 0.0,
        order_type=order.order_type,
        stop_loss=order.stop_loss,
        take_profit=order.take_profit,
        message="Order modified successfully"
    )

@router.delete("/order/{order_id}")
async def cancel_order(
    order_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a pending order (Async).
    """
    user_id = await _get_user_id(request, db, request.query_params.get("session_type"))
    success = await oms_service.cancel_order(db, order_id, user_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Pending order not found or not owned by user")
        
    # Log User Event
    await db.execute(
        insert(UserEvent).values(
            user_id=user_id,
            event_name="trade_order_cancelled",
            event_data={"order_id": order_id},
            created_at=text("CURRENT_TIMESTAMP")
        )
    )
    await db.commit()
        
    return {"message": "Order cancelled successfully", "order_id": order_id}

@router.post("/close/{trade_id}", response_model=TradeResponse)
async def close_trade(
    trade_id: int,
    exit_request: TradeExitRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Close an open trade (Async).
    """
    user_id = await _get_user_id(request, db, exit_request.session_type)
    trade_result = await db.execute(
        select(TradeLog).filter(
            TradeLog.id == trade_id,
            TradeLog.user_id == user_id,
            TradeLog.status.in_(["OPEN", "TRIGGERED"])
        )
    )
    trade_row = trade_result.scalars().first()
    if not trade_row:
        raise HTTPException(status_code=404, detail="Open trade not found or not owned by user")

    # Prefer caller-provided simulation exit price.
    # Otherwise resolve from symbol-specific live/replay price cache.
    resolved_market_price = live_market_service.get_last_price(trade_row.symbol)
    exit_price = exit_request.exit_price or (exit_request.limit_price if exit_request.exit_type == "LIMIT" else resolved_market_price)
    close_meta = {
        "simulated_latency_ms": 0,
        "simulated_slippage_bps": 0.0,
    }

    if exit_request.exit_type == "MARKET":
        close_exec = execution_simulator.simulate_fill(
            side="SELL" if trade_row.direction == "BUY" else "BUY",
            quantity=trade_row.quantity or 1,
            reference_price=exit_price,
            simulated_time=exit_request.simulated_time,
        )
        exit_price = close_exec.fill_price
        close_meta = {
            "simulated_latency_ms": close_exec.latency_ms,
            "simulated_slippage_bps": close_exec.slippage_bps,
        }

    trade = await oms_service.close_trade(
        db,
        trade_id,
        user_id,
        exit_price,
        exit_request.exit_type,
        exit_request.simulated_time,
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Open trade not found or not owned by user")
    
    # Emit update
    ws_payload = TradeEngine.build_order_update_payload(trade)
    ws_payload["simulated_latency_ms"] = close_meta["simulated_latency_ms"]
    ws_payload["simulated_slippage_bps"] = close_meta["simulated_slippage_bps"]
    await order_manager.emit_to_user(user_id, "order_update", ws_payload)

    # Send trade closed email in background
    user_result = await db.execute(select(User).filter(User.id == user_id))
    user = user_result.scalars().first()
    if user and user.email:
        pnl = 0.0
        if trade.entry_price and exit_price:
            multiplier = 1 if trade.direction.upper() == "BUY" else -1
            pnl = round((exit_price - trade.entry_price) * (trade.quantity or 1) * multiplier, 2)
        closed_at_dt = trade.exit_time or datetime.utcnow()
        closed_at = closed_at_dt.strftime("%Y-%m-%d %H:%M:%S UTC")
        background_tasks.add_task(
            send_trade_closed_email,
            user.email,
            user.full_name or "Trader",
            trade.id,
            trade.symbol,
            trade.direction,
            trade.quantity or 1,
            trade.entry_price or 0.0,
            exit_price,
            pnl,
            closed_at,
            user.demat_id,
        )
    
    # Log User Event
    await db.execute(
        insert(UserEvent).values(
            user_id=user_id,
            event_name="trade_position_closed",
            event_data={
                "trade_id": trade.id,
                "exit_price": exit_price,
                "simulated_latency_ms": close_meta["simulated_latency_ms"],
                "simulated_slippage_bps": close_meta["simulated_slippage_bps"],
                "pnl": pnl if 'pnl' in locals() else None
            },
            created_at=text("CURRENT_TIMESTAMP")
        )
    )
    await db.commit()
    
    return TradeResponse(
        trade_id=trade.id,
        status=trade.status,
        symbol=trade.symbol,
        direction=trade.direction,
        quantity=trade.quantity,
        entry_price=trade.entry_price or 0.0,
        order_type=trade.order_type,
        stop_loss=trade.stop_loss,
        take_profit=trade.take_profit,
        requested_quantity=trade.quantity,
        fill_ratio=1.0,
        simulated_latency_ms=close_meta["simulated_latency_ms"],
        simulated_slippage_bps=close_meta["simulated_slippage_bps"],
        message=f"Trade closed successfully at {exit_price}"
    )

@router.post("/close-all")
async def close_all_trades(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Close all open trades (Async).
    """
    try:
        body = await request.json()
    except:
        body = {}
    
    exit_price_req = body.get("exit_price")
    exit_price_mapping_req = body.get("exit_price_mapping") or {}
    session_type_val = (body.get("session_type", "REPLAY") or "REPLAY").upper()
    if session_type_val == "LIVE":
        session_type_val = "REPLAY"
    simulated_time = body.get("simulated_time")
    user_id = await _get_user_id(request, db, session_type_val)
    if simulated_time:
        try:
            simulated_time = datetime.fromisoformat(str(simulated_time).replace("Z", "+00:00"))
        except Exception:
            simulated_time = None
    
    result = await db.execute(
        select(distinct(TradeLog.symbol)).filter(
            TradeLog.user_id == user_id,
            TradeLog.status.in_(["OPEN", "TRIGGERED"]),
            TradeLog.session_type == session_type_val
        )
    )
    symbols = [s[0] for s in result.all()]
    
    if not symbols:
        return {"message": "No open positions to close", "closed_ids": []}

    price_mapping = {}
    for sym in symbols:
        explicit_price = None
        if isinstance(exit_price_mapping_req, dict):
            explicit_price = exit_price_mapping_req.get(sym)
        # Priority: per-symbol map > single explicit exit_price > symbol-specific market/replay price
        price_mapping[sym] = explicit_price if explicit_price is not None else (exit_price_req or live_market_service.get_last_price(sym))

    closed_trades = await oms_service.close_all_trades(
        db,
        user_id,
        price_mapping,
        session_type=session_type_val,
        simulated_time=simulated_time,
    )
    
    user_result = await db.execute(select(User).filter(User.id == user_id))
    user = user_result.scalars().first()
    
    closed_ids = []
    for trade in closed_trades:
        ws_payload = TradeEngine.build_order_update_payload(trade)
        await order_manager.emit_to_user(user_id, "order_update", ws_payload)
        closed_ids.append(trade.id)
        
        # Send trade closed email in background
        if user and user.email:
            exit_price = trade.exit_price or price_mapping.get(trade.symbol, trade.entry_price or 0.0)
            pnl = 0.0
            if trade.entry_price and exit_price:
                multiplier = 1 if trade.direction.upper() == "BUY" else -1
                pnl = round((exit_price - trade.entry_price) * (trade.quantity or 1) * multiplier, 2)
            closed_at_dt = trade.exit_time or datetime.utcnow()
            closed_at = closed_at_dt.strftime("%Y-%m-%d %H:%M:%S UTC")
            background_tasks.add_task(
                send_trade_closed_email,
                user.email,
                user.full_name or "Trader",
                trade.id,
                trade.symbol,
                trade.direction,
                trade.quantity or 1,
                trade.entry_price or 0.0,
                exit_price,
                pnl,
                closed_at,
                user.demat_id,
            )
            
        # Add Notification
        notification = Notification(
            user_id=user_id,
            title="Position Closed",
            content=f"Closed {trade.direction} for {trade.quantity or 1}x {trade.symbol} at {trade.exit_price or price_mapping.get(trade.symbol)}.",
            type="system"
        )
        db.add(notification)
        
        # Log User Event
        await db.execute(
            insert(UserEvent).values(
                user_id=user_id,
                event_name="trade_position_closed",
                event_data={
                    "trade_id": trade.id,
                    "exit_price": trade.exit_price or price_mapping.get(trade.symbol),
                    "reason": "close_all"
                },
                created_at=text("CURRENT_TIMESTAMP")
            )
        )
    
    await db.commit()

    # 🔥 Snapshot: Update equity curve after closing all trades
    background_tasks.add_task(portfolio_service.save_portfolio_snapshot, user_id, session_type_val)
    
    return {
        "message": f"Successfully closed {len(closed_ids)} positions",
        "closed_ids": closed_ids
    }

@router.post("/alert/trigger")
async def trigger_price_alert(
    alert_request: AlertTriggerRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a price alert email (Async).
    """
    user_id = await _get_user_id(request, db, request.query_params.get("session_type"))
    
    # We allow fallback to 999 for local dev but we can't email without a real user
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    
    if not user or not user.email:
        # Just return 200 so frontend doesn't error out in local simulation without auth
        return {"message": "Alert logged. (No valid user email found to send)"}
        
    from app.services.email_service import send_price_alert_email
    background_tasks.add_task(
        send_price_alert_email,
        email=user.email,
        name=user.full_name or "Trader",
        demat_id=user.demat_id,
        symbol=alert_request.symbol,
        condition=alert_request.condition,
        target_value=alert_request.target_value,
        current_price=alert_request.current_price,
        side=alert_request.side,
        message=alert_request.message
    )
    
    # Add Notification
    notification = Notification(
        user_id=user_id,
        title="Price Alert Triggered",
        content=f"{alert_request.symbol} alert triggered at {alert_request.current_price}",
        type="alert"
    )
    db.add(notification)

    # Log to SystemAlertLog for historical audit
    alert_log = SystemAlertLog(
        user_id=user_id,
        symbol=alert_request.symbol,
        alert_type=alert_request.condition,
        message=alert_request.message,
        trigger_price=alert_request.current_price,
        timestamp=datetime.utcnow()
    )
    db.add(alert_log)
    
    await db.commit()
    
    return {"message": "Alert email triggered successfully."}
