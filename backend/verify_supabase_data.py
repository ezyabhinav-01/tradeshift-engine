"""
Verify Supabase Data Integrity for Learning Content.
Connects to Supabase and prints row counts, schema checks, and market_secrets status.

Run: python verify_supabase_data.py
"""
import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_DSN = os.getenv("DATABASE_URL", "").replace("+asyncpg", "")
if not SUPABASE_DSN:
    print("❌ DATABASE_URL not set in .env")
    sys.exit(1)


def main():
    print("=" * 60)
    print("🔍 SUPABASE DATA VERIFICATION")
    print("=" * 60)

    try:
        conn = psycopg2.connect(SUPABASE_DSN, sslmode="require", cursor_factory=RealDictCursor)
        cur = conn.cursor()
        print("✅ Connected to Supabase\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    # ─── 1. Row Counts ───
    print("📊 TABLE ROW COUNTS:")
    print("-" * 40)
    tables = [
        "tracks", "modules", "sub_modules", "lessons",
        "market_secrets", "topic_tags", "admins",
        "users", "notifications", "user_secret_reveals",
        "learning_progress", "user_streaks", "user_badges",
    ]
    for tbl in tables:
        try:
            cur.execute(f"SELECT count(*) as cnt FROM {tbl}")
            count = cur.fetchone()["cnt"]
            print(f"   {tbl:25s} → {count} rows")
        except Exception:
            conn.rollback()
            print(f"   {tbl:25s} → ⚠️  TABLE NOT FOUND")

    # ─── 2. Market Secrets Detail ───
    print("\n" + "=" * 60)
    print("🔮 MARKET SECRETS DETAIL:")
    print("-" * 60)
    try:
        cur.execute("""
            SELECT id, question, is_published, xp_reward, icon_emoji,
                   LENGTH(answer_html) as html_len,
                   answer_content IS NOT NULL as has_json,
                   created_at, updated_at
            FROM market_secrets
            ORDER BY sort_order, id
        """)
        secrets = cur.fetchall()
        if not secrets:
            print("   ⚠️  No market secrets found in Supabase!")
        for s in secrets:
            status = "🟢 LIVE" if s["is_published"] else "🔴 DRAFT"
            html_status = f"✅ {s['html_len']} chars" if s["html_len"] and s["html_len"] > 0 else "❌ EMPTY"
            json_status = "✅" if s["has_json"] else "❌"
            print(f"   [{s['id']}] {status} | {s['icon_emoji']} {s['question'][:50]}...")
            print(f"        XP: {s['xp_reward']} | HTML: {html_status} | JSON: {json_status}")
            print()
    except Exception as e:
        conn.rollback()
        print(f"   ❌ Error querying market_secrets: {e}")

    # ─── 3. Schema Verification ───
    print("=" * 60)
    print("🔧 SCHEMA VERIFICATION:")
    print("-" * 60)
    expected_columns = {
        "market_secrets": [
            "id", "question", "answer_content", "answer_html",
            "icon_emoji", "xp_reward", "sort_order", "is_published",
            "created_at", "updated_at"
        ],
        "lessons": [
            "id", "module_id", "title", "content", "is_published",
            "xp_reward", "read_time", "sort_order", "sub_module_id"
        ],
        "notifications": [
            "id", "user_id", "title", "content", "type", "is_read", "created_at"
        ],
    }
    for tbl, expected_cols in expected_columns.items():
        try:
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = %s AND table_schema = 'public'
            """, (tbl,))
            actual_cols = {row["column_name"] for row in cur.fetchall()}
            missing = [c for c in expected_cols if c not in actual_cols]
            if missing:
                print(f"   {tbl}: ❌ Missing columns: {missing}")
            else:
                print(f"   {tbl}: ✅ All expected columns present")
        except Exception as e:
            conn.rollback()
            print(f"   {tbl}: ❌ Error: {e}")

    print("\n" + "=" * 60)
    print("✅ VERIFICATION COMPLETE")
    print("=" * 60)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
