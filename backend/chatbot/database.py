import sqlite3
import os
from datetime import datetime
from typing import Optional

# Absolute path resolution guarantees the DB lives next to the model components
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analytics.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            user_message TEXT NOT NULL,
            bot_response TEXT NOT NULL,
            rating TEXT,
            feedback_notes TEXT
        )
    ''')
    conn.commit()
    conn.close()

def log_conversation(session_id: str, user_msg: str, bot_response: str):
    """
    Called after every LLM generation to passively track the query.
    Used for analytics and to build training datasets later.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    timestamp = datetime.utcnow().isoformat()
    cursor.execute('''
        INSERT INTO interactions (session_id, timestamp, user_message, bot_response)
        VALUES (?, ?, ?, ?)
    ''', (session_id, timestamp, user_msg, bot_response))
    
    conn.commit()
    conn.close()

def update_feedback(session_id: str, rating: str, feedback_notes: Optional[str] = None):
    """
    RLHF explicit feedback.
    Applies the upvote/downvote directly to the most recent query in that exact session.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE interactions 
        SET rating = ?, feedback_notes = ? 
        WHERE id = (
            SELECT id FROM interactions 
            WHERE session_id = ? 
            ORDER BY timestamp DESC LIMIT 1
        )
    ''', (rating, feedback_notes, session_id))
    
    conn.commit()
    conn.close()

# Auto-execute schema build on first boot
init_db()
