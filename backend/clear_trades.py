import asyncio
import os
import sys

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import delete
from app.database import get_session
from app.models import TradeLog

async def clear_active_trades():
    print("🔄 Resetting trading dashboard...")
    
    session = await get_session()
    try:
        # Delete active trades (OPEN, PENDING, TRIGGERED)
        stmt = delete(TradeLog).where(
            TradeLog.status.in_(["OPEN", "PENDING", "TRIGGERED"])
        )
        result = await session.execute(stmt)
        await session.commit()
        
        count = result.rowcount
        print(f"✅ Successfully removed {count} active trades from the dashboard.")
    except Exception as e:
        print(f"❌ Error clearing trades: {e}")
        await session.rollback()
    finally:
        await session.close()

if __name__ == "__main__":
    asyncio.run(clear_active_trades())
