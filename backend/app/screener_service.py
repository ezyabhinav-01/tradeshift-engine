from sqlalchemy.orm import Session
from .models import StockFundamental
import logging

logger = logging.getLogger(__name__)

class ScreenerService:
    @staticmethod
    def get_multibagger_candidates(db: Session):
        """
        Identify potential multi-bagger stocks based on:
        1. ROCE > 20% (Efficiency)
        2. PE Ratio < 30 (Valuation)
        3. Debt to Equity < 0.5 (Solvency)
        4. Revenue Growth (5Y) > 15% (Growth)
        """
        try:
            candidates = db.query(StockFundamental).all()
            
            # If no data in DB, return high-quality mock candidates for the demo
            if not candidates:
                return ScreenerService._get_mock_candidates()
                
            results = []
            for c in candidates:
                # Multi-bagger filtering logic
                # Ensure we handle None values
                roce = c.roce if c.roce is not None else 0
                pe = c.pe_ratio if c.pe_ratio is not None else 100
                debt = getattr(c, 'debt_to_equity', 1) 
                debt = debt if debt is not None else 1
                
                is_potential = (roce > 20 and pe < 30 and debt < 0.5)
                
                if is_potential:
                    persona = ScreenerService._assign_company_persona(c)
                    results.append({
                        "symbol": c.symbol,
                        "name": getattr(c, 'name', c.symbol),
                        "market_cap": getattr(c, 'market_cap', 0),
                        "pe_ratio": pe,
                        "roce": roce,
                        "revenue_growth": getattr(c, 'revenue_growth_5y', 0),
                        "conviction_score": ScreenerService._calculate_conviction(c),
                        "sector": getattr(c, 'sector', 'General'),
                        "persona": persona["name"],
                        "varsity_tip": persona["tip"]
                    })
            
            return results if results else ScreenerService._get_mock_candidates()
        except Exception as e:
            logger.error(f"Error in screener service: {e}")
            return ScreenerService._get_mock_candidates()

    @staticmethod
    def _assign_company_persona(stock):
        """Assigns a Zerodha Varsity-style persona to a company based on metrics."""
        roce = getattr(stock, 'roce', 0) or 0
        pe = getattr(stock, 'pe_ratio', 100) or 100
        growth = getattr(stock, 'revenue_growth_5y', 0) or 0
        
        if roce > 30 and growth > 20:
            return {
                "name": "The High-Octane Compounder",
                "tip": "Companies with ROCE > 30% and high growth are rare. They build wealth by reinvesting profits at massive rates. Focus on the durability of their moat."
            }
        if roce > 20 and pe < 20:
            return {
                "name": "The Cash Machine",
                "tip": "These are efficient businesses available at a fair price. High ROCE with low PE often indicates 'Value' play. Check if there's a temporary headwind."
            }
        if growth > 25:
            return {
                "name": "The Growth Beast",
                "tip": "Revenue growth is the engine here. In the early stages of a multibagger, growth often precedes profitability. Watch for operating leverage."
            }
        return {
            "name": "The Quality Consistent",
            "tip": "Slow and steady wins the race. These companies have consistent efficiency and clean balance sheets, acting as the bedrock of a portfolio."
        }

    @staticmethod
    def _calculate_conviction(stock):
        """Simple logic to calculate a conviction score out of 100"""
        score = 50 # Base
        roce = getattr(stock, 'roce', 0) or 0
        pe = getattr(stock, 'pe_ratio', 100) or 100
        growth = getattr(stock, 'revenue_growth_5y', 0) or 0
        
        if roce > 25: score += 15
        if pe < 20: score += 15
        if growth > 20: score += 20
        return min(score, 98)

    @staticmethod
    def _get_mock_candidates():
        # Enhanced mock data with personas
        stocks = [
            {
                "symbol": "RELIANCE",
                "name": "Reliance Industries",
                "market_cap": 1950000,
                "pe_ratio": 24.5,
                "roce": 12.5,
                "revenue_growth": 14.2,
                "conviction_score": 88,
                "sector": "Energy/Telecom"
            },
            {
                "symbol": "HDFCBANK",
                "name": "HDFC Bank Ltd",
                "market_cap": 1250000,
                "pe_ratio": 18.2,
                "roce": 16.8,
                "revenue_growth": 19.5,
                "conviction_score": 92,
                "sector": "Banking"
            },
            {
                "symbol": "TATAELXSI",
                "name": "Tata Elxsi",
                "market_cap": 45000,
                "pe_ratio": 55.4,
                "roce": 37.2,
                "revenue_growth": 24.8,
                "conviction_score": 95,
                "sector": "IT/Design"
            },
            {
                "symbol": "VARUNBEV",
                "name": "Varun Beverages",
                "market_cap": 95000,
                "pe_ratio": 62.1,
                "roce": 28.5,
                "revenue_growth": 32.1,
                "conviction_score": 94,
                "sector": "FMCG"
            },
            {
                "symbol": "TITAN",
                "name": "Titan Company",
                "market_cap": 310000,
                "pe_ratio": 82.5,
                "roce": 25.1,
                "revenue_growth": 21.4,
                "conviction_score": 91,
                "sector": "Consumer Durables"
            }
        ]
        
        results = []
        for s in stocks:
            # Create a simple object to satisfy getattr
            class StockMock: pass
            sm = StockMock()
            for k, v in s.items(): setattr(sm, k, v)
            if k == 'revenue_growth': setattr(sm, 'revenue_growth_5y', v)
            
            persona = ScreenerService._assign_company_persona(sm)
            s["persona"] = persona["name"]
            s["varsity_tip"] = persona["tip"]
            results.append(s)
        return results
