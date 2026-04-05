import asyncio
import os
import sys
from sqlalchemy import select, delete
from app.database import get_session
from app.models import User, TradeLog
from app.trade_engine import TradeEngine
from app.services.order_management import oms_service
from app.schemas import TradeExecuteRequest, TradeDirection, OrderType, TradeExitRequest

async def test_balance_flow():
    print("🧪 Starting Balance Flow Verification Test...")
    db = await get_session()
    
    test_email = "test_trader_bonus@gmail.com"
    
    try:
        # 1. Clean up existing test user
        await db.execute(delete(TradeLog).where(TradeLog.user_id.in_(
            select(User.id).where(User.email == test_email)
        )))
        await db.execute(delete(User).where(User.email == test_email))
        await db.commit()
        
        # 2. Create Test User
        user = User(
            email=test_email,
            full_name="Test Trader",
            hashed_password="hashed",
            is_verified=True,
            balance=100000.0,
            demat_id="RS-TEST-0001"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        user_id = user.id
        print(f"✅ Created test user with balance: ₹{user.balance:,.2f}")

        # 3. Execute BUY Trade (MARKET)
        # Symbol: RELIANCE, Qty: 10, Price: 2500 -> Total: 25,000
        request = TradeExecuteRequest(
            symbol="RELIANCE",
            direction=TradeDirection.BUY,
            quantity=10,
            price=2500.0,
            order_type=OrderType.MARKET
        )
        
        print("🚀 Executing BUY order for 10x RELIANCE @ 2500...")
        result = await TradeEngine.execute_trade(request, user_id, db)
        trade_id = result["trade_id"]
        
        await db.refresh(user)
        print(f"💰 Balance after BUY: ₹{user.balance:,.2f} (Expected: 75,000.00)")
        assert user.balance == 75000.0, f"Balance mismatch! Got {user.balance}"

        # 4. Close Trade (SELL) at Profit
        # Exit Price: 2600 -> Total Credit: 26,000
        print("🏁 Closing trade @ 2600 (Profit)...")
        exit_request = TradeExitRequest(exit_type="MARKET")
        await oms_service.close_trade(db, trade_id, user_id, exit_price=2600.0)
        
        await db.refresh(user)
        print(f"💰 Balance after Close: ₹{user.balance:,.2f} (Expected: 101,000.00)")
        assert user.balance == 101000.0, f"Balance mismatch! Got {user.balance}"

        print("✨ All Balance Flow tests passed successfully!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        await db.rollback()
    finally:
        # Final cleanup
        # await db.execute(delete(TradeLog).where(TradeLog.user_id == user_id))
        # await db.execute(delete(User).where(User.id == user_id))
        # await db.commit()
        await db.close()

if __name__ == "__main__":
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    asyncio.run(test_balance_flow())
