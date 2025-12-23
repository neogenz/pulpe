-- Add budget_line_id column to transaction table
-- Allows linking a transaction to a specific budget line for allocation tracking
-- Nullable for backward compatibility - existing transactions remain "free" (unallocated)

-- Step 1: Add the column
ALTER TABLE public.transaction
ADD COLUMN IF NOT EXISTS budget_line_id UUID NULL;

-- Step 2: Add descriptive comment
COMMENT ON COLUMN public.transaction.budget_line_id IS
'Optional reference to the budget line this transaction is allocated to. NULL for free/unallocated transactions.';

-- Step 3: Create partial index for performance on allocated transactions
CREATE INDEX IF NOT EXISTS idx_transaction_budget_line_id
ON public.transaction USING btree (budget_line_id)
WHERE budget_line_id IS NOT NULL;

-- Step 4: Add foreign key constraint with ON DELETE SET NULL
-- When a budget line is deleted, transactions become "free" instead of being deleted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transaction_budget_line_id_fkey'
    AND table_name = 'transaction'
  ) THEN
    ALTER TABLE public.transaction
    ADD CONSTRAINT transaction_budget_line_id_fkey
    FOREIGN KEY (budget_line_id)
    REFERENCES public.budget_line (id)
    ON DELETE SET NULL;
  END IF;
END $$;
