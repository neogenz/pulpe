-- Zero-out plaintext amount columns for rows that already have encrypted values.
-- After this migration, only encrypted columns hold the real amounts.
-- IMPORTANT: This migration is IRREVERSIBLE. Ensure backups exist before running.

-- Pre-flight: abort if any encrypted user has rows missing encrypted values.
-- This prevents data loss from running zero-out before backfill is complete.
DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count
  FROM (
    SELECT id FROM public.budget_line
      WHERE amount != 0 AND amount_encrypted IS NULL
      AND budget_id IN (
        SELECT id FROM public.monthly_budget
        WHERE user_id IN (SELECT user_id FROM public.user_encryption_key)
      )
    UNION ALL
    SELECT id FROM public.transaction
      WHERE amount != 0 AND amount_encrypted IS NULL
      AND budget_id IN (
        SELECT id FROM public.monthly_budget
        WHERE user_id IN (SELECT user_id FROM public.user_encryption_key)
      )
    UNION ALL
    SELECT id FROM public.template_line
      WHERE amount != 0 AND amount_encrypted IS NULL
      AND template_id IN (
        SELECT id FROM public.template
        WHERE user_id IN (SELECT user_id FROM public.user_encryption_key)
      )
  ) AS missing;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Cannot zero-out: % rows for encrypted users are missing amount_encrypted. Run backfill first.', missing_count;
  END IF;
END $$;

UPDATE public.budget_line SET amount = 0 WHERE amount_encrypted IS NOT NULL;
UPDATE public.transaction SET amount = 0 WHERE amount_encrypted IS NOT NULL;
UPDATE public.template_line SET amount = 0 WHERE amount_encrypted IS NOT NULL;
UPDATE public.savings_goal SET target_amount = 0 WHERE target_amount_encrypted IS NOT NULL;
UPDATE public.monthly_budget SET ending_balance = 0 WHERE ending_balance_encrypted IS NOT NULL;
