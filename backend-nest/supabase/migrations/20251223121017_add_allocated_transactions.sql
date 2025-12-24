-- Migration: Add optional budget_line_id to transaction table
-- Purpose: Enable transactions to be allocated to specific budget lines

-- Add nullable FK column
ALTER TABLE public.transaction
ADD COLUMN IF NOT EXISTS budget_line_id uuid NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.transaction.budget_line_id IS
'Optional reference to the budget line this transaction is allocated to. NULL for free (unallocated) transactions.';

-- Create partial index for efficient queries on allocated transactions
CREATE INDEX IF NOT EXISTS idx_transaction_budget_line_id
ON public.transaction USING btree (budget_line_id)
WHERE budget_line_id IS NOT NULL;

-- Add foreign key constraint with SET NULL on delete
-- When a budget line is deleted, allocated transactions become free transactions
ALTER TABLE public.transaction
DROP CONSTRAINT IF EXISTS transaction_budget_line_id_fkey;

ALTER TABLE public.transaction
ADD CONSTRAINT transaction_budget_line_id_fkey
FOREIGN KEY (budget_line_id)
REFERENCES public.budget_line (id)
ON DELETE SET NULL;

-- Note: Additional validation (kind match, budget match) is handled at the application layer
-- for better error messages and flexibility
