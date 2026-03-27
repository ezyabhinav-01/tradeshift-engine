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
        symbol_up = symbol.upper()
        
        # High quality data for major large caps
        stock_db = {
            "RELIANCE": {
                "name": "Reliance Industries Limited",
                "price": 2854.50, "high": 3024.90, "low": 2220.30, "mcap": 1925000.0,
                "pe": 26.5, "book": 1150.25, "roe": 14.1, "roce": 12.5, "dy": 0.8,
                "about": "Reliance Industries is India's largest private sector corporation with interests in petrochemicals, refining, oil & gas, retail, and digital services."
            },
            "HDFCBANK": {
                "name": "HDFC Bank Limited",
                "price": 1450.75, "high": 1757.50, "low": 1363.50, "mcap": 1100000.0,
                "pe": 18.2, "book": 512.20, "roe": 17.8, "roce": 16.5, "dy": 1.4,
                "about": "HDFC Bank is India's largest private sector bank by assets and has a consistent track record of superior asset quality and growth."
            },
            "TCS": {
                "name": "Tata Consultancy Services Ltd",
                "price": 4120.30, "high": 4254.75, "low": 3070.30, "mcap": 1485000.0,
                "pe": 28.4, "book": 285.50, "roe": 39.1, "roce": 45.2, "dy": 1.25,
                "about": "TCS is a global leader in IT services, consulting, and business solutions with a large network of innovation and delivery centers."
            },
            "ICICIBANK": {
                "name": "ICICI Bank Limited",
                "price": 1085.20, "high": 1120.00, "low": 840.50, "mcap": 760000.0,
                "pe": 16.8, "book": 320.15, "roe": 16.5, "roce": 15.2, "dy": 0.85,
                "about": "ICICI Bank is a leading private sector bank in India offering a wide range of banking products and financial services to corporate and retail customers."
            },
            "INFY": {
                "name": "Infosys Limited",
                "price": 1612.45, "high": 1733.00, "low": 1215.10, "mcap": 668000.0,
                "pe": 22.5, "book": 185.20, "roe": 28.4, "roce": 32.1, "dy": 2.1,
                "about": "Infosys is a global leader in next-generation digital services and consulting, enabling clients across more than 50 countries."
            }
        }
        
        selected_data = stock_db.get(symbol_up, {
            "name": f"{symbol} Limited",
            "price": 100.0, "high": 120.0, "low": 80.0, "mcap": 10000.0,
            "pe": 15.0, "book": 40.0, "roe": 10.0, "roce": 12.0, "dy": 1.0,
            "about": f"{symbol} is a listed company on the NSE/BSE involved in multiple business verticals."
        })

        # Ensure numeric values for calculations
        price = float(selected_data["price"])
        book = float(selected_data["book"])
        mcap = float(selected_data["mcap"])

        mock_fundamentals = {
            "symbol": symbol_up,
            "current_price": price,
            "high_52w": float(selected_data["high"]),
            "low_52w": float(selected_data["low"]),
            "market_cap": mcap,
            "pe_ratio": float(selected_data["pe"]),
            "book_value": book,
            "pb_ratio": round(price / (book if book != 0 else 1.0), 2),
            "dividend_yield": float(selected_data["dy"]),
            "roe": float(selected_data["roe"]),
            "roce": float(selected_data["roce"]),
            "face_value": 1.0 if "BANK" in symbol_up or "INFY" in symbol_up or "TCS" in symbol_up else 10.0,
            "debt_to_equity": 0.05 if "BANK" in symbol_up else 0.45,
            "revenue_growth_5y": 18.2 if "INFY" in symbol_up or "TCS" in symbol_up else 14.5,
            "profit_growth_5y": 21.4,
            "ebitda_margin": 24.5 if "INFY" in symbol_up or "TCS" in symbol_up else 16.0,
            "current_ratio": 1.1 if "BANK" in symbol_up else 2.5,
            "free_cash_flow": mcap * 0.05,
            "promoter_holding": 0.0 if "BANK" in symbol_up or "ICICI" in symbol_up else 45.2,
            "about": selected_data["about"],
            "key_points": {
                "Market Position": f"{selected_data['name']} is a systemically important leader in its sector.",
                "Strategic Focus": "The management is focusing on margin expansion and return of capital through dividends/buybacks."
            }
        }

        current_year = datetime.now().year
        mock_financials = []
        base_revenue = mcap * 0.2
        for i in range(5):
            year = current_year - i
            growth_factor = float(0.9 ** i) # Reverse growth to go back in time
            mock_financials.append({
                "year": year,
                "revenue": round(base_revenue * growth_factor, 2),
                "net_profit": round(base_revenue * 0.15 * growth_factor, 2),
                "operating_profit": round(base_revenue * 0.2 * growth_factor, 2),
                "eps": round((base_revenue * 0.15 * growth_factor) / 1000.0, 2)
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
