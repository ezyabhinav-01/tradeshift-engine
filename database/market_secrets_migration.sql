-- ═══════════════════════════════════════════
-- MARKET SECRETS — Gamified Learning Feature
-- ═══════════════════════════════════════════

-- 1. Market Secrets table
CREATE TABLE IF NOT EXISTS market_secrets (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer_content JSONB DEFAULT '{}',
    answer_html TEXT,
    icon_emoji VARCHAR(10) DEFAULT '🔮',
    xp_reward INTEGER DEFAULT 25,
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Secret Reveals tracking table
CREATE TABLE IF NOT EXISTS user_secret_reveals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    secret_id INTEGER NOT NULL REFERENCES market_secrets(id) ON DELETE CASCADE,
    revealed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    xp_earned INTEGER DEFAULT 0,
    UNIQUE(user_id, secret_id)
);

-- Index for fast user-specific lookups
CREATE INDEX IF NOT EXISTS idx_user_secret_reveals_user_id ON user_secret_reveals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_secret_reveals_secret_id ON user_secret_reveals(secret_id);
