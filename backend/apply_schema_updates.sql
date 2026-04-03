-- Fix User table missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS investment_goals VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_instruments VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_tolerance VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_pin VARCHAR(4);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS demat_id VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Fix TradeLog table missing columns from contributor code
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS alert BOOLEAN DEFAULT FALSE;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS order_type VARCHAR DEFAULT 'MARKET';
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS limit_price DOUBLE PRECISION;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS stop_price DOUBLE PRECISION;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS triggered BOOLEAN DEFAULT FALSE;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'OPEN';
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS parent_trade_id INTEGER;
ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS session_type VARCHAR DEFAULT 'LIVE';

-- Create missing auxiliary tables for the new features
CREATE TABLE IF NOT EXISTS user_chart_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    active_indicators TEXT DEFAULT '[]',
    indicator_settings TEXT DEFAULT '{}',
    active_drawings TEXT DEFAULT '[]',
    tool_templates TEXT DEFAULT '{}',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_streaks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_active_date TIMESTAMP,
    learning_minutes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    badge_id VARCHAR NOT NULL,
    badge_title VARCHAR,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_name VARCHAR NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure portfolio_holdings has session_type for isolation
ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS session_type VARCHAR DEFAULT 'LIVE';

-- Notification table already exists but let's ensure it has the correct structure for the new logic
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'info';
