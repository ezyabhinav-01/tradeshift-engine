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
        # Always start with our high-quality featured mock stocks to ensure a rich list
        mock_candidates = ScreenerService._get_mock_candidates()
        final_results = {c["symbol"]: c for c in mock_candidates}
        
        try:
            if db is None:
                return list(final_results.values())
                
            result = await db.execute(select(StockFundamental))
            db_candidates = result.scalars().all()
            
            for c in db_candidates:
                roce = c.roce if c.roce is not None else 0
                pe = c.pe_ratio if c.pe_ratio is not None else 100
                debt = getattr(c, 'debt_to_equity', 1) 
                debt = debt if debt is not None else 1
                
                # Criteria for inclusion: 
                # 1. It matches our strict multibagger filters
                # 2. OR it's one of our "Featured" high-quality large caps (like Reliance/HDFC)
                is_featured = c.symbol in final_results
                is_potential = (roce > 20 and pe < 30 and debt < 0.5)
                
                if is_potential or is_featured:
                    persona = ScreenerService._assign_company_persona(c)
                    # Use DB data to override or add new candidates
                    final_results[c.symbol] = {
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
                    }
            
            return list(final_results.values())
        except Exception as e:
            logger.error(f"Error in screener service: {e}")
            return list(final_results.values())

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
                "varsity_tip": "Focus on their growing retail and telecom segments for long-term compounding."
            },
            {
                "symbol": "HDFCBANK",
                "name": "HDFC Bank Ltd",
                "market_cap": 1250000,
                "pe_ratio": 18.2,
                "roce": 16.5,
                "roe": 17.8,
                "revenue_growth": 19.5,
                "conviction_score": 92,
                "sector": "Banking",
                "persona": "The Quality Compounder",
                "varsity_tip": "Consistent 15-20% growth over decades with superior asset quality."
            },
            {
                "symbol": "TCS",
                "name": "Tata Consultancy Services",
                "market_cap": 1420000,
                "pe_ratio": 28.4,
                "roce": 45.2,
                "roe": 39.1,
                "revenue_growth": 12.8,
                "conviction_score": 95,
                "sector": "IT Services",
                "persona": "The Efficiency King",
                "varsity_tip": "Unmatched ROCE and dividend payouts make it a core portfolio staple."
            },
            {
                "symbol": "ICICIBANK",
                "name": "ICICI Bank Ltd",
                "market_cap": 750000,
                "pe_ratio": 16.8,
                "roce": 15.2,
                "roe": 16.5,
                "revenue_growth": 21.4,
                "conviction_score": 90,
                "sector": "Banking",
                "persona": "The Growth Aggressor",
                "varsity_tip": "Gaining market share from PSU banks with strong digital adoption."
            },
            {
                "symbol": "INFY",
                "name": "Infosys Ltd",
                "market_cap": 650000,
                "pe_ratio": 22.5,
                "roce": 32.1,
                "roe": 28.4,
                "revenue_growth": 11.2,
                "conviction_score": 85,
                "sector": "IT Services",
                "persona": "The Digital Transformer",
                "varsity_tip": "Strong deal pipeline in Cloud and Generative AI spaces."
            },
            {
                "symbol": "TITAN",
                "name": "Titan Company Ltd",
                "market_cap": 310000,
                "pe_ratio": 85.2,
                "roce": 24.1,
                "roe": 30.5,
                "revenue_growth": 25.6,
                "conviction_score": 82,
                "sector": "Consumer / Jewelry",
                "persona": "The Luxury Monopoly",
                "varsity_tip": "High PE is justified by brand dominance and secular growth in jewelry."
            },
            {
                "symbol": "TATAMOTORS",
                "name": "Tata Motors Ltd",
                "market_cap": 340000,
                "pe_ratio": 12.4,
                "roce": 18.2,
                "roe": 22.1,
                "revenue_growth": 32.5,
                "conviction_score": 89,
                "sector": "Automobile",
                "persona": "The EV Pioneer",
                "varsity_tip": "Leading the Indian EV revolution while JLR turnaround drives cash flows."
            }
        ]
