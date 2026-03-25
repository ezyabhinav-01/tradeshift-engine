from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import StockFundamental, StockFinancial
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class FundamentalService:
    @staticmethod
    async def get_stock_profile(db: AsyncSession, symbol: str):
        """
        Fetch the fundamental profile and yearly financials for a stock.
        Returns mock data if no data exists in DB.
        """
        if db is None:
            logger.info(f"📁 Backend disconnected. Serving mock profile for {symbol}")
            return FundamentalService._get_mock_data(symbol)
            
        result_f = await db.execute(select(StockFundamental).filter(StockFundamental.symbol == symbol))
        fundamental = result_f.scalars().first()
        
        result_fin = await db.execute(select(StockFinancial).filter(StockFinancial.symbol == symbol).order_by(StockFinancial.year.desc()))
        financials = result_fin.scalars().all()

        if not fundamental:
            logger.info(f"🔍 No DB data for {symbol}. Serving high-quality mock candidates.")
            return FundamentalService._get_mock_data(symbol)

        logger.info(f"✅ Serving live DB profile for {symbol}")
        return {
            "fundamentals": fundamental,
            "financials": financials
        }

    @staticmethod
    def _get_mock_data(symbol: str):
        """
        Generate premium-quality mock data for major stocks to demonstrate the Research Hub.
        """
        is_reliance = "RELIANCE" in symbol.upper()
        
        mock_fundamentals = {
            "symbol": symbol,
            "current_price": 2854.50 if is_reliance else 1450.75,
            "high_52w": 3024.90 if is_reliance else 1650.00,
            "low_52w": 2220.30 if is_reliance else 980.50,
            "market_cap": 1900000.0 if is_reliance else 500000.0,
            "pe_ratio": 28.5 if is_reliance else 22.0,
            "book_value": 1150.25 if is_reliance else 364.00,
            "pb_ratio": 2.4,
            "dividend_yield": 0.8 if is_reliance else 1.41,
            "roe": 12.5 if is_reliance else 14.4,
            "roce": 14.2 if is_reliance else 7.51,
            "face_value": 10.0 if is_reliance else 1.0,
            "debt_to_equity": 0.35,
            "revenue_growth_5y": 15.2,
            "profit_growth_5y": 18.5,
            "ebitda_margin": 18.0,
            "current_ratio": 1.2,
            "free_cash_flow": 25000.0,
            "promoter_holding": 50.6,
            "about": f"{symbol} Limited is a leading Indian conglomerate headquartered in Mumbai...",
            "key_points": {
                "Market Position": f"The company is highly systemically important...",
                "Revenue Mix Q3 FY26": "Core Operations: 55%\nDigital Services: 25%\nRetail/Consumer: 15%\nOthers: 5%"
            }
        }

        current_year = datetime.now().year
        mock_financials = []
        for i in range(5):
            year = current_year - i
            growth_factor = (1.1 ** (4-i)) 
            mock_financials.append({
                "year": year,
                "revenue": round(100000 * growth_factor, 2),
                "net_profit": round(15000 * growth_factor, 2),
                "operating_profit": round(20000 * growth_factor, 2),
                "eps": round(45.5 * growth_factor, 2)
            })
            
        return {
            "fundamentals": mock_fundamentals,
            "financials": mock_financials,
            "is_mock": True
        }

    @staticmethod
    async def update_fundamentals(db: AsyncSession, symbol: str, data: dict):
        """
        Update or create fundamental record.
        """
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
