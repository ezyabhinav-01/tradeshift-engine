-- Ensure security_pin can store bcrypt hashes (60 chars) without truncation.
ALTER TABLE users
ALTER COLUMN security_pin TYPE VARCHAR(255);
