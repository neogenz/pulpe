-- Add ending_balance column to monthly_budget table
-- This stores the end-of-month balance (income - expenses - transactions) WITHOUT rollover
-- Used as the rollover base for the next month

-- Step 1: Add the column
ALTER TABLE public.monthly_budget
ADD COLUMN ending_balance NUMERIC(10,2);

-- Step 2: Add descriptive comment
COMMENT ON COLUMN public.monthly_budget.ending_balance IS 
'End-of-month balance (income - expenses - transactions) WITHOUT rollover. Used as rollover base for next month.';

-- Step 3: Create index for performance
CREATE INDEX idx_monthly_budget_ending_balance 
ON public.monthly_budget(user_id, year, month) 
WHERE ending_balance IS NOT NULL;

-- Step 4: Calculate values for existing budgets
WITH budget_calculations AS (
  SELECT 
    mb.id,
    COALESCE(
      (
        -- Income from budget lines
        SELECT SUM(amount)
        FROM budget_line bl
        WHERE bl.budget_id = mb.id 
        AND bl.kind = 'income'
      ), 0
    ) - COALESCE(
      (
        -- Expenses and savings from budget lines
        SELECT SUM(amount)
        FROM budget_line bl
        WHERE bl.budget_id = mb.id 
        AND bl.kind IN ('expense', 'saving')
      ), 0
    ) + COALESCE(
      (
        -- Income from transactions
        SELECT SUM(amount)
        FROM transaction t
        WHERE t.budget_id = mb.id 
        AND t.kind = 'income'
      ), 0
    ) - COALESCE(
      (
        -- Expenses from transactions
        SELECT SUM(amount)
        FROM transaction t
        WHERE t.budget_id = mb.id 
        AND t.kind IN ('expense', 'saving')
      ), 0
    ) AS calculated_balance
  FROM monthly_budget mb
)
UPDATE monthly_budget
SET ending_balance = bc.calculated_balance
FROM budget_calculations bc
WHERE monthly_budget.id = bc.id
AND monthly_budget.ending_balance IS NULL;