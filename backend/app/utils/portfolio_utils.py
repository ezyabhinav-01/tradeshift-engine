# File: backend/app/utils/portfolio_utils.py

import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models import PortfolioHolding

logger = logging.getLogger(__name__)

async def sync_portfolio_holding(
    db: AsyncSession, 
    user_id: int, 
    symbol: str, 
    quantity_delta: int, 
    price: float, 
    direction: str, 
    session_type: str = "REPLAY"
):
    """
    Synchronizes the PortfolioHolding table based on a trade execution.
    - quantity_delta: The number of shares traded (always positive).
    - direction: 'BUY' or 'SELL'.
    """
    try:
        # 1. Fetch current holding
        result = await db.execute(
            select(PortfolioHolding).filter(
                PortfolioHolding.user_id == user_id,
                PortfolioHolding.symbol == symbol,
                PortfolioHolding.session_type == session_type
            )
        )
        holding = result.scalars().first()

        if direction.upper() == "BUY":
            if holding:
                # Average Cost Calculation: (Old Qty * Old Cost + New Qty * New Price) / Total Qty
                new_total_qty = holding.quantity + quantity_delta
                new_avg_cost = ((holding.quantity * holding.average_cost) + (quantity_delta * price)) / new_total_qty
                
                holding.quantity = new_total_qty
                holding.average_cost = new_avg_cost
                logger.info(f"Updated holding for {symbol}: Qty={new_total_qty}, AvgCost={new_avg_cost:.2f}")
            else:
                # Create new holding
                new_holding = PortfolioHolding(
                    user_id=user_id,
                    symbol=symbol,
                    quantity=quantity_delta,
                    average_cost=price,
                    session_type=session_type,
                    first_purchase_date=datetime.utcnow()
                )
                db.add(new_holding)
                logger.info(f"Created new holding for {symbol}: Qty={quantity_delta}, Price={price}")

        elif direction.upper() == "SELL":
            if holding:
                if holding.quantity > quantity_delta:
                    holding.quantity -= quantity_delta
                    logger.info(f"Reduced holding for {symbol}: Remaining Qty={holding.quantity}")
                else:
                    # Full exit or overshoot (we treat as full exit for simplicity in this model)
                    await db.delete(holding)
                    logger.info(f"Fully exited holding for {symbol}")
            else:
                # Short selling - in a simple equity model, we might just ignore or create a negative holding.
                # For this app, let's treat it as a "Position" only and not a "Holding" if it starts as a Sell.
                # However, to be consistent with TradeLog, we can create a negative quantity holding.
                new_holding = PortfolioHolding(
                    user_id=user_id,
                    symbol=symbol,
                    quantity=-quantity_delta,
                    average_cost=price,
                    session_type=session_type,
                    first_purchase_date=datetime.utcnow()
                )
                db.add(new_holding)
                logger.info(f"Created short holding for {symbol}: Qty={-quantity_delta}, Price={price}")

        # Flush to ensure it's part of the current transaction but not committed yet
        await db.flush()

    except Exception as e:
        logger.error(f"❌ Error syncing portfolio holding for {symbol}: {e}")
        # Note: We don't rollback here because this is called within another transaction (like execute_trade)
        raise e
