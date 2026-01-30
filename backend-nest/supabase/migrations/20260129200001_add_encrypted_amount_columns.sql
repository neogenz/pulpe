-- Migration: Add encrypted amount columns alongside existing NUMERIC columns.
-- Dual-column strategy: existing columns remain for reversibility.
-- After backfill + verification, a future migration will switch over.

-- budget_line: amount (NUMERIC) -> amount_encrypted (TEXT)
ALTER TABLE public.budget_line
  ADD COLUMN IF NOT EXISTS amount_encrypted TEXT;

-- transaction: amount (NUMERIC) -> amount_encrypted (TEXT)
ALTER TABLE public.transaction
  ADD COLUMN IF NOT EXISTS amount_encrypted TEXT;

-- template_line: amount (NUMERIC) -> amount_encrypted (TEXT)
ALTER TABLE public.template_line
  ADD COLUMN IF NOT EXISTS amount_encrypted TEXT;

-- savings_goal: target_amount (NUMERIC) -> target_amount_encrypted (TEXT)
ALTER TABLE public.savings_goal
  ADD COLUMN IF NOT EXISTS target_amount_encrypted TEXT;

-- monthly_budget: ending_balance (NUMERIC) -> ending_balance_encrypted (TEXT)
ALTER TABLE public.monthly_budget
  ADD COLUMN IF NOT EXISTS ending_balance_encrypted TEXT;
