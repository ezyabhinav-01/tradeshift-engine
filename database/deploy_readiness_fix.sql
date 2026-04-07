BEGIN;

-- Remove orphan user events so referential integrity can be enforced.
DELETE FROM user_events ue
WHERE ue.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = ue.user_id
  );

-- Remove invalid self-references before adding parent integrity enforcement.
UPDATE trade_logs t
SET parent_trade_id = NULL
WHERE t.parent_trade_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM trade_logs p WHERE p.id = t.parent_trade_id
  );

-- De-duplicate learning progress (keep latest row per user + lesson).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lesson_id
      ORDER BY completed_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM learning_progress
)
DELETE FROM learning_progress lp
USING ranked r
WHERE lp.id = r.id
  AND r.rn > 1;

-- Enforce FK for user_events -> users.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_user_events_user_id_users'
  ) THEN
    ALTER TABLE user_events
      ADD CONSTRAINT fk_user_events_user_id_users
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- trade_logs is partitioned, so a direct self-FK on id is not valid in PostgreSQL.
-- Enforce equivalent integrity using a trigger.
CREATE OR REPLACE FUNCTION enforce_trade_logs_parent_exists()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_trade_id IS NOT NULL THEN
    PERFORM 1
    FROM trade_logs p
    WHERE p.id = NEW.parent_trade_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent_trade_id %% does not exist in trade_logs', NEW.parent_trade_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trade_logs_parent_exists ON trade_logs;
CREATE TRIGGER trg_trade_logs_parent_exists
BEFORE INSERT OR UPDATE OF parent_trade_id ON trade_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_trade_logs_parent_exists();

CREATE INDEX IF NOT EXISTS idx_trade_logs_parent_trade_id ON trade_logs(parent_trade_id);

-- Remove drift tables not used by current backend/frontend code.
DROP TABLE IF EXISTS user_lesson_progress CASCADE;
DROP TABLE IF EXISTS user_feedback CASCADE;

COMMIT;
