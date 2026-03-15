from sqlalchemy.orm import Session
from .models import StockFundamental, StockFinancial
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class FundamentalService:
    @staticmethod
    def get_stock_profile(db: Session, symbol: str):
        """
        Fetch the fundamental profile and yearly financials for a stock.
        Returns mock data if no data exists in DB.
        """
        if db is None:
            logger.info(f"📁 Backend disconnected. Serving mock profile for {symbol}")
            return FundamentalService._get_mock_data(symbol)
            
        fundamental = db.query(StockFundamental).filter(StockFundamental.symbol == symbol).first()
        financials = db.query(StockFinancial).filter(StockFinancial.symbol == symbol).order_by(StockFinancial.year.desc()).all()

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
        # Specific mock for NIFTY/RELIANCE for best demo experience
        is_reliance = "RELIANCE" in symbol.upper()
        
        mock_fundamentals = {
            "symbol": symbol,
            "market_cap": 1900000.0 if is_reliance else 500000.0,
            "pe_ratio": 28.5 if is_reliance else 22.0,
            "pb_ratio": 2.4,
            "dividend_yield": 0.8,
            "roe": 12.5,
            "roce": 14.2,
            "debt_to_equity": 0.35,
            "revenue_growth_5y": 15.2,
            "profit_growth_5y": 18.5,
            "ebitda_margin": 18.0,
            "current_ratio": 1.2,
            "free_cash_flow": 25000.0,
            "promoter_holding": 50.6
        }

        current_year = datetime.now().year
        mock_financials = []
        for i in range(5):
            year = current_year - i
            growth_factor = (1.1 ** (4-i)) # Simple growth simulation
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
    def update_fundamentals(db: Session, symbol: str, data: dict):
        """
        Update or create fundamental record.
        """
        fundamental = db.query(StockFundamental).filter(StockFundamental.symbol == symbol).first()
        if not fundamental:
            fundamental = StockFundamental(symbol=symbol)
            db.add(fundamental)
        
        for key, value in data.items():
            if hasattr(fundamental, key):
                setattr(fundamental, key, value)
        
        db.commit()
        db.refresh(fundamental)
        return fundamental
