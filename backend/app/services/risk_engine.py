import logging
import json
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis import Redis
import os

logger = logging.getLogger(__name__)

class RiskEngine:
    """
    Risk Engine for validating orders before execution.
    Checks for:
    1. Max Order Quantity limits.
    2. Daily Realized Loss limits (using Redis).
    """

    def __init__(self, redis_host: Optional[str] = None, redis_port: int = 6379):
        if redis_host is None:
            redis_host = os.getenv("REDIS_HOST", "localhost")
        try:
            self.redis = Redis(host=redis_host, port=redis_port, decode_responses=True)
            # Test connection
            self.redis.ping()
        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed for RiskEngine: {e}. Running in degraded mode.")
            self.redis = None

    async def get_user_settings(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """
        Fetch user settings with Redis caching.
        """
        cache_key = f"user:{user_id}:settings"
        
        # 1. Try Cache
        if self.redis:
            try:
                cached = self.redis.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis cache read error: {e}")

        # 2. Try DB
        from app.models import UserSettings
        result = await db.execute(select(UserSettings).filter(UserSettings.user_id == user_id))
        settings_model = result.scalars().first()
        
        if not settings_model:
            # Return defaults if not found
            settings = {
                "max_daily_loss": float(os.getenv("RISK_MAX_DAILY_LOSS", 100000)),
                "max_order_quantity": int(os.getenv("RISK_MAX_QTY", 5000)),
                "one_click_trading_enabled": False,
                "require_session_confirmation": True
            }
        else:
            settings = {
                "max_daily_loss": float(settings_model.max_daily_loss),
                "max_order_quantity": int(settings_model.max_order_quantity),
                "one_click_trading_enabled": bool(settings_model.one_click_trading_enabled),
                "require_session_confirmation": bool(settings_model.require_session_confirmation)
            }

        # 3. Update Cache
        if self.redis:
            try:
                self.redis.setex(cache_key, 3600, json.dumps(settings)) # Cache for 1 hour
            except Exception as e:
                logger.error(f"Redis cache write error: {e}")

        return settings

    async def check_order(self, db: AsyncSession, user_id: int, order_data: Dict[str, Any]) -> None:
        """
        Validate an order against risk rules (Async).
        """
        qty = order_data.get("quantity", 0)
        
        # Fetch user settings (Cached)
        settings = await self.get_user_settings(db, user_id)

        # 1. Max Quantity Check
        max_qty = settings["max_order_quantity"]
        if qty > max_qty:
            raise ValueError(f"Order quantity {qty} exceeds your maximum allowed limit of {max_qty} lots.")

        # 2. Daily Loss Check (requires Redis)
        if self.redis:
            daily_loss = self.get_daily_loss(user_id)
            max_daily_loss = settings["max_daily_loss"]
            
            if daily_loss >= max_daily_loss:
                raise ValueError(f"Daily realized loss limit reached (Current: ₹{daily_loss:.2f}, Limit: ₹{max_daily_loss:.2f}).")

        logger.info(f"✅ Risk check passed for User {user_id}: {qty} lots of {order_data.get('symbol')}")

    def get_daily_loss(self, user_id: int) -> float:
        """Retrieve daily realized loss from Redis."""
        if not self.redis:
            return 0.0
        
        key = f"user:{user_id}:daily_loss"
        val = self.redis.get(key)
        return float(val) if val else 0.0

    def update_daily_loss(self, user_id: int, pnl_amount: float) -> float:
        """
        Update daily loss (only for losses).
        """
        if not self.redis or pnl_amount >= 0:
            return self.get_daily_loss(user_id)

        loss_amount = abs(pnl_amount)
        key = f"user:{user_id}:daily_loss"
        
        new_total = self.redis.incrbyfloat(key, loss_amount)
        self.redis.expire(key, 86400) # 24 hours
        
        return new_total

    def invalidate_settings_cache(self, user_id: int):
        """Clear cache when settings are updated."""
        if self.redis:
            self.redis.delete(f"user:{user_id}:settings")

# Singleton instance
risk_engine = RiskEngine()
