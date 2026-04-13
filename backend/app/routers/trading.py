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
        # 1. Sync Calculation (Fast)
        drafter = await TradeEngine.calculate_execution_draft(trade_request, user_id)
        
        # 2. Emit WebSocket update (Instant)
        ws_payload = drafter["meta"].copy()
        # Note: In draft mode, we don't have a DB ID yet, but we can return the draft state.
        # However, to be fully functional, it's better to background the REAL work
        # and let the background task emit the final ID.
        # BUT the user wants "Message goes instantly".
        # Let's emit a 'preliminary' update or just let the background task handle it if it's fast enough.
        # Actually, the user wants lightning fast. Let's background the whole thing
        # but return a 202 immediately.
        
        background_tasks.add_task(TradeEngine.save_trade_async, trade_request, user_id)
            
        return TradeResponse(
            trade_id=0, # Signal that it's being processed
            status=drafter["trade"].status,
            symbol=drafter["trade"].symbol,
            direction=drafter["trade"].direction,
            quantity=drafter["trade"].quantity,
            entry_price=drafter["entry_price"] or 0.0,
            order_type=drafter["trade"].order_type,
            message="Order accepted for high-speed execution"
        )
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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a pending order (Async).
    """
    session_type = (request.query_params.get("session_type") or "REPLAY").upper()
    user_id = await _get_user_id(request, db, session_type)
    success = await oms_service.cancel_order(db, order_id, user_id, session_type=session_type)
    
    if not success:
        raise HTTPException(status_code=404, detail="Pending order not found or not owned by user")

    # Commit deletion first so ancillary analytics/notification failures
    # can never rollback the actual order cancellation.
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    # Best-effort side effects only.
    try:
        notification = Notification(
            user_id=user_id,
            title="Order Cancelled",
            content=f"Pending order #{order_id} has been cancelled.",
            type="info",
            category="personal"
        )
        db.add(notification)
        await db.execute(
            insert(UserEvent).values(
                user_id=user_id,
                event_name="trade_order_cancelled",
                event_data={"order_id": order_id},
                created_at=text("CURRENT_TIMESTAMP")
            )
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.warning(f"Cancel order side-effects failed for user={user_id}, order_id={order_id}: {e}")
    
    # Portfolio snapshot runs in background — doesn't block response
    background_tasks.add_task(portfolio_service.save_portfolio_snapshot, user_id, session_type)
        
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

    # 1. Sync Calculation (Fast)
    draft = await oms_service.calculate_close_draft(
        db, trade_id, user_id, exit_price, exit_request.exit_type, exit_request.simulated_time
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Open trade not found or not owned by user")

    # 2. Emit WebSocket Update (Instant)
    # We add metadata before emitting
    ws_payload = draft.copy()
    ws_payload["simulated_latency_ms"] = close_meta["simulated_latency_ms"]
    ws_payload["simulated_slippage_bps"] = close_meta["simulated_slippage_bps"]
    await order_manager.emit_to_user(user_id, "order_update", ws_payload)

    # 3. Background DB Persistence
    background_tasks.add_task(
        oms_service.close_trade_async,
        trade_id, user_id, exit_price, exit_request.exit_type, exit_request.simulated_time
    )
    
    return TradeResponse(
        trade_id=trade_id,
        status="CLOSED",
        symbol=draft["symbol"],
        direction=draft["direction"],
        quantity=draft["quantity"],
        entry_price=draft["entry_price"],
        order_type=draft["order_type"],
        message=f"Position close request accepted for high-speed execution"
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
        
            
        # Add Notification
        notification = Notification(
            user_id=user_id,
            title="Position Closed",
            content=f"Closed {trade.direction} for {trade.quantity or 1}x {trade.symbol} at {trade.exit_price or price_mapping.get(trade.symbol)}.",
            type="system",
            category="personal"
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
        type="alert",
        category="personal"
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
