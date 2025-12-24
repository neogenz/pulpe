-- Add budget_line_id column to transaction table
-- This enables optional allocation of transactions to budget lines (prévisions)
-- Nullable to maintain backward compatibility with existing transactions

-- Step 1: Add the column
ALTER TABLE public.transaction
ADD COLUMN budget_line_id UUID NULL;

-- Step 2: Add descriptive comment
COMMENT ON COLUMN public.transaction.budget_line_id IS
'Optional reference to a budget line. Allows tracking which planned budget line this transaction is allocated to. NULL means the transaction is not allocated to any specific budget line.';

-- Step 3: Create partial index for performance (only index non-null values)
CREATE INDEX idx_transaction_budget_line_id
ON public.transaction(budget_line_id)
WHERE budget_line_id IS NOT NULL;

-- Step 4: Add foreign key constraint with ON DELETE SET NULL
-- If a budget line is deleted, transactions become "unallocated" rather than deleted
ALTER TABLE public.transaction
ADD CONSTRAINT transaction_budget_line_id_fkey
FOREIGN KEY (budget_line_id)
REFERENCES public.budget_line(id)
ON DELETE SET NULL;
