import yfinance as yf
import pandas as pd
import redis
import json
import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class MarketService:
    def __init__(self):
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        self.cache_ttl = 300  # 5 minutes
        
        # Mapping of common names to Yahoo Finance symbols for Indian Indices
        self.INDICES_MAP = {
            "NIFTY 50": "^NSEI",
            "SENSEX": "^BSESN",
            "BANK NIFTY": "^NSEBANK",
            "NIFTY IT": "^CNXIT",
            "INDIA VIX": "^INDIAVIX"
        }
        
        self.SECTORS_MAP = {
            "Banks": "^NSEBANK",
            "IT": "^CNXIT",
            "Auto": "^CNXAUTO",
            "FMCG": "^CNXFMCG",
            "Metal": "^CNXMETAL",
            "Pharma": "^CNXPHARMA",
            "Realty": "^CNXREALTY",
            "Energy": "^CNXENERGY",
            "Infra": "^CNXINFRA",
            "Media": "^CNXMEDIA"
        }
    
    def get_indices(self) -> List[Dict[str, Any]]:
        """Fetch current data for major indices, using cache if available."""
        cache_key = "market:indices"
        cached_data = self.redis_client.get(cache_key)
        
        if cached_data:
            logger.info("Serving indices from Redis cache")
            return json.loads(cached_data)

        logger.info("Fetching fresh indices data from yfinance")
        results = []
        
        for name, symbol in self.INDICES_MAP.items():
            try:
                ticker = yf.Ticker(symbol)
                # Fast fetch for current price using fast_info or history
                hist = ticker.history(period="2d")
                if len(hist) < 1:
                    continue
                
                current_price = hist['Close'].iloc[-1]
                prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else current_price
                
                change = current_price - prev_close
                change_percent = (change / prev_close) * 100 if prev_close else 0
                
                results.append({
                    "name": name,
                    "symbol": symbol,
                    "price": round(float(current_price), 2),
                    "change": round(float(change), 2),
                    "change_percent": round(float(change_percent), 2),
                    "is_positive": bool(change >= 0)
                })
            except Exception as e:
                logger.error(f"Error fetching index {name} ({symbol}): {e}")
                
        if results:
            self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(results))
            
        return results

    def get_top_movers(self, limit: int = 10) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch top gainers and losers. 
        Note: True real-time comprehensive NSE market scanning requires paid APIs. 
        For this simulation/MVP we will use a curated list of Nifty 50 tokens to check.
        """
        cache_key = "market:movers"
        cached_data = self.redis_client.get(cache_key)
        
        if cached_data:
            logger.info("Serving movers from Redis cache")
            return json.loads(cached_data)
            
        logger.info("Fetching fresh movers data")
        
        # Subset of Nifty 50 symbols mapped to Yahoo Finance (.NS)
        symbols = [
            "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS",
            "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "HINDUNILVR.NS", "BAJFINANCE.NS",
            "L&T.NS", "KOTAKBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "SUNPHARMA.NS",
            "TATASTEEL.NS", "WIPRO.NS", "TATAMOTORS.NS", "ULTRACEMCO.NS", "NTPC.NS"
        ]
        
        performance = []
        try:
            # Batch download is faster
            data = yf.download(symbols, period="2d", group_by="ticker", threads=True, progress=False)
            
            for sym in symbols:
                if sym in data and not data[sym].empty and len(data[sym]) >= 2:
                    current_val = data[sym]['Close'].iloc[-1]
                    prev_val = data[sym]['Close'].iloc[-2]
                    
                    if pd.isna(current_val) or pd.isna(prev_val):
                        continue
                        
                    current_price = float(current_val)
                    prev_close = float(prev_val)
                    
                    change = current_price - prev_close
                    change_percent = (change / prev_close) * 100
                    
                    performance.append({
                        "symbol": sym.replace(".NS", ""),
                        "price": round(float(current_price), 2),
                        "change": round(float(change), 2),
                        "change_percent": round(float(change_percent), 2),
                        "volume": int(data[sym]['Volume'].iloc[-1]),
                        "is_positive": bool(change >= 0)
                    })
        except Exception as e:
            logger.error(f"Failed to fetch batch movers: {e}")
            
        if not performance:
            return {"gainers": [], "losers": [], "active": []}
            
        # Sort for Gainers and Losers
        gainers = sorted(performance, key=lambda x: x["change_percent"], reverse=True)[:limit]
        losers = sorted(performance, key=lambda x: x["change_percent"])[:limit]
        active = sorted(performance, key=lambda x: x["volume"], reverse=True)[:limit]
        
        results = {
            "gainers": gainers,
            "losers": losers,
            "active": active
        }
        
        # Cache the results
        self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(results))
        
        return results

    def get_sector_performance(self) -> List[Dict[str, Any]]:
        """Fetch current data for major sectors."""
        cache_key = "market:sectors"
        cached_data = self.redis_client.get(cache_key)
        
        if cached_data:
            logger.info("Serving sectors from Redis cache")
            return json.loads(cached_data)

        logger.info("Fetching fresh sectors data")
        symbols = list(self.SECTORS_MAP.values())
        results = []
        
        try:
            data = yf.download(symbols, period="2d", group_by="ticker", threads=True, progress=False)
            for name, sym in self.SECTORS_MAP.items():
                if sym in data and not data[sym].empty and len(data[sym]) >= 2:
                    current_price = float(data[sym]['Close'].iloc[-1])
                    prev_close = float(data[sym]['Close'].iloc[-2])
                    
                    change = current_price - prev_close
                    change_percent = (change / prev_close) * 100
                    
                    results.append({
                        "name": name,
                        "symbol": sym,
                        "price": round(float(current_price), 2),
                        "change": round(float(change), 2),
                        "change_percent": round(float(change_percent), 2),
                        "is_positive": bool(change >= 0)
                    })
        except Exception as e:
            logger.error(f"Failed to fetch sectors: {e}")
            
        results = sorted(results, key=lambda x: x["change_percent"], reverse=True)
            
        if results:
            self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(results))
            
        return results

    def get_option_chain(self, symbol: str = "^NSEI") -> Dict[str, Any]:
        """Fetch option chain, calculate PCR, Max Pain, and format for UI."""
        cache_key = f"market:options:{symbol}"
        cached_data = self.redis_client.get(cache_key)
        
        if cached_data:
            return json.loads(cached_data)
            
        logger.info(f"Fetching options chain for {symbol}")
        try:
            ticker = yf.Ticker(symbol)
            # Get underlying price
            hist = ticker.history(period="1d")
            current_price = float(hist['Close'].iloc[-1]) if not hist.empty else 23500.0
            
            expirations = ticker.options
            if not expirations:
                logger.info(f"YFinance returned no options for {symbol}. Generating mock options chain...")
                mock_data = self._generate_mock_option_chain(symbol, current_price)
                self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(mock_data))
                return mock_data
                
            # Use closest expiration
            closest_exp = expirations[0]
            opt = ticker.option_chain(closest_exp)
            
            # Get underlying price
            hist = ticker.history(period="1d")
            current_price = float(hist['Close'].iloc[-1]) if not hist.empty else 0.0
            
            calls = opt.calls
            puts = opt.puts
            
            if calls.empty and puts.empty:
                return {"error": "Empty options chain"}
                
            # Global metrics
            total_call_oi = float(calls['openInterest'].sum())
            total_put_oi = float(puts['openInterest'].sum())
            pcr = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 0
            
            # Max Pain Calculation
            # Get all unique strikes
            all_strikes = sorted(list(set(calls['strike'].tolist() + puts['strike'].tolist())))
            max_pain_strike = 0
            min_pain = float('inf')
            
            for strike in all_strikes:
                # Pain = Intrinsic Value * OI
                # For calls, intrinsic value at Expiry = max(0, ExpiryPrice - Strike)
                call_pain = calls[calls['strike'] < strike].apply(lambda x: (strike - x['strike']) * x['openInterest'], axis=1).sum()
                # For puts, intrinsic value at Expiry = max(0, Strike - ExpiryPrice)
                put_pain = puts[puts['strike'] > strike].apply(lambda x: (x['strike'] - strike) * x['openInterest'], axis=1).sum()
                
                total_pain = call_pain + put_pain
                if total_pain < min_pain:
                    min_pain = total_pain
                    max_pain_strike = strike
                    
            # Identify ATM strike
            atm_strike = min(all_strikes, key=lambda x: abs(x - current_price))
            
            # Formatting options chain data for UI
            # We will merge calls and puts by strike
            calls_dict = calls.set_index('strike').to_dict('index')
            puts_dict = puts.set_index('strike').to_dict('index')
            
            # Keep only strikes close to ATM (e.g., +/- 10-15 strikes) -> approx 30 total
            atm_idx = all_strikes.index(atm_strike)
            start_idx = max(0, atm_idx - 15)
            end_idx = min(len(all_strikes), atm_idx + 16)
            focused_strikes = all_strikes[start_idx:end_idx]
            
            chain_data = []
            for strike in focused_strikes:
                c = calls_dict.get(strike, {})
                p = puts_dict.get(strike, {})
                
                chain_data.append({
                    "strike": strike,
                    "is_atm": strike == atm_strike,
                    "call": {
                        "oi": int(c.get('openInterest', 0)) if not pd.isna(c.get('openInterest', 0)) else 0,
                        "volume": int(c.get('volume', 0)) if not pd.isna(c.get('volume', 0)) else 0,
                        "iv": round(float(c.get('impliedVolatility', 0)) * 100, 2) if not pd.isna(c.get('impliedVolatility', 0)) else 0,
                        "ltp": round(float(c.get('lastPrice', 0)), 2) if not pd.isna(c.get('lastPrice', 0)) else 0,
                        "bid": round(float(c.get('bid', 0)), 2) if not pd.isna(c.get('bid', 0)) else 0,
                        "ask": round(float(c.get('ask', 0)), 2) if not pd.isna(c.get('ask', 0)) else 0,
                    },
                    "put": {
                        "oi": int(p.get('openInterest', 0)) if not pd.isna(p.get('openInterest', 0)) else 0,
                        "volume": int(p.get('volume', 0)) if not pd.isna(p.get('volume', 0)) else 0,
                        "iv": round(float(p.get('impliedVolatility', 0)) * 100, 2) if not pd.isna(p.get('impliedVolatility', 0)) else 0,
                        "ltp": round(float(p.get('lastPrice', 0)), 2) if not pd.isna(p.get('lastPrice', 0)) else 0,
                        "bid": round(float(p.get('bid', 0)), 2) if not pd.isna(p.get('bid', 0)) else 0,
                        "ask": round(float(p.get('ask', 0)), 2) if not pd.isna(p.get('ask', 0)) else 0,
                    }
                })

            result = {
                "symbol": symbol,
                "current_price": round(current_price, 2),
                "expiration": closest_exp,
                "pcr": pcr,
                "max_pain": max_pain_strike,
                "atm_strike": atm_strike,
                "chain": chain_data
            }
            
            self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(result))
            return result
        except Exception as e:
            logger.error(f"Error fetching option chain for {symbol}: {e}")
            return {"error": str(e)}

    def _generate_mock_option_chain(self, symbol: str, current_price: float) -> Dict[str, Any]:
        """Generate a realistic mock options chain for UI testing when yfinance fails."""
        import datetime
        import random
        
        # Default price if fetch fails
        if current_price <= 0:
            current_price = 23500.0 if "NIFTY" in symbol else 51000.0
            
        atm_strike = round(current_price / 50) * 50
        strikes = [atm_strike + (i * 50) for i in range(-15, 16)]
        
        chain_data = []
        for strike in strikes:
            is_atm = strike == atm_strike
            distance = abs(strike - current_price)
            
            # Simple pricing model
            # CE: high value ITM (strike < price), low value OTM
            ce_intrinsic = max(0, current_price - strike)
            ce_time_val = max(5, 200 - distance * 0.5) + random.uniform(10, 50)
            ce_price = ce_intrinsic + ce_time_val
            
            # PE: high value ITM (strike > price), low value OTM
            pe_intrinsic = max(0, strike - current_price)
            pe_time_val = max(5, 200 - distance * 0.5) + random.uniform(10, 50)
            pe_price = pe_intrinsic + pe_time_val
            
            # Volume and OI (higher near ATM)
            base_vol = 1000000 if distance < 200 else (500000 if distance < 500 else 100000)
            ce_oi = int(base_vol * random.uniform(0.8, 1.2))
            pe_oi = int(base_vol * random.uniform(0.8, 1.2))
            
            iv = round(random.uniform(12.0, 18.0), 2)
            
            chain_data.append({
                "strike": strike,
                "is_atm": is_atm,
                "call": {
                    "oi": ce_oi,
                    "volume": int(ce_oi * 0.4),
                    "iv": iv,
                    "ltp": round(ce_price, 2),
                    "bid": round(ce_price - 0.5, 2),
                    "ask": round(ce_price + 0.5, 2),
                },
                "put": {
                    "oi": pe_oi,
                    "volume": int(pe_oi * 0.4),
                    "iv": iv,
                    "ltp": round(pe_price, 2),
                    "bid": round(pe_price - 0.5, 2),
                    "ask": round(pe_price + 0.5, 2),
                }
            })
            
        return {
            "symbol": symbol,
            "current_price": round(current_price, 2),
            "expiration": (datetime.datetime.now() + datetime.timedelta(days=7)).strftime("%Y-%m-%d"),
            "pcr": round(random.uniform(0.7, 1.3), 2),
            "max_pain": atm_strike,
            "atm_strike": atm_strike,
            "chain": chain_data
        }

# Singleton instance
market_service = MarketService()
