-- Migration: Remove dual-column encryption pattern
-- After successful backfill migration of all 3 prod users, plaintext columns
-- always contain 0 (or null). Drop them and rename *_encrypted → original names.

BEGIN;

-- 1. Drop plaintext numeric columns (always 0 since encryption backfill completed)
ALTER TABLE budget_line DROP COLUMN amount;
ALTER TABLE transaction DROP COLUMN amount;
ALTER TABLE template_line DROP COLUMN amount;
ALTER TABLE savings_goal DROP COLUMN target_amount;
ALTER TABLE monthly_budget DROP COLUMN ending_balance;

-- 2. Rename encrypted columns to original names
ALTER TABLE budget_line RENAME COLUMN amount_encrypted TO amount;
ALTER TABLE transaction RENAME COLUMN amount_encrypted TO amount;
ALTER TABLE template_line RENAME COLUMN amount_encrypted TO amount;
ALTER TABLE savings_goal RENAME COLUMN target_amount_encrypted TO target_amount;
ALTER TABLE monthly_budget RENAME COLUMN ending_balance_encrypted TO ending_balance;

-- 3. Drop the rekey RPC (no longer needed, was used for migration vault code setup)
DROP FUNCTION IF EXISTS rekey_user_encrypted_data(
  jsonb, jsonb, jsonb, jsonb, jsonb, text
);

COMMIT;
