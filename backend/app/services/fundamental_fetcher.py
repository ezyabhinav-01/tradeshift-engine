import yfinance as yf
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import StockFundamental, StockFinancial
import logging
from datetime import datetime
from typing import List
import pandas as pd

logger = logging.getLogger(__name__)

class FundamentalFetcherService:
    @staticmethod
    async def sync_stock_data(db: AsyncSession, symbols: List[str]):
        """
        Fetch and update fundamental/financial data for a list of symbols.
        """
        for symbol in symbols:
            try:
                # Add .NS for NSE if missing
                yf_symbol = f"{symbol}.NS" if "." not in symbol else symbol
                logger.info(f"🔄 Fetching data for {yf_symbol}...")
                
                ticker = yf.Ticker(yf_symbol)
                info = ticker.info
                
                if not info or 'symbol' not in info and 'currentPrice' not in info:
                    logger.warning(f"⚠️ No info found for {yf_symbol}")
                    continue

                # 1. Update Fundamentals
                await FundamentalFetcherService._upsert_fundamentals(db, symbol, info)
                
                # 2. Update Financials (last 4 years)
                try:
                    await FundamentalFetcherService._upsert_financials(db, symbol, ticker)
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
        
        # Map and sanitize floats (yfinance often returns NaN or None)
        def s(val, factor=1, default=0):
            if val is None or pd.isna(val): return default
            return round(float(val) * factor, 2)

        fundamental.current_price = s(info.get('currentPrice'))
        fundamental.high_52w = s(info.get('fiftyTwoWeekHigh'))
        fundamental.low_52w = s(info.get('fiftyTwoWeekLow'))
        fundamental.market_cap = s(info.get('marketCap'))
        fundamental.pe_ratio = s(info.get('trailingPE'))
        fundamental.pb_ratio = s(info.get('priceToBook'))
        fundamental.dividend_yield = s(info.get('dividendYield'), 100)
        fundamental.roe = s(info.get('returnOnEquity'), 100)
        
        # ROCE Approximation
        fundamental.roce = s(info.get('returnOnAssets'), 150) # Proxy: ROA * 1.5
        
        fundamental.debt_to_equity = s(info.get('debtToEquity'))
        fundamental.revenue_growth_5y = s(info.get('revenueGrowth'), 100)
        fundamental.profit_growth_5y = s(info.get('earningsGrowth'), 100)
        fundamental.ebitda_margin = s(info.get('ebitdaMargins'), 100)
        fundamental.current_ratio = s(info.get('currentRatio'))
        fundamental.free_cash_flow = s(info.get('freeCashflow'))
        fundamental.promoter_holding = s(info.get('heldPercentInsiders'), 100)
        
        fundamental.about = info.get('longBusinessSummary') or "No profile description available."
        fundamental.last_updated = datetime.utcnow()
        
        return fundamental

    @staticmethod
    async def _upsert_financials(db: AsyncSession, symbol: str, ticker: yf.Ticker):
        financials = ticker.financials # DataFrame
        if financials is None or financials.empty:
            return
            
        # financials columns are Timestamps
        for date_ts, row in financials.items():
            year = date_ts.year
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
            
            # Use label-based indexing to be safe across yfinance versions
            existing.revenue = row.get('Total Revenue')
            existing.net_profit = row.get('Net Income')
            existing.operating_profit = row.get('Operating Income')
            existing.eps = row.get('Basic EPS')
            
            # Sanitize NaNs
            if pd.isna(existing.revenue): existing.revenue = 0
            if pd.isna(existing.net_profit): existing.net_profit = 0
            if pd.isna(existing.operating_profit): existing.operating_profit = 0
            if pd.isna(existing.eps): existing.eps = 0
