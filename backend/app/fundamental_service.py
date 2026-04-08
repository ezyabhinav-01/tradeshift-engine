from datetime import datetime, timedelta
import logging
import os
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import StockFundamental, StockFinancial
from .services.fundamental_fetcher import FundamentalFetcherService

logger = logging.getLogger(__name__)


class FundamentalService:
    @staticmethod
    def _env_bool(name: str, default: bool = False) -> bool:
        value = os.getenv(name)
        if value is None:
            return default
        return str(value).strip().lower() in ("1", "true", "yes", "on")

    @staticmethod
    def _to_dict(model: Any) -> Dict[str, Any]:
        if model is None:
            return {}
        return {
            col.name: getattr(model, col.name)
            for col in model.__table__.columns
        }

    @staticmethod
    def _merge_fundamentals(
        db_fundamentals: Optional[StockFundamental],
        live_fundamentals: Optional[Dict[str, Any]],
        symbol: str,
    ) -> Dict[str, Any]:
        base = FundamentalService._to_dict(db_fundamentals)
        live = live_fundamentals or {}

        merged = {
            "symbol": symbol.upper(),
            "current_price": live.get("current_price"),
            "daily_change_percent": live.get("daily_change_percent"),
            "high_52w": live.get("high_52w"),
            "low_52w": live.get("low_52w"),
            "market_cap": live.get("market_cap", base.get("market_cap")),
            "pe_ratio": live.get("pe_ratio", base.get("pe_ratio")),
            "book_value": live.get("book_value"),
            "pb_ratio": live.get("pb_ratio", base.get("pb_ratio")),
            "dividend_yield": live.get("dividend_yield", base.get("dividend_yield")),
            "roe": live.get("roe", base.get("roe")),
            "roce": live.get("roce", base.get("roce")),
            "face_value": live.get("face_value"),
            "debt_to_equity": live.get("debt_to_equity", base.get("debt_to_equity")),
            "revenue_growth_5y": live.get("revenue_growth_5y", base.get("revenue_growth_5y")),
            "profit_growth_5y": live.get("profit_growth_5y", base.get("profit_growth_5y")),
            "ebitda_margin": live.get("ebitda_margin", base.get("ebitda_margin")),
            "current_ratio": live.get("current_ratio", base.get("current_ratio")),
            "free_cash_flow": live.get("free_cash_flow", base.get("free_cash_flow")),
            "promoter_holding": live.get("promoter_holding", base.get("promoter_holding")),
            "about": live.get("about"),
            "key_points": live.get("key_points"),
        }
        return merged

    @staticmethod
    def _is_stale(last_updated: Optional[datetime]) -> bool:
        if not last_updated:
            return True
        max_age_hours = int(os.getenv("FUNDAMENTAL_MAX_AGE_HOURS", "24"))
        return last_updated < datetime.utcnow() - timedelta(hours=max_age_hours)

    @staticmethod
    def _quality_status(
        merged_fundamentals: Dict[str, Any],
        db_fundamentals: Optional[StockFundamental],
        live_ok: bool,
    ) -> Dict[str, Any]:
        required = ["market_cap", "pe_ratio", "roe", "roce", "dividend_yield"]
        missing = [k for k in required if merged_fundamentals.get(k) is None]
        stale = FundamentalService._is_stale(getattr(db_fundamentals, "last_updated", None))

        if live_ok and not missing:
            grade = "A"
            status = "ok"
        elif not missing:
            grade = "B"
            status = "degraded_live_unavailable"
        else:
            grade = "C"
            status = "incomplete"

        return {
            "status": status,
            "grade": grade,
            "missing_fields": missing,
            "db_stale": stale,
            "last_db_update": getattr(db_fundamentals, "last_updated", None).isoformat()
            if getattr(db_fundamentals, "last_updated", None)
            else None,
        }

    @staticmethod
    async def get_stock_profile(db: AsyncSession, symbol: str):
        """
        Return fundamentals profile with real-time best-effort enrichment.
        Never returns synthetic hardcoded company fundamentals unless explicitly enabled.
        """
        symbol_up = symbol.upper()
        allow_mock = FundamentalService._env_bool("ALLOW_MOCK_FUNDAMENTALS", False)

        db_fundamental: Optional[StockFundamental] = None
        db_financials: List[StockFinancial] = []

        if db is not None:
            result_f = await db.execute(
                select(StockFundamental).filter(StockFundamental.symbol == symbol_up)
            )
            db_fundamental = result_f.scalars().first()

            result_fin = await db.execute(
                select(StockFinancial)
                .filter(StockFinancial.symbol == symbol_up)
                .order_by(StockFinancial.year.desc())
            )
            db_financials = result_fin.scalars().all()

        live_snapshot: Optional[Dict[str, Any]] = None
        live_ok = False
        try:
            live_snapshot = await FundamentalFetcherService.fetch_live_profile(symbol_up)
            live_ok = True
        except Exception as e:
            logger.warning(f"⚠️ Live fetch failed for {symbol_up}: {e}")

        # Refresh DB snapshot if stale/missing and live data is available.
        if db is not None and live_ok and (
            db_fundamental is None or FundamentalService._is_stale(db_fundamental.last_updated)
        ):
            try:
                await FundamentalFetcherService._upsert_fundamentals(
                    db,
                    symbol_up,
                    (live_snapshot or {}).get("fundamentals", {}),
                )
                await FundamentalFetcherService._upsert_financials(
                    db,
                    symbol_up,
                    (live_snapshot or {}).get("financials", []),
                )
                await db.commit()

                result_f = await db.execute(
                    select(StockFundamental).filter(StockFundamental.symbol == symbol_up)
                )
                db_fundamental = result_f.scalars().first()
            except Exception as e:
                await db.rollback()
                logger.warning(f"⚠️ DB refresh failed for {symbol_up}: {e}")

        merged_fundamentals = FundamentalService._merge_fundamentals(
            db_fundamentals=db_fundamental,
            live_fundamentals=(live_snapshot or {}).get("fundamentals"),
            symbol=symbol_up,
        )

        financials = (
            (live_snapshot or {}).get("financials")
            or [
                {
                    "year": item.year,
                    "revenue": item.revenue,
                    "net_profit": item.net_profit,
                    "operating_profit": item.operating_profit,
                    "eps": item.eps,
                }
                for item in db_financials
            ]
        )

        profile = {
            "fundamentals": merged_fundamentals,
            "financials": financials,
            "quarterly_performance": (live_snapshot or {}).get("quarterly_performance", []),
            "meta": {
                "symbol": symbol_up,
                "source_priority": ["db_cache", "yfinance_live"],
                "live_fetch_success": live_ok,
                **((live_snapshot or {}).get("meta", {})),
            },
            "quality": FundamentalService._quality_status(
                merged_fundamentals=merged_fundamentals,
                db_fundamentals=db_fundamental,
                live_ok=live_ok,
            ),
            "is_mock": False,
        }

        # Explicitly gated fallback for local demo-only environments.
        if (
            allow_mock
            and not live_ok
            and db_fundamental is None
            and not financials
        ):
            logger.warning(
                "⚠️ ALLOW_MOCK_FUNDAMENTALS=true and no live/db data available; serving mock fallback."
            )
            mock_profile = FundamentalService._get_mock_data(symbol_up)
            mock_profile["quality"] = {
                "status": "mock_fallback",
                "grade": "D",
                "missing_fields": [],
                "db_stale": True,
                "last_db_update": None,
            }
            return mock_profile

        return profile

    @staticmethod
    def _get_mock_data(symbol: str):
        # Kept only for explicit, env-gated local demo mode.
        return {
            "fundamentals": {
                "symbol": symbol,
                "current_price": None,
                "high_52w": None,
                "low_52w": None,
                "market_cap": None,
                "pe_ratio": None,
                "book_value": None,
                "pb_ratio": None,
                "dividend_yield": None,
                "roe": None,
                "roce": None,
                "face_value": None,
                "debt_to_equity": None,
                "revenue_growth_5y": None,
                "profit_growth_5y": None,
                "ebitda_margin": None,
                "current_ratio": None,
                "free_cash_flow": None,
                "promoter_holding": None,
                "about": f"{symbol} profile unavailable.",
                "key_points": {
                    "Market Position": "Data unavailable.",
                    "Strategic Focus": "Data unavailable.",
                },
            },
            "financials": [],
            "quarterly_performance": [],
            "meta": {"source": "mock"},
            "is_mock": True,
        }

    @staticmethod
    async def update_fundamentals(db: AsyncSession, symbol: str, data: dict):
        result = await db.execute(select(StockFundamental).filter(StockFundamental.symbol == symbol))
        fundamental = result.scalars().first()
        if not fundamental:
            fundamental = StockFundamental(symbol=symbol)
            db.add(fundamental)

        for key, value in data.items():
            if hasattr(fundamental, key):
                setattr(fundamental, key, value)

        await db.commit()
        await db.refresh(fundamental)
        return fundamental
