-- Fix Database Schema Mismatch
-- Run this script in pgAdmin 4 Query Tool to add missing columns to your tables.

-- 1. Update the 'users' table
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_level VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS investment_goals VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_instruments VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_tolerance VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_pin VARCHAR(4);

-- 2. Update the 'trade_logs' table (Syncing with current models)
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS holding_time FLOAT;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS trade_number INTEGER;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS stop_loss FLOAT;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS take_profit FLOAT;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS exit_reason VARCHAR;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS time_since_last_trade FLOAT;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS alert BOOLEAN DEFAULT FALSE;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS order_type VARCHAR DEFAULT 'MARKET';
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS limit_price FLOAT;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS stop_price FLOAT;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS triggered BOOLEAN DEFAULT FALSE;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'OPEN';
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS parent_trade_id INTEGER;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS session_type VARCHAR DEFAULT 'LIVE';

-- 3. Update 'portfolio_holdings' table
ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS session_type VARCHAR DEFAULT 'LIVE';

-- 🌿 Optimization: Add indexes where appropriate
CREATE INDEX IF NOT EXISTS idx_users_dob ON users(dob);
CREATE INDEX IF NOT EXISTS idx_trade_logs_session_id ON trade_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_trade_logs_user_id ON trade_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_logs_session_type ON trade_logs(session_type);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_session_type ON portfolio_holdings(session_type);

-- ✅ All clear! Restart your backend server now.
