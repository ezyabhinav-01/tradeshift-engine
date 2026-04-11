BEGIN;

-- Validation checks to run before/after deploy:
-- 1) SELECT user_id, session_type, symbol, COUNT(*) FROM portfolio_holdings GROUP BY 1,2,3 HAVING COUNT(*) > 1;
-- 2) SELECT user_id, notification_id, COUNT(*) FROM broadcast_reads GROUP BY 1,2 HAVING COUNT(*) > 1;
-- 3) SELECT COUNT(*) FROM trade_logs t LEFT JOIN users u ON u.id = t.user_id WHERE t.user_id IS NOT NULL AND u.id IS NULL;
-- 4) SELECT COUNT(*) FROM portfolio_holdings h LEFT JOIN users u ON u.id = h.user_id WHERE h.user_id IS NOT NULL AND u.id IS NULL;
-- 5) EXPLAIN ANALYZE SELECT * FROM trade_logs WHERE user_id = 1 AND session_type = 'REPLAY' ORDER BY entry_time DESC LIMIT 20;
-- 6) EXPLAIN ANALYZE SELECT * FROM trade_logs WHERE symbol = 'RELIANCE' AND session_type = 'REPLAY' AND status = 'PENDING' AND user_id = 1;

CREATE INDEX IF NOT EXISTS ix_trade_logs_user_session_entry_time
    ON trade_logs (user_id, session_type, entry_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS ix_trade_logs_user_session_status_parent
    ON trade_logs (user_id, session_type, status, parent_trade_id, id DESC);

CREATE INDEX IF NOT EXISTS ix_trade_logs_symbol_session_status_user
    ON trade_logs (symbol, session_type, status, user_id, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolio_holdings_user_session_symbol
    ON portfolio_holdings (user_id, session_type, symbol);

CREATE INDEX IF NOT EXISTS ix_notifications_user_created_at
    ON notifications (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ix_notifications_broadcast_created_at
    ON notifications (created_at DESC, id DESC)
    WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_broadcast_reads_user_notification
    ON broadcast_reads (user_id, notification_id);

CREATE INDEX IF NOT EXISTS ix_portfolio_snapshots_user_session_timestamp
    ON portfolio_snapshots (user_id, session_type, timestamp DESC, id DESC);

CREATE INDEX IF NOT EXISTS ix_market_candles_symbol_timestamp
    ON market_candles (symbol, timestamp DESC);

-- Prototype data cleanup before FK validation.
UPDATE trade_logs t
SET user_id = NULL
WHERE t.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = t.user_id
  );

DELETE FROM broadcast_reads b
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = b.user_id
)
   OR NOT EXISTS (
    SELECT 1 FROM notifications n WHERE n.id = b.notification_id
);

DELETE FROM portfolio_holdings h
WHERE h.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = h.user_id
  );

DELETE FROM portfolio_snapshots p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = p.user_id
  );

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trade_logs_user') THEN
        ALTER TABLE trade_logs
            ADD CONSTRAINT fk_trade_logs_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trade_logs_parent_trade') THEN
        ALTER TABLE trade_logs
            ADD CONSTRAINT fk_trade_logs_parent_trade
            FOREIGN KEY (parent_trade_id) REFERENCES trade_logs(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_portfolio_holdings_user') THEN
        ALTER TABLE portfolio_holdings
            ADD CONSTRAINT fk_portfolio_holdings_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_portfolio_snapshots_user') THEN
        ALTER TABLE portfolio_snapshots
            ADD CONSTRAINT fk_portfolio_snapshots_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_broadcast_reads_user') THEN
        ALTER TABLE broadcast_reads
            ADD CONSTRAINT fk_broadcast_reads_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_broadcast_reads_notification') THEN
        ALTER TABLE broadcast_reads
            ADD CONSTRAINT fk_broadcast_reads_notification
            FOREIGN KEY (notification_id) REFERENCES notifications(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END $$;

ALTER TABLE trade_logs
    VALIDATE CONSTRAINT fk_trade_logs_user;
ALTER TABLE trade_logs
    VALIDATE CONSTRAINT fk_trade_logs_parent_trade;
ALTER TABLE portfolio_holdings
    VALIDATE CONSTRAINT fk_portfolio_holdings_user;
ALTER TABLE portfolio_snapshots
    VALIDATE CONSTRAINT fk_portfolio_snapshots_user;
ALTER TABLE broadcast_reads
    VALIDATE CONSTRAINT fk_broadcast_reads_user;
ALTER TABLE broadcast_reads
    VALIDATE CONSTRAINT fk_broadcast_reads_notification;

COMMIT;

-- Rollback notes:
-- DROP INDEX IF EXISTS ix_trade_logs_user_session_entry_time;
-- DROP INDEX IF EXISTS ix_trade_logs_user_session_status_parent;
-- DROP INDEX IF EXISTS ix_trade_logs_symbol_session_status_user;
-- DROP INDEX IF EXISTS uq_portfolio_holdings_user_session_symbol;
-- DROP INDEX IF EXISTS ix_notifications_user_created_at;
-- DROP INDEX IF EXISTS ix_notifications_broadcast_created_at;
-- DROP INDEX IF EXISTS uq_broadcast_reads_user_notification;
-- DROP INDEX IF EXISTS ix_portfolio_snapshots_user_session_timestamp;
-- DROP INDEX IF EXISTS ix_market_candles_symbol_timestamp;
-- ALTER TABLE trade_logs DROP CONSTRAINT IF EXISTS fk_trade_logs_user;
-- ALTER TABLE trade_logs DROP CONSTRAINT IF EXISTS fk_trade_logs_parent_trade;
-- ALTER TABLE portfolio_holdings DROP CONSTRAINT IF EXISTS fk_portfolio_holdings_user;
-- ALTER TABLE portfolio_snapshots DROP CONSTRAINT IF EXISTS fk_portfolio_snapshots_user;
-- ALTER TABLE broadcast_reads DROP CONSTRAINT IF EXISTS fk_broadcast_reads_user;
-- ALTER TABLE broadcast_reads DROP CONSTRAINT IF EXISTS fk_broadcast_reads_notification;
