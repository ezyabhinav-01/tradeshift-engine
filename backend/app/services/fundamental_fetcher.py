import yfinance as yf
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import StockFundamental, StockFinancial
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
import asyncio

logger = logging.getLogger(__name__)

class FundamentalFetcherService:
    @staticmethod
    def _sanitize_float(value: Any, factor: float = 1.0, default: Optional[float] = None) -> Optional[float]:
        if value is None:
            return default
        try:
            if pd.isna(value):
                return default
            return round(float(value) * factor, 2)
        except Exception:
            return default

    @staticmethod
    def _to_crore(value: Any) -> Optional[float]:
        # Convert absolute INR values to crore INR for UI consistency.
        return FundamentalFetcherService._sanitize_float(value, factor=(1 / 10000000), default=None)

    @staticmethod
    def _extract_yearly_financials(ticker: yf.Ticker) -> List[Dict[str, Any]]:
        yearly_rows: List[Dict[str, Any]] = []
        financials = ticker.financials
        if financials is None or financials.empty:
            return yearly_rows

        for date_ts in financials.columns:
            row = financials[date_ts]
            yearly_rows.append({
                "year": int(date_ts.year),
                "revenue": FundamentalFetcherService._to_crore(row.get("Total Revenue")),
                "net_profit": FundamentalFetcherService._to_crore(row.get("Net Income")),
                "operating_profit": FundamentalFetcherService._to_crore(row.get("Operating Income")),
                "eps": FundamentalFetcherService._sanitize_float(row.get("Basic EPS")),
            })

        yearly_rows.sort(key=lambda r: r["year"])
        return yearly_rows

    @staticmethod
    def _extract_quarterly_financials(ticker: yf.Ticker) -> List[Dict[str, Any]]:
        quarterly_rows: List[Dict[str, Any]] = []
        qf = ticker.quarterly_financials
        if qf is None or qf.empty:
            return quarterly_rows

        for date_ts in qf.columns[:4]:
            row = qf[date_ts]
            quarter_label = f"Q{((date_ts.month - 1) // 3) + 1} {date_ts.year}"
            quarterly_rows.append({
                "quarter": quarter_label,
                "revenue": FundamentalFetcherService._to_crore(row.get("Total Revenue")) or 0.0,
                "net_profit": FundamentalFetcherService._to_crore(row.get("Net Income")) or 0.0,
            })

        quarterly_rows.sort(key=lambda r: (int(r["quarter"].split()[1]), int(r["quarter"][1])))
        return quarterly_rows

    @staticmethod
    async def fetch_live_profile(symbol: str) -> Dict[str, Any]:
        """
        Pull a live fundamentals snapshot (best-effort) for a symbol from yfinance.
        """
        symbol_up = symbol.upper()
        yf_symbol = symbol_up if "." in symbol_up else f"{symbol_up}.NS"

        def _blocking_fetch() -> Dict[str, Any]:
            ticker = yf.Ticker(yf_symbol)
            info = ticker.info or {}

            fundamentals = {
                "symbol": symbol_up,
                "current_price": FundamentalFetcherService._sanitize_float(info.get("currentPrice")),
                "daily_change_percent": FundamentalFetcherService._sanitize_float(info.get("regularMarketChangePercent")),
                "high_52w": FundamentalFetcherService._sanitize_float(info.get("fiftyTwoWeekHigh")),
                "low_52w": FundamentalFetcherService._sanitize_float(info.get("fiftyTwoWeekLow")),
                "market_cap": FundamentalFetcherService._to_crore(info.get("marketCap")),
                "pe_ratio": FundamentalFetcherService._sanitize_float(info.get("trailingPE")),
                "book_value": FundamentalFetcherService._sanitize_float(info.get("bookValue")),
                "pb_ratio": FundamentalFetcherService._sanitize_float(info.get("priceToBook")),
                "dividend_yield": FundamentalFetcherService._sanitize_float(info.get("dividendYield"), factor=100),
                "roe": FundamentalFetcherService._sanitize_float(info.get("returnOnEquity"), factor=100),
                # Use ROA-based proxy only when ROCE is not provided by source.
                "roce": FundamentalFetcherService._sanitize_float(info.get("returnOnAssets"), factor=150),
                "face_value": FundamentalFetcherService._sanitize_float(info.get("faceValue")),
                "debt_to_equity": FundamentalFetcherService._sanitize_float(info.get("debtToEquity")),
                "revenue_growth_5y": FundamentalFetcherService._sanitize_float(info.get("revenueGrowth"), factor=100),
                "profit_growth_5y": FundamentalFetcherService._sanitize_float(info.get("earningsGrowth"), factor=100),
                "ebitda_margin": FundamentalFetcherService._sanitize_float(info.get("ebitdaMargins"), factor=100),
                "current_ratio": FundamentalFetcherService._sanitize_float(info.get("currentRatio")),
                "free_cash_flow": FundamentalFetcherService._to_crore(info.get("freeCashflow")),
                "promoter_holding": FundamentalFetcherService._sanitize_float(info.get("heldPercentInsiders"), factor=100),
                "about": info.get("longBusinessSummary"),
                "key_points": {
                    "Market Position": f"{info.get('longName') or symbol_up} operates in {info.get('sector') or 'its sector'}.",
                    "Strategic Focus": info.get("industryDisp") or info.get("industry") or "Focus details unavailable from source data."
                }
            }

            meta = {
                "source": "yfinance",
                "provider_note": "Unofficial Yahoo Finance feed; cross-verify for execution-critical workflows.",
                "fetched_at": datetime.utcnow().isoformat(),
                "exchange": info.get("exchange"),
                "currency": info.get("currency"),
                "nse_symbol": yf_symbol if yf_symbol.endswith(".NS") else None,
                "bse_code": None,
            }

            return {
                "fundamentals": fundamentals,
                "financials": FundamentalFetcherService._extract_yearly_financials(ticker),
                "quarterly_performance": FundamentalFetcherService._extract_quarterly_financials(ticker),
                "meta": meta,
            }

        return await asyncio.to_thread(_blocking_fetch)

    @staticmethod
    async def sync_stock_data(db: AsyncSession, symbols: List[str]):
        """
        Fetch and update fundamental/financial data for a list of symbols.
        """
        for symbol in symbols:
            try:
                logger.info(f"🔄 Fetching data for {symbol}...")
                live_snapshot = await FundamentalFetcherService.fetch_live_profile(symbol)
                info = live_snapshot.get("fundamentals", {})

                if not info:
                    logger.warning(f"⚠️ No info found for {symbol}")
                    continue

                # 1. Update Fundamentals
                await FundamentalFetcherService._upsert_fundamentals(db, symbol, info)
                
                # 2. Update Financials (last 4 years)
                try:
                    await FundamentalFetcherService._upsert_financials(
                        db,
                        symbol,
                        live_snapshot.get("financials", []),
                    )
                except Exception as fin_err:
                    logger.warning(f"⚠️ Could not fetch financials for {symbol}: {fin_err}")
                
                await db.commit()
                logger.info(f"✅ Synced {symbol} fundamentals and financials.")
            except Exception as e:
                logger.error(f"❌ Error syncing {symbol}: {e}")
                await db.rollback()

    @staticmethod
    async def _upsert_fundamentals(db: AsyncSession, symbol: str, info: dict):
        result = await db.execute(select(StockFundamental).filter(StockFundamental.symbol == symbol))
        fundamental = result.scalars().first()
        if not fundamental:
            fundamental = StockFundamental(symbol=symbol)
            db.add(fundamental)

        fundamental.market_cap = info.get('market_cap')
        fundamental.pe_ratio = info.get('pe_ratio')
        fundamental.pb_ratio = info.get('pb_ratio')
        fundamental.dividend_yield = info.get('dividend_yield')
        fundamental.roe = info.get('roe')
        fundamental.roce = info.get('roce')
        fundamental.debt_to_equity = info.get('debt_to_equity')
        fundamental.revenue_growth_5y = info.get('revenue_growth_5y')
        fundamental.profit_growth_5y = info.get('profit_growth_5y')
        fundamental.ebitda_margin = info.get('ebitda_margin')
        fundamental.current_ratio = info.get('current_ratio')
        fundamental.free_cash_flow = info.get('free_cash_flow')
        fundamental.promoter_holding = info.get('promoter_holding')
        fundamental.last_updated = datetime.utcnow()
        
        return fundamental

    @staticmethod
    async def _upsert_financials(db: AsyncSession, symbol: str, yearly_financials: List[Dict[str, Any]]):
        if not yearly_financials:
            return

        for item in yearly_financials:
            year = item.get("year")
            if not year:
                continue
            result = await db.execute(
                select(StockFinancial).where(
                    StockFinancial.symbol == symbol,
                    StockFinancial.year == year
                )
            )
            existing = result.scalars().first()
            if not existing:
                existing = StockFinancial(symbol=symbol, year=year)
                db.add(existing)

            existing.revenue = item.get("revenue") or 0
            existing.net_profit = item.get("net_profit") or 0
            existing.operating_profit = item.get("operating_profit") or 0
            existing.eps = item.get("eps") or 0
