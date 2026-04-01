import os
import json
import time
from typing import Dict, List, Optional
from pathlib import Path

# Static fallbacks for core concepts
CORE_CONCEPTS_FALLBACK = {
    "macd": "Market Mechanics",
    "rsi": "Market Mechanics",
    "moving average": "Market Mechanics",
    "bollinger bands": "Market Mechanics",
    "candlestick": "Market Mechanics",
    "support": "Market Mechanics",
    "resistance": "Market Mechanics",
}

CACHE_FILE = Path(__file__).resolve().parent / "data" / "navigation_cache.json"

def loader_dynamic_map():
    """
    Loads moving parts from the navigation_cache.json if available.
    """
    if not CACHE_FILE.exists():
        return {}
    
    try:
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Error loading navigation cache: {e}")
        return {}

def get_learn_navigation_hint(text: str) -> str:
    """
    Analyzes text for trading concepts and returns a system hint for the chatbot
    to include navigation tags if a relevant topic is mentioned.
    Now uses a dynamic cache that is periodically updated by a heartbeat sync.
    """
    text = text.lower()
    dynamic_map = loader_dynamic_map()
    
    # Combined map of static and dynamic (dynamic overrides static if same name)
    # We combine them for broader coverage
    full_map = {**CORE_CONCEPTS_FALLBACK, **dynamic_map.get("concepts", {})}
    db_topics = dynamic_map.get("db_topics", {})
    
    matches = []
    
    # 1. Match against known concepts
    for concept, target in full_map.items():
        if concept in text:
            # We want to use the Title casing for the tag
            matches.append(target)
            
    # 2. Match against direct DB topic names (mostly for "maneo", "money", etc.)
    for topic_name in db_topics.keys():
        if topic_name in text:
            matches.append(topic_name.title())
            
    if not matches:
        return ""
        
    unique_matches = list(set(matches))[:3] # Limit to top 3 suggestions
    
    hint = "\n[SYSTEM NAVIGATION HINT]: The following topics from our Academy are highly relevant to the current discussion. "
    hint += "If you discuss them, consider inviting the user to explore them deeply using the [OPEN_LEARN: Topic Name] tag.\n"
    for m in unique_matches:
        hint += f"- {m}\n"
        
    return hint

def update_navigation_cache(concepts: Dict[str, str], db_topics: Dict[str, str]):
    """
    Called by the hourly Heartbeat (Inngest) to update the JSON cache.
    """
    os.makedirs(CACHE_FILE.parent, exist_ok=True)
    data = {
        "last_updated": time.time(),
        "concepts": concepts,
        "db_topics": db_topics
    }
    with open(CACHE_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"✅ Navigation cache updated at {CACHE_FILE}")
