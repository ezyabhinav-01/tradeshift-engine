import os
import json
import asyncio
import aiohttp
import google.generativeai as genai
from dotenv import load_dotenv

# Ensure environment variables are loaded from .env
load_dotenv()

# API Keys
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY", None)

from .utils.gemini_pool import gemini_pool

# Models
MODEL_ID = "HuggingFaceH4/zephyr-7b-beta" 
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "14"))
HF_TIMEOUT_SECONDS = float(os.getenv("HF_TIMEOUT_SECONDS", "12"))


def _extract_response_text(response) -> str:
    text = getattr(response, "text", None)
    if text:
        return text.strip()
    try:
        candidates = getattr(response, "candidates", None) or []
        parts_text = []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            parts = getattr(content, "parts", None) or []
            for part in parts:
                value = getattr(part, "text", None)
                if value:
                    parts_text.append(value)
        return "\n".join(parts_text).strip()
    except Exception:
        return ""


async def _generate_with_timeout(prompt: str, model_name: str = None, timeout: float = LLM_TIMEOUT_SECONDS) -> str:
    kwargs = {"is_async": True}
    if model_name:
        kwargs["model_name"] = model_name
    response = await asyncio.wait_for(gemini_pool.generate_content(prompt, **kwargs), timeout=timeout)
    return _extract_response_text(response)

def _heuristic_stock_analysis(symbol: str, fund_data: dict) -> str:
    roce = float(fund_data.get("roce", 0) or 0)
    roe = float(fund_data.get("roe", 0) or 0)
    pe = float(fund_data.get("pe_ratio", 0) or 0)
    growth = float(fund_data.get("revenue_growth_5y", 0) or 0)
    debt = float(fund_data.get("debt_to_equity", 0) or 0)

    quality = "strong" if roce >= 18 and roe >= 15 else "mixed"
    valuation = "reasonable" if pe and pe <= 25 else "demanding"
    balance_sheet = "clean" if debt <= 0.5 else "leveraged"

    return f"""### THE INSTITUTIONAL THESIS
{symbol} currently screens as a {quality} business on capital efficiency, with ROCE at {roce:.1f}% and ROE at {roe:.1f}%. Revenue growth around {growth:.1f}% suggests the company still has operating momentum, while a P/E of {pe:.1f}x points to a {valuation} valuation setup.

### BULL VS BEAR
Bull case: the business appears operationally resilient and the balance sheet looks {balance_sheet}, which gives management room to keep compounding. Bear case: if growth slows, the present valuation can compress quickly and investors may reassess how much premium they should pay for each rupee of earnings.

### VARSITY LESSON: ROCE
ROCE tells you how efficiently a company turns invested capital into operating profit. Think of it like judging a shopkeeper not by how big the shop looks, but by how much profit they squeeze out of every Rs100 locked inside the business. Higher ROCE usually means the engine is working harder with the same fuel."""

def _heuristic_news_explanation(news_title: str, news_desc: str, user_level: str) -> str:
    level = user_level or "Beginner"
    return f"""Hello {level} Trader! Let's break this down simply.

### THE ESSENCE
{news_title}

This headline tells us that policymakers or market participants chose stability over a sudden change. In simple terms, the financial system got a signal that the current money environment is staying broadly the same for now.

### THE WHY
When rates or policy stay unchanged, investors focus less on shock and more on guidance. That usually helps markets reprice expectations around borrowing costs, company earnings, and overall risk appetite in a calmer way.

### THE IMPACT
Stocks often react based on whether this outcome was expected. If the market already priced it in, the reaction may be small; if investors expected something different, sectors like banks, technology, and rate-sensitive businesses can move more sharply.

### THE TAKEAWAY
Use this kind of news to watch sentiment, not just the headline. The most important follow-up is how bond yields, the index, and sector leaders react after the announcement."""


