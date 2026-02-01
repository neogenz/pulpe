-- Drop CHECK constraints that prevent writing 0 to plaintext amount columns.
-- Columns remain NOT NULL — we write 0 (not null) when encryption is active.

ALTER TABLE public.budget_line DROP CONSTRAINT IF EXISTS budget_line_amount_check;
ALTER TABLE public.transaction DROP CONSTRAINT IF EXISTS transaction_amount_check;
ALTER TABLE public.template_line DROP CONSTRAINT IF EXISTS template_transactions_amount_check;
ALTER TABLE public.savings_goal DROP CONSTRAINT IF EXISTS savings_goal_target_amount_check;
