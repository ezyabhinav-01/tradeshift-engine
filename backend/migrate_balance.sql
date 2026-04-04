-- Migration script to add balance column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance FLOAT DEFAULT 100000.0;
UPDATE users SET balance = 100000.0 WHERE balance IS NULL;