def _heuristic_stock_chat(symbol: str, fund_data: dict, question: str) -> str:
    q = (question or "").lower()
    roce = float(fund_data.get("roce", 0) or 0)
    roe = float(fund_data.get("roe", 0) or 0)
    pe = float(fund_data.get("pe_ratio", 0) or 0)
    debt = float(fund_data.get("debt_to_equity", 0) or 0)
    growth = float(fund_data.get("revenue_growth_5y", 0) or 0)

    if "roce" in q:
        return (
            f"ROCE for {symbol} is around {roce:.1f}%. ROCE tells you how efficiently the business turns capital into profit. "
            f"As a quick rule, higher and stable ROCE usually indicates better business quality."
        )
    if "roe" in q:
        return (
            f"ROE for {symbol} is around {roe:.1f}%. ROE measures how efficiently shareholder money is used to generate earnings. "
            f"A stronger ROE often means better profitability, but it should be checked with debt levels too."
        )
    if "pe" in q or "p/e" in q or "valuation" in q:
        return (
            f"{symbol} is trading near {pe:.1f}x P/E. P/E is what investors pay for each unit of earnings. "
            f"Higher P/E implies stronger growth expectations, while lower P/E can mean either undervaluation or weaker outlook."
        )
    if "debt" in q:
        return (
            f"Debt-to-equity for {symbol} is about {debt:.2f}. Lower debt usually gives a company more resilience in difficult cycles. "
            f"Always compare this with sector averages before drawing conclusions."
        )
    if "growth" in q:
        return (
            f"5-year revenue growth for {symbol} is around {growth:.1f}%. Consistent growth with healthy margins is more reliable than one-off spikes. "
            f"Track whether growth quality is improving quarter by quarter."
        )

    return (
        f"For {symbol}, a quick framework is: quality (ROCE {roce:.1f}%, ROE {roe:.1f}%), valuation (P/E {pe:.1f}x), "
        f"risk (debt-to-equity {debt:.2f}), and growth ({growth:.1f}% 5Y revenue growth). Ask me one of these and I’ll break it down simply."
    )

async def _call_hf_inference(messages: list) -> str:
    """
    Calls the HuggingFace Router via OpenAI-compatible Chat Completion API.
    This is the recommended and most reliable way to call models on the router.
    """
    url = "https://router.huggingface.co/v1/chat/completions"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}
    payload = {
        "model": MODEL_ID,
        "messages": messages,
        "max_tokens": 300,
        "temperature": 0.3
    }
    
    timeout = aiohttp.ClientTimeout(total=HF_TIMEOUT_SECONDS, connect=4, sock_read=8)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data["choices"][0]["message"]["content"].strip()
            else:
                error_text = await resp.text()
                raise Exception(f"HF Router Error {resp.status}: {error_text}")

def is_market_relevant(title: str, description: str, symbol: str) -> bool:
    """
    Checks if a news article is likely relevant to the stock market or the specific symbol.
    Filters out general news, sports, local politics, or entertainment.
    """
    if not title:
        return False
        
    # Keywords indicating financial/market relevance
    market_keywords = [
        "stock", "market", "trade", "profit", "loss", "revenue", "earnings", 
        "dividend", "ipo", "shares", "invest", "finance", "economy", "bank", 
        "fed", "interest rate", "inflation", "gdp", "quarterly", "acquisition", 
        "merger", "ceo", "guidance", "bull", "bear", "rally", "slump",
        "nifty", "sensex", "nse", "bse", "rbi", "sebi", "fii", "dii", "it raid",
        "gst", "ltcg", "stcg", "monetary policy", "repo rate"
    ]
    
    # Generic news categories to exclude
    noise_keywords = [
        "sports", "football", "cricket", "bollywood", "hollywood", "recipe", 
        "entertainment", "lifestyle", "horoscope", "weather report"
    ]
    
    text = (title + " " + (description or "")).lower()
    
    base_symbol = symbol.split('-')[0].lower()
    if base_symbol in text:
        return True
        
    has_market_term = any(kw in text for kw in market_keywords)
    is_noise = any(nk in text for nk in noise_keywords)
    
    return has_market_term and not is_noise

