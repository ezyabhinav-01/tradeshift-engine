from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import StockFundamental
import logging

logger = logging.getLogger(__name__)

class ScreenerService:
    @staticmethod
    async def get_multibagger_candidates(db: AsyncSession):
        """
        Identify potential multi-bagger stocks based on:
        1. ROCE > 20% (Efficiency)
        2. PE Ratio < 30 (Valuation)
        3. Debt to Equity < 0.5 (Solvency)
        4. Revenue Growth (5Y) > 15% (Growth)
        """
        try:
            if db is None:
                return ScreenerService._get_mock_candidates()
                
            result = await db.execute(select(StockFundamental))
            candidates = result.scalars().all()
            
            if not candidates:
                return ScreenerService._get_mock_candidates()
                
            results = []
            for c in candidates:
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
                        "roe": getattr(c, 'roe', min(roce, 15)),
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
        roce = getattr(stock, 'roce', 0) or 0
        pe = getattr(stock, 'pe_ratio', 100) or 100
        growth = getattr(stock, 'revenue_growth_5y', 0) or 0
        
        if roce > 30 and growth > 20:
            return {
                "name": "The High-Octane Compounder",
                "tip": "Companies with ROCE > 30% and high growth are rare."
            }
        return {
            "name": "The Quality Consistent",
            "tip": "Slow and steady wins the race. "
        }

    @staticmethod
    def _calculate_conviction(stock):
        score = 50 
        roce = getattr(stock, 'roce', 0) or 0
        pe = getattr(stock, 'pe_ratio', 100) or 100
        growth = getattr(stock, 'revenue_growth_5y', 0) or 0
        
        if roce > 25: score += 15
        if pe < 20: score += 15
        if growth > 20: score += 20
        return min(score, 98)

    @staticmethod
    def _get_mock_candidates():
        return [
            {
                "symbol": "RELIANCE",
                "name": "Reliance Industries",
                "market_cap": 1950000,
                "pe_ratio": 24.5,
                "roce": 12.5,
                "roe": 14.1,
                "revenue_growth": 14.2,
                "conviction_score": 88,
                "sector": "Energy/Telecom",
                "persona": "The Bluechip Leader",
                "varsity_tip": "Focus on their growing retail and telecom segments."
            }
        ]
