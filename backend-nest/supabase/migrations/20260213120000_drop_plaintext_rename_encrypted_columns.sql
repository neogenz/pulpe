-- Migration: Remove dual-column encryption pattern
-- After successful backfill migration of all 3 prod users, plaintext columns
-- always contain 0 (or null). Drop them and rename *_encrypted → original names.

BEGIN;

-- Safety check: abort if any plaintext column still holds a non-zero value
DO $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
    FROM (
      SELECT 1 FROM budget_line    WHERE amount         IS NOT NULL AND amount         <> 0
      UNION ALL
      SELECT 1 FROM transaction    WHERE amount         IS NOT NULL AND amount         <> 0
      UNION ALL
      SELECT 1 FROM template_line  WHERE amount         IS NOT NULL AND amount         <> 0
      UNION ALL
      SELECT 1 FROM savings_goal   WHERE target_amount  IS NOT NULL AND target_amount  <> 0
      UNION ALL
      SELECT 1 FROM monthly_budget WHERE ending_balance  IS NOT NULL AND ending_balance  <> 0
    ) t;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows still have non-zero plaintext values', v_count;
  END IF;
END $$;

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