async def analyze_news_impact(news_title: str, news_desc: str, symbol: str) -> dict:
    """
    Sends the news article to an AI engine (Gemini primary, HF fallback) to get a financial impact analysis.
    """
    print(f"🧠 FinGPT (Gemini) analyzing news for {symbol}: '{news_title}'")
    
    analysis_prompt = f"""
    Analyze the potential impact of this news on the asset '{symbol}'.
    
    Headline: {news_title}
    Details: {news_desc}
    
    Provide:
    1. A sharp, 2-sentence market analysis of WHY this matters for the price.
    2. Sentiment: [POSITIVE, NEGATIVE, or NEUTRAL].
    3. Predicted Impact: Follow the format 'Predicted Impact: [X]% in [Time]' (e.g. +0.8% in 15m).
    """

    try:
        if gemini_pool.keys:
            output = await _generate_with_timeout(analysis_prompt)
        else:
            # Fallback to HF if Gemini is not configured
            messages = [
                {"role": "system", "content": "You are a professional quantitative financial analyst (FinGPT)."},
                {"role": "user", "content": analysis_prompt}
            ]
            output = await _call_hf_inference(messages)
        
        # Parse output for Sentiment
        sentiment = "NEUTRAL"
        if "POSITIVE" in output.upper():
            sentiment = "POSITIVE"
        elif "NEGATIVE" in output.upper():
            sentiment = "NEGATIVE"
            
        # Parse output for Predicted Impact
        predicted_impact = "Unknown"
        lines = output.split('\n')
        for line in lines:
            if "Predicted Impact:" in line:
                predicted_impact = line.split("Predicted Impact:")[1].strip()
                break
        
        if predicted_impact == "Unknown":
            import re
            match = re.search(r'([+-]?\d+\.?\d*%\s+in\s+\d+[mh])', output)
            if match:
                predicted_impact = match.group(1)

        # Clean analysis text
        analysis_text = output
        for st in ["POSITIVE", "NEGATIVE", "NEUTRAL"]:
            analysis_text = analysis_text.replace(st, "")
        if "Predicted Impact:" in analysis_text:
            analysis_text = analysis_text.split("Predicted Impact:")[0]
        
        analysis_text = analysis_text.replace("[", "").replace("]", "").replace("Sentiment:", "").strip()
        
        return {
            "analysis": analysis_text,
            "sentiment": sentiment,
            "predicted_impact": predicted_impact
        }
        
    except Exception as e:
        print(f"❌ FinGPT Analysis Error: {e}")
        return {
            "analysis": f"FinGPT Error: {str(e)}. Please check your API configuration.",
            "sentiment": "NEUTRAL",
            "predicted_impact": "N/A"
        }

async def ask_news_question(news_title: str, news_desc: str, question: str, symbol: str) -> str:
    """
    Provides a deep, high-quality answer to a user's question about a specific news item.
    """
    print(f"💬 Asking FinGPT (Gemini): '{question}' for news '{news_title}'")
    
    qa_prompt = f"""
    A trader saw this news for '{symbol}':
    Headline: {news_title}
    Details: {news_desc}
    
    Question: {question}
    
    Explain the implications deeply but concisely (Max 4 sentences). Focus on order flow, market psychology, and potential pivot points.
    """

    try:
        if gemini_pool.keys:
            return await _generate_with_timeout(qa_prompt)
        else:
            messages = [
                {"role": "system", "content": "You are an expert financial consultant."},
                {"role": "user", "content": qa_prompt}
            ]
            return await _call_hf_inference(messages)
    except Exception as e:
        print(f"❌ FinGPT Q&A Error: {e}")
        return f"FinGPT Error: {str(e)}. Please try again later."

