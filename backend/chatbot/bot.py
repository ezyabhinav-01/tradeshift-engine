import os
import re
import chromadb
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Tuple, Optional, Any

try:
    from config import config
    from generator import generate_response
    from navigation_map import get_learn_navigation_hint
except ImportError:
    from .config import config
    from .generator import generate_response
    from .navigation_map import get_learn_navigation_hint

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
        
        print("TradeGuideBot: Loading query embedder (sentence-transformers/all-MiniLM-L6-v2)...")
        # Embedding text string inputs efficiently so ChromaDB can match the math vectors
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        
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

    def _retrieve_context(self, query: str, top_k: int = 2) -> Tuple[str, List[Dict[str, str]]]:
        # Encode user query
        query_embedding = self.embedder.encode([query]).tolist()
        
        # Search the database for nearest k neighbors (Cosine similarity via typical Chroma defaults)
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=top_k
        )
        
        docs = results.get('documents', [[]])[0]
        metas = results.get('metadatas', [[]])[0]
        distances = results.get('distances', [[]])[0]
        
        valid_docs = []
        valid_metas = []
        # Filter out vectors with poor semantic similarity (L2 > 1.25)
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

    def get_response(self, user_query: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        # 0. Pre-flight Safety Check
        if not self._is_safe(user_query):
            return {
                "response": "I cannot provide personalized trading advice, stock predictions, or buy/sell recommendations. My purpose is strictly educational. Please consult a licensed financial advisor.",
                "actions": [],
                "sources": []
            }
            
        history_list = history if history is not None else []
        
        # 1. RAG Retrieve
        context_str, sources = self._retrieve_context(user_query)
        
        if context_str is None:
             context_str = "No specific local context found. Answer purely using your global knowledge base."
        
        # 2. Get Navigation Hints for the Learn page
        nav_hint = get_learn_navigation_hint(user_query)
        
        # 3. Build massive system prompt pushing bounds
        augmented_prompt = f"{self.system_prompt}\n\n{context_str}\n{nav_hint}\nUser Question: {user_query}"
        print(f"[TradeGuideBot] Prompting Gemini with context length {len(context_str)}...")
        
        # 3. Request LLM Inference
        raw_response = generate_response(augmented_prompt, history_list[-5:])
        if raw_response:
            print(f"[TradeGuideBot] Received response of length {len(raw_response)}")
        else:
            print(f"[TradeGuideBot] Error: Empty response from generator")
        
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
