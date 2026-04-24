import logging
from datetime import datetime, timedelta
from sqlalchemy import select, and_, func
from app.database import get_session
from app.models import User, TradeLog, PortfolioSnapshot, PageEngagement
from app.services.email_service import send_weekly_summary_email

logger = logging.getLogger(__name__)

async def generate_and_send_weekly_ledgers():
    """
    Main job: Iterates through all users and sends their weekly performance ledger.
    Scheduled once per week.
    """
    db = await get_session()
    try:
        # 1. Fetch all users who are verified and have an email
        res_users = await db.execute(select(User).where(User.is_verified == True))
        users = res_users.scalars().all()
        
        now = datetime.utcnow()
        last_week = now - timedelta(days=7)
        start_date_str = last_week.strftime("%d %b %Y")
        end_date_str = now.strftime("%d %b %Y")
        
        logger.info(f"⏳ [LEDGER] Starting weekly ledger generation for {len(users)} users ({start_date_str} - {end_date_str})")
        
        for user in users:
            try:
                # 2. Fetch Trades closed in the last 7 days
                res_trades = await db.execute(
                    select(TradeLog).filter(
                        TradeLog.user_id == user.id,
                        TradeLog.status == "CLOSED",
                        TradeLog.exit_time >= last_week
                    ).order_by(TradeLog.exit_time.asc())
                )
                trades_rows = res_trades.scalars().all()
                
                # If a user has NO trades for the week, we still send a summary but the table will be empty
                formatted_trades = []
                total_pnl = 0.0
                wins = 0
                for t in trades_rows:
                    pnl = t.pnl or 0.0
                    total_pnl += pnl
                    if pnl > 0:
                        wins += 1
                    
                    formatted_trades.append({
                        "date": t.exit_time.strftime("%d %b %H:%M"),
                        "symbol": t.symbol,
                        "direction": t.direction,
                        "qty": t.quantity or 0,
                        "entry": t.entry_price or 0.0,
                        "exit": t.exit_price or 0.0,
                        "pnl": pnl
                    })
                
                # 3. Calculate Learning Time for the week
                res_learning = await db.execute(
                    select(func.sum(PageEngagement.duration_seconds))
                    .filter(
                        PageEngagement.user_id == user.id,
                        PageEngagement.timestamp >= last_week,
                        PageEngagement.page_path.like("/learn%")
                    )
                )
                learning_seconds = res_learning.scalar() or 0
                
                # 4. Fetch Balances (Opening/Closing) for reconciliation
                # Opening: Closest snapshot before last_week
                res_opening = await db.execute(
                    select(PortfolioSnapshot)
                    .filter(PortfolioSnapshot.user_id == user.id, PortfolioSnapshot.timestamp <= last_week)
                    .order_by(PortfolioSnapshot.timestamp.desc())
                    .limit(1)
                )
                opening_snap = res_opening.scalars().first()
                # Fallback: current balance minus weekly pnl
                opening_balance = opening_snap.total_balance if opening_snap else (user.balance - total_pnl)
                
                closing_balance = user.balance
                
                stats = {
                    "total_pnl": total_pnl,
                    "trade_count": len(formatted_trades),
                    "win_rate": (wins / len(formatted_trades) * 100) if formatted_trades else 0,
                    "opening_balance": opening_balance,
                    "closing_balance": closing_balance,
                    "learning_seconds": int(learning_seconds)
                }

                
                # 4. Send Email
                if user.email:
                    await send_weekly_summary_email(
                        email=user.email,
                        name=user.full_name or "Trader",
                        start_date=start_date_str,
                        end_date=end_date_str,
                        stats=stats,
                        trades=formatted_trades
                    )
                    
            except Exception as user_err:
                logger.error(f"❌ [LEDGER] Failed to process user {user.id}: {user_err}")
                
        logger.info("✅ [LEDGER] Weekly ledger batch process complete.")
                
    except Exception as e:
        logger.error(f"🔥 [LEDGER] Critical failure: {e}")
    finally:
        await db.close()