async def analyze_stock_fundamentals(symbol: str, fund_data: dict) -> str:
    """
    Performs a deep institutional-grade fundamental analysis of a stock.
    Persona: Senior Hedge Fund Manager & Strategic Growth Analyst.
    Vibe: Zerodha Varsity (Educational & Deep).
    """
    print(f"🧐 FinGPT performing Deep Analysis for {symbol}...")
    
    prompt = f"""
    Perform a professional-grade fundamental analysis for '{symbol}' using these metrics:
    {fund_data}
    
    Format your response identically to this structure:
    ### THE INSTITUTIONAL THESIS
    (Professional analysis of Earnings Quality, Capital Efficiency, and Moat)
    
    ### BULL VS BEAR
    (Concise case for both sides)
    
    ### VARSITY LESSON: [Topic]
    (Pick one complex metric from the data, e.g., ROCE or Debt-to-Equity, and explain it beautifully for a beginner. 
    Explain why this specific company's number is good or bad using a simple real-world analogy. 
    Make the user feel like they just learned a core investing principle.)
    
    Keep the tone professional yet encouraging. Max 400 words.
    """

    try:
        if gemini_pool.keys:
            try:
                result = await _generate_with_timeout(
                    prompt,
                    model_name="models/gemini-2.0-flash-lite-001",
                )
                return result
            except Exception as e:
                print(f"Gemini unavailable: {e}. Falling back to HuggingFace...")
                pass # Fall through to HF
                
        messages = [
            {"role": "system", "content": "You are a Senior Portfolio Manager and world-class financial educator (FinGPT)."},
            {"role": "user", "content": prompt}
        ]
        return await _call_hf_inference(messages)
    except Exception as e:
        print(f"❌ Stock Analysis Error: {e}")
        return _heuristic_stock_analysis(symbol, fund_data)

async def explain_in_layman(symbol: str, complex_info: str) -> str:
    """
    Converts professional financial analysis or jargon into simple layman analogies.
    Vibe: "Zerodha Varsity for Kids".
    """
    print(f"🐣 Simplifying concepts for {symbol} (Layman Mode)...")
    
    prompt = f"""
    The following is a professional analysis for '{symbol}':
    {complex_info}
    
    Task: Explain the core essence of this business and its health to a total beginner. 
    1. What does this company actually do in simple words?
    2. Why is it a 'Multibagger' candidate? Use a story-like analogy (e.g. 'This company is like a chef who knows how to make 10 cakes from just 1 bag of flour...').
    3. One 'Golden Rule' of investing to remember from this stock.
    
    Avoid ALL jargon. Focus on the 'Core Value' of the business. (Max 200 words).
    """

    try:
        if gemini_pool.keys:
            output = await _generate_with_timeout(prompt)
            if output:
                return output
            raise Exception("Empty response")
        else:
            messages = [
                {"role": "system", "content": "You are a world-class financial educator who simplifies complex ideas."},
                {"role": "user", "content": prompt}
            ]
            return await _call_hf_inference(messages)
    except Exception as e:
        print(f"❌ Layman Explanation Error: {e}")
        return (
            f"{symbol} looks like a business where the key question is whether it can keep profits growing "
            f"without taking too much debt. In simple terms, think of it like a shop that must grow sales while "
            f"keeping costs and borrowing under control. Golden rule: great companies are those that compound "
            f"earnings with discipline, not just hype."
        )

async def chat_about_stock(symbol: str, fund_data: dict, question: str, chat_history: list) -> str:
    """
    Answers specific user questions about a stock's fundamentals.
    """
    print(f"💬 Equity Chat for {symbol}: '{question}'")
    
    # Format history
    history_str = ""
    for msg in chat_history[-6:]: # Keep last 6 msgs
        role_label = "Student" if msg["role"] == "user" else "Varsity Educator"
        history_str += f"{role_label}: {msg['content']}\n"

    prompt = f"""
    You are a 'Zerodha Varsity' style financial educator helping a beginner understand {symbol}.
    
    Here is the fundamental data for {symbol}:
    {fund_data}
    
    Recent Chat History:
    {history_str}
    
    Current Student Question: {question}
    
    Provide a clear, educational, and jargon-free answer based specifically on the fundamental data provided. 
    Use a relatable analogy if explaining a complex metric. Keep it to max 3-4 sentences.
    """

    try:
        if gemini_pool.keys:
            try:
                result = await _generate_with_timeout(prompt)
                if result:
                    return result
                raise Exception("Empty response")
            except Exception as e:
                print(f"Gemini unavailable: {e}. Falling back to HuggingFace...")
                pass
                
        messages = [{"role": "system", "content": "You are a financial educator."}]
        for msg in chat_history[-6:]:
            messages.append({"role": "user" if msg["role"] == "user" else "assistant", "content": msg["content"]})
        messages.append({"role": "user", "content": prompt})
        return await _call_hf_inference(messages)
    except Exception as e:
        print(f"❌ Equity Chat Error: {e}")
        return _heuristic_stock_chat(symbol, fund_data, question)
