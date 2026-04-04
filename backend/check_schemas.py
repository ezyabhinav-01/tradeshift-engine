import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DOCKER_DSN = "postgresql://user:password@localhost:5433/tradeshift"
SUPABASE_DSN = os.getenv("DATABASE_URL", "").replace("+asyncpg", "")

def get_cols(dsn, table, ssl=False):
    conn = psycopg2.connect(dsn, sslmode="require" if ssl else "prefer")
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}' ORDER BY ordinal_position")
    cols = cur.fetchall()
    cur.close()
    conn.close()
    return cols

try:
    print("--- DOCKER LESSONS ---")
    for col in get_cols(DOCKER_DSN, 'lessons'):
        print(f"{col['column_name']}: {col['data_type']}")
    
    print("\n--- SUPABASE LESSONS ---")
    for col in get_cols(SUPABASE_DSN, 'lessons', ssl=True):
        print(f"{col['column_name']}: {col['data_type']}")
        
except Exception as e:
    print(f"Error: {e}")
