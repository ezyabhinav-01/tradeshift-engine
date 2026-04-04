"""
Quick script to create a test user for local development.
Run: python create_test_user.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor

# --- Config ---
TEST_EMAIL = "test@tradeshift.com"
TEST_PASSWORD = "test1234"
TEST_PIN = "1234"
TEST_NAME = "Test Trader"

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL not set in .env")
        return

    # Convert asyncpg URL to psycopg2 format
    url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    
    print(f"🔌 Connecting to: {url[:50]}...")
    
    try:
        conn = psycopg2.connect(url, sslmode="require")
        conn.autocommit = True
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if user already exists
        cur.execute("SELECT id, email, is_verified FROM users WHERE email = %s", (TEST_EMAIL,))
        existing = cur.fetchone()
        
        if existing:
            print(f"⚠️  User already exists: id={existing['id']}, verified={existing['is_verified']}")
            # Update to ensure they're verified with a PIN
            hashed = get_password_hash(TEST_PASSWORD)
            cur.execute("""
                UPDATE users 
                SET hashed_password = %s, security_pin = %s, is_verified = TRUE, 
                    full_name = %s
                WHERE email = %s
            """, (hashed, TEST_PIN, TEST_NAME, TEST_EMAIL))
            print("✅ Updated password, PIN, and verified status.")
        else:
            hashed = get_password_hash(TEST_PASSWORD)
            cur.execute("""
                INSERT INTO users (email, hashed_password, full_name, security_pin, is_verified, demat_id, created_at)
                VALUES (%s, %s, %s, %s, TRUE, %s, NOW())
            """, (TEST_EMAIL, hashed, TEST_NAME, TEST_PIN, "RS-Bull-0001"))
            print("✅ Test user created!")
        
        # Verify
        cur.execute("SELECT id, email, full_name, is_verified, security_pin, demat_id FROM users WHERE email = %s", (TEST_EMAIL,))
        user = cur.fetchone()
        print(f"\n{'='*40}")
        print(f"📧 Email:    {user['email']}")
        print(f"🔑 Password: {TEST_PASSWORD}")
        print(f"🔢 PIN:      {TEST_PIN}")
        print(f"👤 Name:     {user['full_name']}")
        print(f"🆔 Demat ID: {user['demat_id']}")
        print(f"✅ Verified: {user['is_verified']}")
        print(f"{'='*40}")
        print(f"\nUse these credentials to login at the main app!")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        # Try without SSL (local Docker)
        try:
            url_clean = url.replace("?sslmode=require", "")
            conn = psycopg2.connect(url_clean, sslmode="prefer")
            conn.autocommit = True
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            hashed = get_password_hash(TEST_PASSWORD)
            cur.execute("SELECT id FROM users WHERE email = %s", (TEST_EMAIL,))
            existing = cur.fetchone()
            
            if existing:
                cur.execute("""
                    UPDATE users SET hashed_password=%s, security_pin=%s, is_verified=TRUE, full_name=%s
                    WHERE email=%s
                """, (hashed, TEST_PIN, TEST_NAME, TEST_EMAIL))
            else:
                cur.execute("""
                    INSERT INTO users (email, hashed_password, full_name, security_pin, is_verified, demat_id)
                    VALUES (%s, %s, %s, %s, TRUE, %s)
                """, (TEST_EMAIL, hashed, TEST_NAME, TEST_PIN, "RS-Bull-0001"))
            
            print(f"✅ Test user ready (fallback connection)!")
            print(f"📧 Email: {TEST_EMAIL} | 🔑 Password: {TEST_PASSWORD} | 🔢 PIN: {TEST_PIN}")
            
            cur.close()
            conn.close()
        except Exception as e2:
            print(f"❌ Both connections failed: {e2}")

if __name__ == "__main__":
    main()
