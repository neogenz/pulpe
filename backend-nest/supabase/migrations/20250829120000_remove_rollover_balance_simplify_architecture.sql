-- Remove rollover_balance column to simplify architecture
-- New approach: calculate rollover dynamically from ending_balance only

-- Drop the index first
DROP INDEX IF EXISTS idx_monthly_budget_rollover_balance;

-- Remove the rollover_balance column
ALTER TABLE monthly_budget 
DROP COLUMN IF EXISTS rollover_balance;

-- Update table comment to reflect new simplified approach
COMMENT ON TABLE monthly_budget IS 'Monthly budgets with ending_balance only. Available to spend calculated dynamically as ending_balance_N + available_to_spend_(N-1)';