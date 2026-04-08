from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct
from app.models import PortfolioHolding, TradeLog, User, PortfolioSnapshot
from app.market_service import market_service
from app.sector_mapping import get_sector, get_sector_allocation, get_concentration_risks
from datetime import datetime, timedelta
import logging
import random
import asyncio

logger = logging.getLogger(__name__)

def xirr(cash_flows: List[tuple]) -> float:
    """
    Calculate the Extended Internal Rate of Return.
    cash_flows is a list of tuples: (date, amount)
    """
    if not cash_flows:
        return 0.0
        
    cash_flows.sort(key=lambda x: x[0])
    
    def xnpv(rate):
        if rate <= -1.0:
            return float('inf')
        t0 = cash_flows[0][0]
        return sum([cf[1] / ((1 + rate) ** ((cf[0] - t0).days / 365.0)) for cf in cash_flows])

    rate = 0.1
    for _ in range(100):
        f = xnpv(rate)
        if abs(f) < 1e-5:
            return rate
        
        df = (xnpv(rate + 0.0001) - f) / 0.0001
        if df == 0:
            break
        
        new_rate = rate - f / df
        if abs(new_rate - rate) < 1e-5:
            return new_rate
        rate = new_rate
        
    return rate

class PortfolioService:
    
    async def get_holdings(self, db: AsyncSession, user_id: int, session_type: str = 'REPLAY') -> List[Dict[str, Any]]:
        result = await db.execute(select(PortfolioHolding).filter(
            PortfolioHolding.user_id == user_id,
            PortfolioHolding.session_type == session_type
        ))
        holdings = result.scalars().all()
        
        results = []
        for h in holdings:
            try:
                from app.live_market import shoonya_live
                cached_price = None
                for key, data in shoonya_live.latest_data.items():
                    if h.symbol in data.get("symbol", "") or h.symbol == data.get("name", ""):
                        cached_price = data.get("price")
                        break
                ltp = cached_price if cached_price else h.average_cost * 1.0 # default to average cost
            except Exception:
                ltp = h.average_cost * 1.0
                
            invested = h.quantity * h.average_cost
            current_value = h.quantity * ltp
            pnl = current_value - invested
            pnl_pct = (pnl / invested * 100) if invested > 0 else 0
            
            results.append({
                "id": h.id,
                "symbol": h.symbol,
                "quantity": h.quantity,
                "average_cost": round(h.average_cost, 2),
                "ltp": round(ltp, 2),
                "invested_value": round(invested, 2),
                "current_value": round(current_value, 2),
                "pnl": round(pnl, 2),
                "pnl_percent": round(pnl_pct, 2),
                "is_positive": pnl >= 0,
                "first_purchase_date": h.first_purchase_date.strftime("%Y-%m-%d") if h.first_purchase_date else None
            })
            
        return sorted(results, key=lambda x: x["invested_value"], reverse=True)

    async def get_summary(self, db: AsyncSession, user_id: int, session_type: str = 'REPLAY') -> Dict[str, Any]:
        # Consolidated balance: Replay trades directly affect main user balance
        res = await db.execute(select(User.balance).filter(User.id == user_id))
        balance = res.scalars().first() or 100000.0

        holdings = await self.get_holdings(db, user_id, session_type)
        positions = await self.get_positions(db, user_id, session_type)
        
        # Combine holdings for total valuation (mirroring positions into holdings)
        total_invested = sum(h["invested_value"] for h in holdings)
        total_current = sum(h["current_value"] for h in holdings)
        total_pnl = total_current - total_invested
        total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0
        
        # 1. Real Equity Curve from PortfolioSnapshots
        snapshot_res = await db.execute(
            select(PortfolioSnapshot)
            .filter(PortfolioSnapshot.user_id == user_id, PortfolioSnapshot.session_type == session_type)
            .order_by(PortfolioSnapshot.timestamp.desc())
            .limit(30)
        )
        snapshots = snapshot_res.scalars().all()
        snapshots.reverse() # chronologically for the chart
        
        equity_curve = []
        if snapshots:
            for s in snapshots:
                equity_curve.append({
                    "date": s.timestamp.strftime("%d %b"),
                    "value": round(s.total_balance, 2)
                })
        
        # Always add 'Today' if curve is empty or last entry isn't today
        today_str = datetime.utcnow().strftime("%d %b")
        total_value = total_current + balance
        
        if not equity_curve or equity_curve[-1]["date"] != today_str:
            equity_curve.append({
                "date": today_str,
                "value": round(total_value, 2)
            })

        # 2. XIRR Calculation using cash flows
        cash_flows = []
        now = datetime.utcnow()
        for h in holdings:
            date_obj = datetime.strptime(h["first_purchase_date"], "%Y-%m-%d") if h["first_purchase_date"] else now
            cash_flows.append((date_obj, -h["invested_value"]))
        for p in positions:
            date_obj = datetime.strptime(p["entry_time"], "%Y-%m-%d %H:%M") if p["entry_time"] else now
            cash_flows.append((date_obj, -p["entry_value"]))
            
        calculated_xirr = 0.0
        if cash_flows:
            cash_flows.append((now, total_current))
            try:
                calculated_xirr = xirr(cash_flows) * 100
            except Exception:
                calculated_xirr = 0.0
                
        return {
            "total_invested": round(total_invested, 2),
            "current_value": round(total_current, 2),
            "total_pnl": round(total_pnl, 2),
            "pnl_percent": round(total_pnl_pct, 2),
            "xirr_percent": round(calculated_xirr, 2),
            "is_positive": total_pnl >= 0,
            "equity_curve": equity_curve,
            "cash_balance": round(balance, 2),
            "total_value": round(total_value, 2)
        }

    async def get_positions(self, db: AsyncSession, user_id: int, session_type: str = 'REPLAY') -> List[Dict[str, Any]]:
        result = await db.execute(select(TradeLog).filter(
            TradeLog.user_id == user_id,
            TradeLog.session_type == session_type,
            TradeLog.parent_trade_id.is_(None),
            TradeLog.status.in_(["OPEN", "TRIGGERED"])
        ))
        open_trades = result.scalars().all()

        results = []
        for t in open_trades:
            try:
                from app.live_market import shoonya_live
                cached_price = None
                for key, data in shoonya_live.latest_data.items():
                    if t.symbol in data.get("symbol", "") or t.symbol == data.get("name", ""):
                        cached_price = data.get("price")
                        break
                ltp = cached_price if cached_price else t.entry_price * 1.0 # default to entry price
            except Exception:
                ltp = t.entry_price * 1.0 if t.entry_price else 0

            entry_val = (t.quantity or 0) * (t.entry_price or 0)
            current_val = (t.quantity or 0) * ltp
            unrealized_pnl = current_val - entry_val
            pnl_pct = (unrealized_pnl / entry_val * 100) if entry_val > 0 else 0

            holding_mins = 0
            if t.entry_time:
                holding_mins = (datetime.utcnow() - t.entry_time).total_seconds() / 60

            results.append({
                "id": t.id,
                "symbol": t.symbol,
                "direction": t.direction or "BUY",
                "quantity": t.quantity or 0,
                "entry_price": round(t.entry_price or 0, 2),
                "ltp": round(ltp, 2),
                "entry_value": round(entry_val, 2),
                "current_value": round(current_val, 2),
                "unrealized_pnl": round(unrealized_pnl, 2),
                "pnl_percent": round(pnl_pct, 2),
                "is_positive": unrealized_pnl >= 0,
                "entry_time": t.entry_time.strftime("%Y-%m-%d %H:%M") if t.entry_time else None,
                "holding_minutes": round(holding_mins, 1),
                "stop_loss": t.stop_loss,
                "take_profit": t.take_profit,
                "sector": get_sector(t.symbol) if t.symbol else "Other",
            })
        return results

    async def get_sector_analysis(self, db: AsyncSession, user_id: int, session_type: str = 'REPLAY') -> Dict[str, Any]:
        holdings = await self.get_holdings(db, user_id, session_type)
        positions = await self.get_positions(db, user_id, session_type)

        combined_assets = []
        for h in holdings:
            combined_assets.append({
                "symbol": h["symbol"],
                "current_value": h["current_value"],
                "sector": get_sector(h["symbol"])
            })
        for p in positions:
            combined_assets.append({
                "symbol": p["symbol"],
                "current_value": p["current_value"],
                "sector": p["sector"]
            })

        allocation = get_sector_allocation(combined_assets)
        risks = get_concentration_risks(allocation, combined_assets)

        num_sectors = len(allocation)
        max_sector_pct = max((s["percent"] for s in allocation), default=0)
        diversity_score = min(100, max(0, int(
            (num_sectors / 8) * 50 + (1 - max_sector_pct / 100) * 50
        )))

        return {
            "allocation": allocation,
            "risks": risks,
            "diversity_score": diversity_score,
            "total_sectors": num_sectors,
            "risk_level": "Low" if diversity_score > 70 else ("Medium" if diversity_score > 40 else "High"),
        }
    
    async def save_portfolio_snapshot(self, user_id: int, session_type: str = 'REPLAY'):
        """Capture a snapshot of the user's total equity."""
        from app.database import get_session
        db = await get_session()
        try:
            summary = await self.get_summary(db, user_id, session_type)
            snapshot = PortfolioSnapshot(
                user_id=user_id,
                total_balance=summary["total_value"],
                equity_value=summary["current_value"],
                cash_balance=summary["cash_balance"],
                session_type=session_type,
                timestamp=datetime.utcnow()
            )
            db.add(snapshot)
            await db.commit()
            logger.info(f"✅ Portfolio snapshot saved for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Failed to save portfolio snapshot: {e}")
            await db.rollback()
        finally:
            await db.close()

    async def get_trade_research(self, db: AsyncSession, user_id: int, session_type: str = 'REPLAY') -> Dict[str, Any]:
        result = await db.execute(select(TradeLog).filter(
            TradeLog.user_id == user_id,
            TradeLog.session_type == session_type,
            TradeLog.exit_price.isnot(None),
            TradeLog.exit_price != 0
        ))
        all_trades = result.scalars().all()

        if not all_trades:
            return {
                "total_trades": 0,
                "win_rate": 0,
                "avg_holding_time_mins": 0,
                "avg_pnl": 0,
                "best_trade": None,
                "worst_trade": None,
                "sector_bias": [],
                "direction_split": {"BUY": 0, "SELL": 0},
                "insights": ["No completed trades yet. Start trading to see your analysis!"],
            }

        wins = [t for t in all_trades if (t.pnl or 0) > 0]
        losses = [t for t in all_trades if (t.pnl or 0) <= 0]
        win_rate = (len(wins) / len(all_trades) * 100) if all_trades else 0

        avg_holding = sum((t.holding_time or 0) for t in all_trades) / len(all_trades) if all_trades else 0
        avg_pnl = sum((t.pnl or 0) for t in all_trades) / len(all_trades) if all_trades else 0
        total_pnl = sum((t.pnl or 0) for t in all_trades)

        sorted_by_pnl = sorted(all_trades, key=lambda t: t.pnl or 0, reverse=True)
        best = sorted_by_pnl[0] if sorted_by_pnl else None
        worst = sorted_by_pnl[-1] if sorted_by_pnl else None

        def trade_summary(t):
            if not t: return None
            return {
                "symbol": t.symbol,
                "direction": t.direction,
                "pnl": round(t.pnl or 0, 2),
                "entry_price": round(t.entry_price or 0, 2),
                "exit_price": round(t.exit_price or 0, 2),
                "quantity": t.quantity,
                "holding_time": round(t.holding_time or 0, 1),
                "exit_reason": t.exit_reason,
            }

        sector_counts: Dict[str, int] = {}
        for t in all_trades:
            s = get_sector(t.symbol) if t.symbol else "Other"
            sector_counts[s] = sector_counts.get(s, 0) + 1
        sector_bias = sorted(
            [{"sector": k, "count": v, "percent": round(v / len(all_trades) * 100, 1)} for k, v in sector_counts.items()],
            key=lambda x: x["count"], reverse=True
        )

        buy_count = len([t for t in all_trades if (t.direction or "").upper() == "BUY"])
        sell_count = len(all_trades) - buy_count

        insights = []
        if win_rate >= 60: insights.append(f"✅ Strong win rate of {win_rate:.1f}%.")
        elif win_rate >= 40: insights.append(f"⚡ Your win rate is {win_rate:.1f}%.")
        else: insights.append(f"⚠️ Win rate is {win_rate:.1f}%.")

        if avg_holding > 60: insights.append(f"📊 Avg holding time is {avg_holding:.0f} mins.")
        else: insights.append(f"⚡ Avg holding time is {avg_holding:.0f} mins.")

        avg_win = sum((t.pnl or 0) for t in wins) / len(wins) if wins else 0
        avg_loss = abs(sum((t.pnl or 0) for t in losses) / len(losses)) if losses else 0
        if avg_loss > 0:
            rr_ratio = avg_win / avg_loss
            insights.append(f"📈 Risk:Reward ratio is {rr_ratio:.2f}:1.")

        return {
            "total_trades": len(all_trades),
            "win_rate": round(win_rate, 1),
            "loss_rate": round(100 - win_rate, 1),
            "wins": len(wins),
            "losses": len(losses),
            "avg_holding_time_mins": round(avg_holding, 1),
            "avg_pnl": round(avg_pnl, 2),
            "total_pnl": round(total_pnl, 2),
            "best_trade": trade_summary(best),
            "worst_trade": trade_summary(worst),
            "sector_bias": sector_bias,
            "direction_split": {"BUY": buy_count, "SELL": sell_count},
            "insights": insights,
        }

portfolio_service = PortfolioService()
