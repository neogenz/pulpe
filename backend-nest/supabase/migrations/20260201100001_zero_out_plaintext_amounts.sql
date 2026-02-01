-- Zero-out plaintext amount columns for rows that already have encrypted values.
-- After this migration, only encrypted columns hold the real amounts.

UPDATE public.budget_line SET amount = 0 WHERE amount_encrypted IS NOT NULL;
UPDATE public.transaction SET amount = 0 WHERE amount_encrypted IS NOT NULL;
UPDATE public.template_line SET amount = 0 WHERE amount_encrypted IS NOT NULL;
UPDATE public.savings_goal SET target_amount = 0 WHERE target_amount_encrypted IS NOT NULL;
UPDATE public.monthly_budget SET ending_balance = 0 WHERE ending_balance_encrypted IS NOT NULL;
