import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# --- Connection Config ---
DOCKER_DSN = "postgresql://user:password@localhost:5433/tradeshift"

def connect(dsn):
    return psycopg2.connect(dsn, cursor_factory=RealDictCursor)

def main():
    print("🔌 Connecting to Docker DB...")
    docker = connect(DOCKER_DSN)
    dc = docker.cursor()
    
    output_file = "supabase_migration.sql"
    print(f"📄 Generating {output_file}...")
    
    with open(output_file, "w") as f:
        f.write("-- TRADESHIFT DATA MIGRATION SCRIPt\n")
        f.write("-- Generates INSERT statements for pasting into Supabase SQL Editor\n\n")
        
        # ═══════════════════════════════════════
        # TABLES TO SYNC
        # ═══════════════════════════════════════
        tables = [
            'tracks', 
            'modules', 
            'sub_modules', 
            'lessons', 
            'market_secrets', 
            'topic_tags', 
            'admins'
        ]
        
        for tbl in tables:
            print(f"📦 Processing {tbl}...")
            f.write(f"-- Data for {tbl}\n")
            
            # Special column handling
            cols_map = {
                'tracks': ['id', 'title', 'description', 'sort_order', 'created_at'],
                'modules': ['id', 'track_id', 'title', 'description', 'sort_order', 'created_at', 'module_number'],
                'sub_modules': ['id', 'module_id', 'title', 'description', 'sub_module_number', 'sort_order', 'created_at'],
                'lessons': ['id', 'module_id', 'title', 'opening_hook', 'core_explanation', 'socratic_questions', 'real_life_application', 'key_takeaways', 'quiz_questions', 'practice_scene_id', 'xp_reward', 'read_time', 'is_published', 'created_at', 'updated_at', 'content', 'sort_order', 'sub_module_id', 'lesson_number'],
                'market_secrets': ['id', 'question', 'answer_content', 'answer_html', 'icon_emoji', 'xp_reward', 'sort_order', 'is_published', 'created_at', 'updated_at'],
                'topic_tags': ['id', 'tag_name', 'display_name', 'short_summary', 'target_type', 'target_id', 'icon_emoji', 'usage_count', 'created_at', 'updated_at'],
                'admins': ['id', 'username', 'email', 'password_hash', 'is_active', 'is_superadmin', 'created_at', 'updated_at']
            }
            
            cols = cols_map[tbl]
            col_list = ", ".join(cols)
            
            dc.execute(f"SELECT {col_list} FROM {tbl} ORDER BY id")
            rows = dc.fetchall()
            
            if not rows:
                print(f"   ⚠️ No data found in {tbl}")
                continue
                
            for row in rows:
                vals = []
                for col in cols:
                    val = row[col]
                    if val is None:
                        vals.append("NULL")
                    elif isinstance(val, (dict, list)):
                        vals.append(f"'{json.dumps(val).replace("'", "''")}'::jsonb")
                    elif isinstance(val, bool):
                        vals.append("TRUE" if val else "FALSE")
                    else:
                        vals.append(f"'{str(val).replace("'", "''")}'")
                
                val_list = ", ".join(vals)
                f.write(f"INSERT INTO {tbl} ({col_list}) VALUES ({val_list}) ON CONFLICT (id) DO NOTHING;\n")
            
            f.write("\n")
            
        # ═══════════════════════════════════════
        # RESET SEQUENCES
        # ═══════════════════════════════════════
        f.write("-- Reset Sequences\n")
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
            f.write(f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM {tbl}), 0) + 1);\n")

    print(f"✅ SUCCESS! Generated {output_file}")
    docker.close()

if __name__ == "__main__":
    main()