async def generate_news_explainer(news_title: str, news_desc: str, symbol: str) -> dict:
    """
    Generates a beginner-friendly, educational breakdown of a news event.
    Returns: { essence, analogy, golden_rule }
    """
    print(f"📖 FinGPT (Gemini) generating News Explainer for {symbol}: '{news_title}'")
    
    explainer_prompt = f"""
    You are a world-class financial educator (Zerodha Varsity style). 
    Help a beginner understand the core meaning of this news for '{symbol}'.
    
    Headline: {news_title}
    Details: {news_desc}
    
    Provide the explanation in this JSON format (strictly):
    {{
        "essence": "What this news actually means for the business/market in 2 simple sentences.",
        "analogy": "A brilliant real-world analogy to explain the market reaction.",
        "golden_rule": "One universal principle of investing to learn from this specific event."
    }}
    
    Avoid jargon. Use clear, encouraging language.
    """

    try:
        if gemini_pool.keys:
            output = await _generate_with_timeout(explainer_prompt)
            
            # Basic JSON extraction if Gemini adds markdown markers
            if "```json" in output:
                output = output.split("```json")[1].split("```")[0].strip()
            elif "```" in output:
                output = output.split("```")[1].split("```")[0].strip()
                
            data = json.loads(output)
            return {
                "essence": data.get("essence", "Explanation pending..."),
                "analogy": data.get("analogy", "Looking for a good analogy..."),
                "golden_rule": data.get("golden_rule", "The rule is simple: stay informed.")
            }
        else:
            # Fallback to HF for explainer
            messages = [
                {"role": "system", "content": "You are a world-class financial educator."},
                {"role": "user", "content": explainer_prompt}
            ]
            output = await _call_hf_inference(messages)
            # Rough parsing for HF if it doesn't return clean JSON
            return {
                "essence": output[:200] + "...",
                "analogy": "Analogy coming soon.",
                "golden_rule": "Stay disciplined."
            }
            
    except Exception as e:
        print(f"❌ News Explainer Error: {e}")
        return {
            "essence": f"We're having trouble simplifying this right now. {str(e)}",
            "analogy": "Imagine a library where the books are rearranged.",
            "golden_rule": "Knowledge is the greatest hedge."
        }
async def generate_news_explanation(news_title: str, news_desc: str, user_level: str = "Beginner") -> str:
    """
    Generates a professional, educational explanation for any news article.
    Used by the main News page and AI Explainer modal.
    """
    print(f"🧐 FinGPT (Gemini) explaining news: '{news_title}' for {user_level} level")
    
    prompt = f"""
    Explain this financial news article for a {user_level} trader.
    Headline: {news_title}
    Details: {news_desc}
    
    Format your response in simple, educational terms (like Zerodha Varsity). 
    Break it down into 3-4 concise points:
    1. THE ESSENCE: What happened in 1 sentence?
    2. THE WHY: Why is this important for the markets?
    3. THE IMPACT: Potential reaction in specific sectors or assets.
    
    Keep the tone professional yet encouraging. Max 250 words.
    """

    try:
        if gemini_pool.keys:
            output = await _generate_with_timeout(prompt)
            if output:
                return output
            raise Exception("Empty response")
        else:
            # Fallback to HF
            messages = [
                {"role": "system", "content": "You are a world-class financial educator."},
                {"role": "user", "content": prompt}
            ]
            return await _call_hf_inference(messages)
            
    except Exception as e:
        print(f"❌ News Explanation Error: {e}")
        return _heuristic_news_explanation(news_title, news_desc, user_level)
