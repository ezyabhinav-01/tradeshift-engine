import os
import re
import chromadb
from typing import List, Dict, Tuple, Optional, Any
import asyncio

try:
    from config import config
    from generator import generate_response
    from navigation_map import get_learn_navigation_hint
    from app.utils.gemini_pool import gemini_pool
except ImportError:
    from .config import config
    from .generator import generate_response
    from .navigation_map import get_learn_navigation_hint
    from app.utils.gemini_pool import gemini_pool

class TradeGuideBot:
    def __init__(self):
        self.system_prompt = (
            "You are TradeGuide, a friendly and professional AI Trading Mentor for the Tradeshift Engine. "
            "Your goal is to educate users, foster curiosity, and guide them through the world of trading. "
            "\n\nPERSONA GUIDELINES:"
            "\n1. BE ENCOURAGING: Use a supportive, world-class mentor tone. Avoid being overly robotic."
            "\n2. FOSTER CURIOSITY: After answering a question, ask a strategic follow-up question that makes the user want to learn more."
            "\n3. BE EDUCATIONAL: Explain complex terms simply. Use analogies where helpful."
            "\n4. NAVIGATIONAL GUIDANCE: If you discuss a technical indicator or concept that is covered in our Academy (see SYSTEM NAVIGATION HINT), "
            "you MUST invite the user to explore it deeply. Use the format: 'Would you like to explore this concept in our Academy? [OPEN_LEARN: Topic Name]'"
            "\n\nCRITICAL CONSTRAINTS:"
            "\n- NEVER predict future prices. NEVER recommend specific buy/sell/hold actions."
            "\n- If KNOWLEDGE BASE CONTEXT is provided, prioritize it."
            "\n- Keep responses engaging but concise enough for a chat interface."
        )
        base_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(base_dir, config.vector_db_path.lstrip("./"))
        
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(name="trade_knowledge")
        
        print("TradeGuideBot: Using Gemini Cloud Embeddings (text-embedding-004)...")
        # No local embedder needed anymore.
        
    def _is_safe(self, text: str) -> bool:
        """
        Regex-based safety enforcement. 
        Detects any dangerous vocabulary predicting prices or encouraging trades.
        """
        restricted_patterns = [
            r"(?i)\bshould i (buy|sell|hold|short|invest)\b",
            r"(?i)\byou should (buy|sell|hold|short|invest)\b",
            r"(?i)\b(will|is).* (go up|go down|increase|decrease|rise|fall|skyrocket|crash)\b",
            r"(?i)\bi recommend (buying|selling|holding)\b",
            r"(?i)\bmy prediction is\b",
            r"(?i)\b(buy|sell) signal\b",
            r"(?i)\bguaranteed returns\b"
        ]
        
        for pattern in restricted_patterns:
            if re.search(pattern, text):
                return False
        return True
        
    def _extract_navigation_tags(self, text: str) -> Tuple[str, List[Dict[str, str]]]:
        """
        Searches for embedded triggers (e.g. [OPEN_LEARN: macd]) inside the LLM reply.
        Extracts them for the React App to utilize and removes them from user reading pane.
        """
        actions = []
        tag_pattern = r"\[OPEN_LEARN:\s*([^\]]+)\]"
        matches = re.finditer(tag_pattern, text)
        for match in matches:
            topic = match.group(1).strip()
            actions.append({"type": "OPEN_LEARN", "payload": topic})
            
        clean_text = re.sub(tag_pattern, "", text).strip()
        return clean_text, actions

    def _fallback_response(self, user_query: str) -> str:
        query = user_query.lower()

        if "macd" in query:
            return (
                "MACD stands for Moving Average Convergence Divergence. It compares a faster and a slower moving "
                "average to show momentum shifts; when the fast line crosses above the signal line, momentum is "
                "strengthening, and when it crosses below, momentum is weakening. It works best when you combine it "
                "with price structure instead of using it alone."
            )
        if "rsi" in query:
            return (
                "RSI measures the speed of recent price moves on a 0 to 100 scale. Readings above 70 usually suggest "
                "price is stretched upward, while readings below 30 suggest it may be stretched downward, but trend "
                "context still matters."
            )
        if "replay" in query:
            return (
                "Replay mode lets you simulate the market candle by candle so you can practice entries, exits, and "
                "risk management without using live capital. Pick a symbol and date, start the replay, then place "
                "trades as if the session were live."
            )
        if "screener" in query or "multibagger" in query:
            return (
                "The Screener page highlights fundamentally strong candidates using metrics like ROCE, growth, and "
                "valuation sanity. Opening a stock from there takes you into the Research Hub, where the AI thesis "
                "and follow-up explanation tools break down the business in more detail."
            )

        return (
            "TradeGuide is available, but the cloud model is under pressure right now. I can still help with platform "
            "navigation, indicator basics, replay mode, and research workflows if you ask a specific question."
        )

    async def _retrieve_context(self, query: str, top_k: int = 2) -> Tuple[str, List[Dict[str, str]]]:
        try:
            embeddings = await gemini_pool.get_embeddings_async([query])
            query_embedding = embeddings[0]

            results = self.collection.query(
                query_embeddings=query_embedding,
                n_results=top_k
            )

            docs = results.get('documents', [[]])[0]
            metas = results.get('metadatas', [[]])[0]
            distances = results.get('distances', [[]])[0]

            valid_docs = []
            valid_metas = []
            for doc, meta, dist in zip(docs, metas, distances):
                if dist < 1.25:
                    valid_docs.append(doc)
                    valid_metas.append(meta)

            if not valid_docs:
                return None, []

            context_str = "KNOWLEDGE BASE CONTEXT:\n"
            sources = []
            for doc, meta in zip(valid_docs, valid_metas):
                context_str += f"- [{meta.get('title', 'Source')}]: {doc}\n"
                sources.append({"title": meta.get('title', 'Source'), "url": meta.get('url', '')})

            return context_str + "\n", sources
        except Exception as e:
            print(f"[TradeGuideBot] Context retrieval unavailable, continuing without RAG: {e}")
            return None, []

    async def get_response(self, user_query: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        # 0. Pre-flight Safety Check
        if not self._is_safe(user_query):
            return {
                "response": "I cannot provide personalized trading advice, stock predictions, or buy/sell recommendations. My purpose is strictly educational. Please consult a licensed financial advisor.",
                "actions": [],
                "sources": []
            }
            
        history_list = history if history is not None else []
        
        # 1. RAG Retrieve
        context_str, sources = await self._retrieve_context(user_query)
        
        if context_str is None:
             context_str = "No specific local context found. Answer purely using your global knowledge base."
        
        # 2. Get Navigation Hints for the Learn page
        nav_hint = get_learn_navigation_hint(user_query)
        
        # 3. Build massive system prompt pushing bounds
        augmented_prompt = f"{self.system_prompt}\n\n{context_str}\n{nav_hint}\nUser Question: {user_query}"
        print(f"[TradeGuideBot] Prompting Gemini with context length {len(context_str)}...")
        
        # 3. Request LLM Inference
        raw_response = await generate_response(augmented_prompt, history_list[-5:])
        if raw_response:
            print(f"[TradeGuideBot] Received response of length {len(raw_response)}")
        else:
            print(f"[TradeGuideBot] Error: Empty response from generator")

        if not raw_response or "network latency reaching the Gemini API" in raw_response:
            raw_response = self._fallback_response(user_query)
        
        # 4. Post-flight Filter hallucinated trading advice
        if not self._is_safe(raw_response):
            safe_response = "I cannot provide personalized trading advice, stock predictions, or buy/sell recommendations. My purpose is strictly educational. Please consult a licensed financial advisor."
        else:
            safe_response = raw_response
        
        # 5. Clean layout actions
        clean_response, actions = self._extract_navigation_tags(safe_response)
        
        return {
            "response": clean_response,
            "actions": actions,
            "sources": sources
        }

# Global Singleton instance so the embedded models aren't unnecessarily reloaded
bot_instance = None

def get_bot():
    global bot_instance
    if bot_instance is None:
        bot_instance = TradeGuideBot()
    return bot_instance
