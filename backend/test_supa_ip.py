import psycopg2
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Trying one of the resolved IPv4 addresses directly
IP_ADDRESS = "3.109.171.244" # From previous resolved IPs
DSN = f"postgresql://postgres.zwyhprwertclmefaoida:RiteshDheeraj@{IP_ADDRESS}:5432/postgres"

print(f"Connecting to IP {IP_ADDRESS}:5432...")

try:
    conn = psycopg2.connect(DSN, sslmode="require", connect_timeout=10)
    print(f"✅ Connected to {IP_ADDRESS}!")
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    print(f"✅ Query Result: {cur.fetchone()}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"❌ Connection to {IP_ADDRESS} failed: {e}")
