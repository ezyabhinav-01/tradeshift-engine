"""
Sync all learning/CMS data from Docker PostgreSQL → Supabase.
Handles schema mismatches (extra 'level' column in Docker, missing 'admins' table in Supabase).

Run: python sync_docker_to_supabase.py
"""
import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# --- Connection Config ---
DOCKER_DSN = "postgresql://user:password@localhost:5433/tradeshift"
SUPABASE_DSN = os.getenv("DATABASE_URL", "").replace("+asyncpg", "")

if not SUPABASE_DSN:
    print("❌ DATABASE_URL not set")
    sys.exit(1)

def connect(dsn, ssl=False):
    return psycopg2.connect(dsn, sslmode="require" if ssl else "prefer", cursor_factory=RealDictCursor)

def main():
    print("🔌 Connecting to Docker DB (localhost:5433)...")
    docker = connect(DOCKER_DSN, ssl=False)
    
    print("🔌 Connecting to Supabase...")
    supa = connect(SUPABASE_DSN, ssl=True)
    supa.autocommit = False
    
    dc = docker.cursor()
    sc = supa.cursor()
    
    try:
        # ═══════════════════════════════════════════
        # STEP 0: Fix schema mismatches in Supabase
        # ═══════════════════════════════════════════
        print("\n🛠️  Step 0: Fixing schema mismatches in Supabase...")
        sc.execute("""
            -- Tracks
            ALTER TABLE tracks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
            
            -- Modules
            ALTER TABLE modules ADD COLUMN IF NOT EXISTS module_number VARCHAR(50);
            ALTER TABLE modules ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
            
            -- SubModules
            ALTER TABLE sub_modules ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE sub_modules ADD COLUMN IF NOT EXISTS sub_module_number VARCHAR(50);
            ALTER TABLE sub_modules ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
            
            -- Lessons
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS opening_hook TEXT;
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS core_explanation TEXT;
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS socratic_questions JSONB DEFAULT '[]';
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS real_life_application TEXT;
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS key_takeaways JSONB DEFAULT '[]';
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS quiz_questions JSONB DEFAULT '[]';
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS practice_scene_id VARCHAR(255);
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 0;
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS read_time INTEGER DEFAULT 5;
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS lesson_number VARCHAR(50);
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content JSONB;
            ALTER TABLE lessons ADD COLUMN IF NOT EXISTS sub_module_id INTEGER REFERENCES sub_modules(id) ON DELETE SET NULL;
            
            -- Market Secrets
            ALTER TABLE market_secrets ADD COLUMN IF NOT EXISTS answer_content JSONB DEFAULT '{}';
            ALTER TABLE market_secrets ADD COLUMN IF NOT EXISTS answer_html TEXT;
            ALTER TABLE market_secrets ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(10) DEFAULT '🔮';
            ALTER TABLE market_secrets ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 25;
            ALTER TABLE market_secrets ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
            ALTER TABLE market_secrets ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
            ALTER TABLE market_secrets ADD COLUMN IF NOT EXISTS quiz_questions JSONB DEFAULT '[]';
            ALTER TABLE market_secrets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

            -- User Secret Reveals quiz columns
            ALTER TABLE user_secret_reveals ADD COLUMN IF NOT EXISTS quiz_score INTEGER DEFAULT 0;
            ALTER TABLE user_secret_reveals ADD COLUMN IF NOT EXISTS quiz_completed BOOLEAN DEFAULT FALSE;

            -- Broadcast Reads table
            CREATE TABLE IF NOT EXISTS broadcast_reads (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
                read_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user ON broadcast_reads(user_id);
            CREATE INDEX IF NOT EXISTS idx_broadcast_reads_notif ON broadcast_reads(notification_id);

            -- Topic Tags
            ALTER TABLE topic_tags ADD COLUMN IF NOT EXISTS display_name VARCHAR(150);
            ALTER TABLE topic_tags ADD COLUMN IF NOT EXISTS short_summary TEXT;
            ALTER TABLE topic_tags ADD COLUMN IF NOT EXISTS target_type VARCHAR(20) DEFAULT 'chapter';
            ALTER TABLE topic_tags ADD COLUMN IF NOT EXISTS target_id INTEGER;
            ALTER TABLE topic_tags ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(10) DEFAULT '📘';
            ALTER TABLE topic_tags ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
            ALTER TABLE topic_tags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        """)
        supa.commit()
        print("   ✅ Schema fixes applied")

        # ═══════════════════════════════════════
        # STEP 1: Create missing tables in Supabase
        # ═══════════════════════════════════════
        print("\n📋 Step 1: Creating missing tables in Supabase...")
        
        sc.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                is_superadmin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
            
            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                session_token VARCHAR UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                ip_address VARCHAR,
                user_agent VARCHAR
            );
            CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
            
            CREATE TABLE IF NOT EXISTS user_settings (
                id SERIAL PRIMARY KEY,
                user_id INT UNIQUE NOT NULL,
                max_daily_loss FLOAT DEFAULT 5000.0,
                max_order_quantity INT DEFAULT 100,
                one_click_trading_enabled BOOLEAN DEFAULT FALSE,
                require_session_confirmation BOOLEAN DEFAULT TRUE,
                last_updated TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS user_events (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                event_name VARCHAR NOT NULL,
                event_data JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS user_streaks (
                id SERIAL PRIMARY KEY,
                user_id INT UNIQUE NOT NULL,
                current_streak INT DEFAULT 0,
                longest_streak INT DEFAULT 0,
                last_active_date TIMESTAMP,
                learning_minutes INT DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS user_secret_reveals (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                secret_id INT REFERENCES market_secrets(id) ON DELETE CASCADE,
                revealed_at TIMESTAMP DEFAULT NOW(),
                xp_earned INT DEFAULT 0,
                UNIQUE(user_id, secret_id)
            );
            
            CREATE TABLE IF NOT EXISTS user_feedback (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                feedback_type VARCHAR(100),
                rating INT CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS user_chart_settings (
                id SERIAL PRIMARY KEY,
                user_id INT UNIQUE NOT NULL,
                active_indicators VARCHAR DEFAULT '[]',
                indicator_settings VARCHAR DEFAULT '{}',
                active_drawings VARCHAR DEFAULT '[]',
                tool_templates VARCHAR DEFAULT '{}',
                last_updated TIMESTAMP DEFAULT NOW()
            );
        """)
        supa.commit()
        print("   ✅ All missing tables created")
        
        # ═══════════════════════════════════════
        # STEP 2: Sync tracks
        # ═══════════════════════════════════════
        print("\n📦 Step 2: Syncing tracks...")
        dc.execute("SELECT id, title, description, created_at, sort_order FROM tracks ORDER BY id")
        tracks = dc.fetchall()
        
        for t in tracks:
            sc.execute("""
                INSERT INTO tracks (id, title, description, sort_order, created_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    sort_order = EXCLUDED.sort_order
            """, (t['id'], t['title'], t['description'], t['sort_order'], t['created_at']))
        supa.commit()
        print(f"   ✅ {len(tracks)} tracks checked/synced")
        
        # ═══════════════════════════════════════
        # STEP 3: Sync modules
        # ═══════════════════════════════════════
        print("\n📦 Step 3: Syncing modules...")
        dc.execute("SELECT id, track_id, title, description, sort_order, created_at, module_number FROM modules ORDER BY id")
        modules = dc.fetchall()
        
        for m in modules:
            sc.execute("""
                INSERT INTO modules (id, track_id, title, description, sort_order, created_at, module_number)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    track_id = EXCLUDED.track_id,
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    sort_order = EXCLUDED.sort_order,
                    module_number = EXCLUDED.module_number
            """, (m['id'], m['track_id'], m['title'], m['description'], m['sort_order'], m['created_at'], m['module_number']))
        supa.commit()
        print(f"   ✅ {len(modules)} modules checked/synced")
        
        # ═══════════════════════════════════════
        # STEP 4: Sync sub_modules
        # ═══════════════════════════════════════
        print("\n📦 Step 4: Syncing sub_modules...")
        dc.execute("SELECT id, module_id, title, sub_module_number, sort_order, created_at, description FROM sub_modules ORDER BY id")
        sub_modules = dc.fetchall()
        
        for sm in sub_modules:
            sc.execute("""
                INSERT INTO sub_modules (id, module_id, title, description, sub_module_number, sort_order, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    module_id = EXCLUDED.module_id,
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    sub_module_number = EXCLUDED.sub_module_number,
                    sort_order = EXCLUDED.sort_order
            """, (sm['id'], sm['module_id'], sm['title'], sm.get('description'), sm['sub_module_number'], sm['sort_order'], sm['created_at']))
        supa.commit()
        print(f"   ✅ {len(sub_modules)} sub_modules checked/synced")
        
        # ═══════════════════════════════════════
        # STEP 5: Sync lessons
        # ═══════════════════════════════════════
        print("\n📦 Step 5: Syncing lessons...")
        dc.execute("""
            SELECT id, module_id, title, opening_hook, core_explanation,
                   socratic_questions, real_life_application, key_takeaways,
                   quiz_questions, practice_scene_id, xp_reward, read_time,
                   is_published, created_at, updated_at, content, sort_order,
                   sub_module_id, lesson_number
            FROM lessons ORDER BY id
        """)
        lessons = dc.fetchall()
        
        for l in lessons:
            sc.execute("""
                INSERT INTO lessons (id, module_id, title, opening_hook, core_explanation,
                    socratic_questions, real_life_application, key_takeaways,
                    quiz_questions, practice_scene_id, xp_reward, read_time,
                    is_published, created_at, updated_at, content, sort_order,
                    sub_module_id, lesson_number)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    module_id = EXCLUDED.module_id,
                    title = EXCLUDED.title,
                    opening_hook = EXCLUDED.opening_hook,
                    core_explanation = EXCLUDED.core_explanation,
                    socratic_questions = EXCLUDED.socratic_questions,
                    real_life_application = EXCLUDED.real_life_application,
                    key_takeaways = EXCLUDED.key_takeaways,
                    quiz_questions = EXCLUDED.quiz_questions,
                    practice_scene_id = EXCLUDED.practice_scene_id,
                    xp_reward = EXCLUDED.xp_reward,
                    read_time = EXCLUDED.read_time,
                    is_published = EXCLUDED.is_published,
                    updated_at = EXCLUDED.updated_at,
                    content = EXCLUDED.content,
                    sort_order = EXCLUDED.sort_order,
                    sub_module_id = EXCLUDED.sub_module_id,
                    lesson_number = EXCLUDED.lesson_number
            """, (
                l['id'], l['module_id'], l['title'], l['opening_hook'], l['core_explanation'],
                json.dumps(l['socratic_questions']) if l['socratic_questions'] else '[]',
                l['real_life_application'],
                json.dumps(l['key_takeaways']) if l['key_takeaways'] else '[]',
                json.dumps(l['quiz_questions']) if l['quiz_questions'] else '[]',
                l['practice_scene_id'], l['xp_reward'], l['read_time'],
                l['is_published'], l['created_at'], l['updated_at'],
                json.dumps(l['content']) if l['content'] else None,
                l['sort_order'], l['sub_module_id'], l['lesson_number']
            ))
        supa.commit()
        print(f"   ✅ {len(lessons)} lessons checked/synced")
        
        # ═══════════════════════════════════════
        # STEP 6: Sync market_secrets
        # ═══════════════════════════════════════
        print("\n📦 Step 6: Syncing market_secrets...")
        dc.execute("SELECT * FROM market_secrets ORDER BY id")
        secrets = dc.fetchall()
        
        for s in secrets:
            sc.execute("""
                INSERT INTO market_secrets (id, question, answer_content, answer_html, icon_emoji, xp_reward, sort_order, is_published, quiz_questions, created_at, updated_at)
                VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    question = EXCLUDED.question,
                    answer_content = EXCLUDED.answer_content,
                    answer_html = EXCLUDED.answer_html,
                    icon_emoji = EXCLUDED.icon_emoji,
                    xp_reward = EXCLUDED.xp_reward,
                    sort_order = EXCLUDED.sort_order,
                    is_published = EXCLUDED.is_published,
                    quiz_questions = EXCLUDED.quiz_questions,
                    updated_at = EXCLUDED.updated_at
            """, (
                s['id'], s['question'],
                json.dumps(s['answer_content']) if s['answer_content'] else '{}',
                s.get('answer_html'), s['icon_emoji'], s['xp_reward'],
                s['sort_order'], s['is_published'],
                json.dumps(s.get('quiz_questions')) if s.get('quiz_questions') else '[]',
                s['created_at'], s['updated_at']
            ))
        supa.commit()
        print(f"   ✅ {len(secrets)} market_secrets checked/synced")
        
        # ═══════════════════════════════════════
        # STEP 7: Sync topic_tags
        # ═══════════════════════════════════════
        print("\n📦 Step 7: Syncing topic_tags...")
        dc.execute("SELECT * FROM topic_tags ORDER BY id")
        tags = dc.fetchall()
        
        for t in tags:
            sc.execute("""
                INSERT INTO topic_tags (id, tag_name, display_name, short_summary, target_type, target_id, icon_emoji, usage_count, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    tag_name = EXCLUDED.tag_name,
                    display_name = EXCLUDED.display_name,
                    short_summary = EXCLUDED.short_summary,
                    target_type = EXCLUDED.target_type,
                    target_id = EXCLUDED.target_id,
                    icon_emoji = EXCLUDED.icon_emoji,
                    usage_count = EXCLUDED.usage_count,
                    updated_at = EXCLUDED.updated_at
            """, (
                t['id'], t['tag_name'], t['display_name'], t['short_summary'],
                t['target_type'], t['target_id'], t['icon_emoji'], t['usage_count'],
                t['created_at'], t['updated_at']
            ))
        supa.commit()
        print(f"   ✅ {len(tags)} topic_tags checked/synced")
        
        # ═══════════════════════════════════════
        # STEP 8: Sync admins
        # ═══════════════════════════════════════
        print("\n📦 Step 8: Syncing admins...")
        dc.execute("SELECT * FROM admins ORDER BY id")
        admins = dc.fetchall()
        
        for a in admins:
            sc.execute("""
                INSERT INTO admins (id, username, email, password_hash, is_active, is_superadmin, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    email = EXCLUDED.email,
                    password_hash = EXCLUDED.password_hash,
                    is_active = EXCLUDED.is_active,
                    is_superadmin = EXCLUDED.is_superadmin,
                    updated_at = EXCLUDED.updated_at
            """, (
                a['id'], a['username'], a['email'], a['password_hash'],
                a['is_active'], a['is_superadmin'], a['created_at'], a['updated_at']
            ))
        supa.commit()
        print(f"   ✅ {len(admins)} admins checked/synced")
        
        # ═══════════════════════════════════════
        # STEP 9: Reset sequences
        # ═══════════════════════════════════════
        print("\n🔄 Step 9: Resetting sequences...")
        sequences = [
            ('tracks_id_seq', 'tracks'),
            ('modules_id_seq', 'modules'),
            ('sub_modules_id_seq', 'sub_modules'),
            ('lessons_id_seq', 'lessons'),
            ('market_secrets_id_seq', 'market_secrets'),
            ('topic_tags_id_seq', 'topic_tags'),
            ('admins_id_seq', 'admins'),
        ]
        for seq, tbl in sequences:
            try:
                sc.execute(f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM {tbl}), 0) + 1)")
            except Exception:
                supa.rollback()
        supa.commit()
        print("   ✅ Sequences reset")
        
        # ═══════════════════════════════════════
        # VERIFICATION
        # ═══════════════════════════════════════
        print("\n" + "="*50)
        print("📊 VERIFICATION — Supabase row counts:")
        print("="*50)
        for tbl in ['tracks', 'modules', 'sub_modules', 'lessons', 'market_secrets', 'topic_tags', 'admins']:
            sc.execute(f"SELECT count(*) as cnt FROM {tbl}")
            count = sc.fetchone()['cnt']
            print(f"   {tbl:20s} → {count} rows")
        print("="*50)
        print("✅ ALL DATA SYNCED SUCCESSFULLY!")
        print("   The Learn page on localhost:5173 should now show all modules.")
        
    except Exception as e:
        supa.rollback()
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        dc.close()
        sc.close()
        docker.close()
        supa.close()

if __name__ == "__main__":
    main()
