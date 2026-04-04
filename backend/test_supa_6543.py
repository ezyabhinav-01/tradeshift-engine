import psycopg2
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Trying port 6543 - can sometimes bypass firewall blocks on 5432
# Also trying with connect_timeout=10
DSN = "postgresql://postgres.zwyhprwertclmefaoida:RiteshDheeraj@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

print(f"Connecting to port 6543: {DSN[:50]}...")

try:
    conn = psycopg2.connect(DSN, sslmode="require", connect_timeout=10)
    print("✅ Connected to port 6543!")
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    print(f"✅ Query Result: {cur.fetchone()}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"❌ Connection to 6543 failed: {e}")
