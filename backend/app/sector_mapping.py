"""
Sector Mapping Engine for NSE Stocks.
Maps stock symbols to GICS-aligned Indian market sectors.
Provides sector allocation calculations and concentration risk analysis.
"""

from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

# ─── NSE Symbol → Sector Mapping ────────────────────────────────────
# Covers Nifty 50 + popular mid-caps. Uses `.NS` suffix (Yahoo Finance convention).
SECTOR_MAP: Dict[str, str] = {
    # Banking & Financial Services
    "HDFCBANK.NS": "Banking", "ICICIBANK.NS": "Banking", "SBIN.NS": "Banking",
    "KOTAKBANK.NS": "Banking", "AXISBANK.NS": "Banking", "INDUSINDBK.NS": "Banking",
    "BANKBARODA.NS": "Banking", "PNB.NS": "Banking", "IDFCFIRSTB.NS": "Banking",
    "BAJFINANCE.NS": "Financial Services", "BAJAJFINSV.NS": "Financial Services",
    "HDFCLIFE.NS": "Financial Services", "SBILIFE.NS": "Financial Services",
    "ICICIGI.NS": "Financial Services", "MUTHOOTFIN.NS": "Financial Services",
    "CHOLAFIN.NS": "Financial Services",

    # Information Technology
    "TCS.NS": "IT", "INFY.NS": "IT", "WIPRO.NS": "IT", "HCLTECH.NS": "IT",
    "TECHM.NS": "IT", "LTIM.NS": "IT", "PERSISTENT.NS": "IT", "COFORGE.NS": "IT",
    "MPHASIS.NS": "IT",

    # FMCG
    "HINDUNILVR.NS": "FMCG", "ITC.NS": "FMCG", "NESTLEIND.NS": "FMCG",
    "BRITANNIA.NS": "FMCG", "DABUR.NS": "FMCG", "MARICO.NS": "FMCG",
    "COLPAL.NS": "FMCG", "GODREJCP.NS": "FMCG", "TATACONSUM.NS": "FMCG",

    # Automobile
    "TATAMOTORS.NS": "Automobile", "MARUTI.NS": "Automobile", "M&M.NS": "Automobile",
    "BAJAJ-AUTO.NS": "Automobile", "HEROMOTOCO.NS": "Automobile", "EICHERMOT.NS": "Automobile",
    "ASHOKLEY.NS": "Automobile", "TVSMOTOR.NS": "Automobile",

    # Pharma & Healthcare
    "SUNPHARMA.NS": "Pharma", "DRREDDY.NS": "Pharma", "CIPLA.NS": "Pharma",
    "DIVISLAB.NS": "Pharma", "APOLLOHOSP.NS": "Pharma", "LUPIN.NS": "Pharma",
    "BIOCON.NS": "Pharma", "AUROPHARMA.NS": "Pharma",

    # Energy & Oil
    "RELIANCE.NS": "Energy", "ONGC.NS": "Energy", "BPCL.NS": "Energy",
    "IOC.NS": "Energy", "NTPC.NS": "Energy", "POWERGRID.NS": "Energy",
    "ADANIGREEN.NS": "Energy", "TATAPOWER.NS": "Energy", "COALINDIA.NS": "Energy",

    # Metals & Mining
    "TATASTEEL.NS": "Metals", "JSWSTEEL.NS": "Metals", "HINDALCO.NS": "Metals",
    "VEDL.NS": "Metals", "NMDC.NS": "Metals",

    # Infrastructure & Cement
    "ULTRACEMCO.NS": "Infrastructure", "GRASIM.NS": "Infrastructure",
    "ADANIENT.NS": "Infrastructure", "LT.NS": "Infrastructure",
    "SHREECEM.NS": "Infrastructure", "ACC.NS": "Infrastructure",

    # Telecom & Media
    "BHARTIARTL.NS": "Telecom", "IDEA.NS": "Telecom",

    # Consumer & Retail
    "TITAN.NS": "Consumer", "DMART.NS": "Consumer", "ZOMATO.NS": "Consumer",
    "NYKAA.NS": "Consumer", "TRENT.NS": "Consumer", "PAGEIND.NS": "Consumer",

    # Chemicals
    "PIDILITIND.NS": "Chemicals", "SRF.NS": "Chemicals", "DEEPAKNTR.NS": "Chemicals",
}

