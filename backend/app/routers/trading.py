from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct
from app.database import get_db
from app.models import User, TradeLog, Notification
from app.schemas import TradeExecuteRequest, TradeResponse, OrderModifyRequest, TradeExitRequest, AlertTriggerRequest
from app.trade_engine import TradeEngine
from app.services.order_management import oms_service
from app.websocket_manager import order_manager
from app.config import SECRET_KEY, ALGORITHM
from app.services.email_service import send_trade_confirmation_email, send_trade_closed_email
import jwt
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trade", tags=["trading"])

async def _get_user_id(request: Request, db: AsyncSession) -> int:
    """Helper to extract user_id from JWT or fallback to 999 for local dev."""
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
    
    return 999 # Fallback for local dev

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
    user_id = await _get_user_id(request, db)
    try:
        result = await TradeEngine.execute_trade(trade_request, user_id, db)
        
        # Emit WebSocket update
        res_trade = await db.execute(select(TradeLog).filter(TradeLog.id == result["trade_id"]))
        trade = res_trade.scalars().first()
        if trade:
            ws_payload = TradeEngine.build_order_update_payload(trade)
            await order_manager.emit_to_user(user_id, "order_update", ws_payload)

        # Send trade confirmation email in background
        user_result = await db.execute(select(User).filter(User.id == user_id))
        user = user_result.scalars().first()
        if user and user.email:
            executed_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            background_tasks.add_task(
                send_trade_confirmation_email,
                user.email,
                user.full_name or "Trader",
                result["trade_id"],
                trade_request.symbol,
                trade_request.direction,
                trade_request.quantity,
                result.get("entry_price", 0.0),
                trade_request.order_type,
                executed_at,
                trade_request.stop_loss,
                trade_request.take_profit,
                user.demat_id,
            )
        
        # Add Notification
        notification = Notification(
            user_id=user_id,
            title="Order Executed",
            message=f"Filled {trade_request.direction} for {trade_request.quantity}x {trade_request.symbol} at {result.get('entry_price', 'market price')}.",
            type="success"
        )
        db.add(notification)
        await db.commit()
            
        return TradeResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error executing trade: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/orders")
async def get_active_orders(request: Request, db: AsyncSession = Depends(get_db)):
    """Return all active orders (Async)."""
    user_id = await _get_user_id(request, db)
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
    user_id = await _get_user_id(request, db)
    updates = modify_request.model_dump(exclude_unset=True)
    
    order = await oms_service.modify_order(db, order_id, user_id, updates)
    if not order:
        raise HTTPException(status_code=404, detail="Pending order not found or not owned by user")
    
    # Emit update
    ws_payload = TradeEngine.build_order_update_payload(order)
    await order_manager.emit_to_user(user_id, "order_update", ws_payload)
    
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
    user_id = await _get_user_id(request, db)
    success = await oms_service.cancel_order(db, order_id, user_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Pending order not found or not owned by user")
        
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
    user_id = await _get_user_id(request, db)
    
    from app.services.live_market import live_market_service
    current_price = live_market_service.get_last_price()
    
    exit_price = exit_request.limit_price if exit_request.exit_type == "LIMIT" else current_price

    trade = await oms_service.close_trade(db, trade_id, user_id, exit_price, exit_request.exit_type)
    if not trade:
        raise HTTPException(status_code=404, detail="Open trade not found or not owned by user")
    
    # Emit update
    ws_payload = TradeEngine.build_order_update_payload(trade)
    await order_manager.emit_to_user(user_id, "order_update", ws_payload)

    # Send trade closed email in background
    user_result = await db.execute(select(User).filter(User.id == user_id))
    user = user_result.scalars().first()
    if user and user.email:
        pnl = 0.0
        if trade.entry_price and exit_price:
            multiplier = 1 if trade.direction.upper() == "BUY" else -1
            pnl = round((exit_price - trade.entry_price) * (trade.quantity or 1) * multiplier, 2)
        closed_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
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
    user_id = await _get_user_id(request, db)
    
    result = await db.execute(
        select(distinct(TradeLog.symbol)).filter(
            TradeLog.user_id == user_id,
            TradeLog.status.in_(["OPEN", "TRIGGERED"])
        )
    )
    symbols = [s[0] for s in result.all()]
    
    if not symbols:
        return {"message": "No open positions to close", "closed_ids": []}

    from app.services.live_market import live_market_service
    price_mapping = {}
    for sym in symbols:
        price_mapping[sym] = live_market_service.get_last_price(sym)

    closed_trades = await oms_service.close_all_trades(db, user_id, price_mapping)
    
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
            closed_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
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
            message=f"Closed {trade.direction} for {trade.quantity or 1}x {trade.symbol} at {trade.exit_price or price_mapping.get(trade.symbol)}.",
            type="system"
        )
        db.add(notification)
    
    await db.commit()
    
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
    user_id = await _get_user_id(request, db)
    
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
        message=f"{alert_request.symbol} alert triggered at {alert_request.current_price}",
        type="alert"
    )
    db.add(notification)
    await db.commit()
    
    return {"message": "Alert email triggered successfully."}