# Sector color palette for frontend charts
SECTOR_COLORS: Dict[str, str] = {
    "Banking": "#3b82f6",
    "Financial Services": "#6366f1",
    "IT": "#10b981",
    "FMCG": "#f59e0b",
    "Automobile": "#ef4444",
    "Pharma": "#8b5cf6",
    "Energy": "#f97316",
    "Metals": "#64748b",
    "Infrastructure": "#06b6d4",
    "Telecom": "#ec4899",
    "Consumer": "#14b8a6",
    "Chemicals": "#84cc16",
    "Other": "#6b7280",
}


def get_sector(symbol: str) -> str:
    """Get the sector for a given NSE symbol."""
    if not symbol:
        return "Other"
    
    # Try exact match
    if symbol in SECTOR_MAP:
        return SECTOR_MAP[symbol]
    
    # Try without suffix
    clean_sym = symbol.replace(".NS", "")
    if clean_sym in SECTOR_MAP:
        return SECTOR_MAP[clean_sym]
    
    # Try adding suffix
    suffixed_sym = f"{clean_sym}.NS"
    if suffixed_sym in SECTOR_MAP:
        return SECTOR_MAP[suffixed_sym]
        
    return "Other"


def get_sector_allocation(holdings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Calculate sector-level allocation from a list of holdings.
    Each holding must have 'symbol' and 'current_value' keys.
    Returns sorted list of sectors with value, percentage, color, and constituent stocks.
    """
    sector_data: Dict[str, Dict] = {}
    total_value = sum(h.get("current_value", 0) for h in holdings)

    if total_value <= 0:
        return []

    for h in holdings:
        sector = get_sector(h["symbol"])
        if sector not in sector_data:
            sector_data[sector] = {
                "sector": sector,
                "value": 0,
                "stocks": [],
                "color": SECTOR_COLORS.get(sector, "#6b7280"),
            }
        sector_data[sector]["value"] += h.get("current_value", 0)
        sector_data[sector]["stocks"].append({
            "symbol": h["symbol"],
            "value": round(h.get("current_value", 0), 2),
            "weight": round(h.get("current_value", 0) / total_value * 100, 2),
        })

    result = []
    for s in sector_data.values():
        s["percent"] = round(s["value"] / total_value * 100, 2)
        s["value"] = round(s["value"], 2)
        result.append(s)

    return sorted(result, key=lambda x: x["value"], reverse=True)


def get_concentration_risks(
    allocation: List[Dict[str, Any]],
    holdings: List[Dict[str, Any]],
    sector_threshold: float = 40.0,
    stock_threshold: float = 25.0,
) -> List[Dict[str, Any]]:
    """
    Analyze concentration risk.
    Flags:
      - Any single sector > sector_threshold%
      - Any single stock > stock_threshold% of total portfolio
    Returns a list of risk alerts with severity and recommendation.
    """
    alerts: List[Dict[str, Any]] = []
    total_value = sum(h.get("current_value", 0) for h in holdings)

    if total_value <= 0:
        return alerts

    # Sector concentration
    for sector in allocation:
        if sector["percent"] > sector_threshold:
            alerts.append({
                "type": "sector_concentration",
                "severity": "high" if sector["percent"] > 60 else "medium",
                "title": f"High {sector['sector']} Exposure",
                "description": f"{sector['sector']} represents {sector['percent']}% of your portfolio. Consider diversifying into other sectors.",
                "metric": f"{sector['percent']}%",
                "threshold": f"{sector_threshold}%",
            })

    # Single stock concentration
    for h in holdings:
        weight = (h.get("current_value", 0) / total_value) * 100
        if weight > stock_threshold:
            alerts.append({
                "type": "stock_concentration",
                "severity": "high" if weight > 40 else "medium",
                "title": f"{h['symbol']} Overweight",
                "description": f"{h['symbol']} is {weight:.1f}% of your portfolio. A single stock above {stock_threshold}% increases idiosyncratic risk.",
                "metric": f"{weight:.1f}%",
                "threshold": f"{stock_threshold}%",
            })

    # Diversification score
    num_sectors = len(allocation)
    if num_sectors <= 2:
        alerts.append({
            "type": "low_diversification",
            "severity": "medium",
            "title": "Limited Sector Diversification",
            "description": f"Your portfolio spans only {num_sectors} sector(s). Aim for at least 4-5 sectors for better risk distribution.",
            "metric": f"{num_sectors} sectors",
            "threshold": "4+ sectors",
        })

    return alerts
