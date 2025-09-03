-- Add optimized rollover calculation function using window functions
-- This replaces recursive TypeScript logic with efficient SQL

-- Main function: Calculate rollover and available_to_spend for a specific budget
CREATE OR REPLACE FUNCTION get_budget_with_rollover(p_budget_id UUID)
RETURNS TABLE (
  ending_balance NUMERIC,
  rollover NUMERIC,
  available_to_spend NUMERIC
) AS $$
  WITH user_budget AS (
    -- Get the user and date info for the target budget
    SELECT user_id, year, month 
    FROM monthly_budget 
    WHERE id = p_budget_id
  ),
  user_budgets_with_rollover AS (
    -- Get ALL budgets for this user with rollover calculations
    SELECT 
      mb.id,
      COALESCE(mb.ending_balance, 0) as ending_balance,
      -- Rollover = Sum of all previous months' ending_balance for this user
      COALESCE(
        SUM(COALESCE(mb.ending_balance, 0)) OVER (
          PARTITION BY mb.user_id 
          ORDER BY mb.year, mb.month 
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0
      ) as rollover,
      -- Available to spend = Sum of ALL months (including current) ending_balance
      COALESCE(
        SUM(COALESCE(mb.ending_balance, 0)) OVER (
          PARTITION BY mb.user_id 
          ORDER BY mb.year, mb.month 
          ROWS UNBOUNDED PRECEDING
        ), 0
      ) as available_to_spend
    FROM monthly_budget mb
    CROSS JOIN user_budget ub
    WHERE mb.user_id = ub.user_id
  )
  SELECT 
    ubwr.ending_balance,
    ubwr.rollover,
    ubwr.available_to_spend
  FROM user_budgets_with_rollover ubwr
  WHERE ubwr.id = p_budget_id;
$$ LANGUAGE sql STABLE;

-- Add comment for the only useful function
COMMENT ON FUNCTION get_budget_with_rollover(UUID) IS 
'Calculate budget rollover (previous month''s available_to_spend, which is the cumulative sum of all previous months'' ending_balance) and available_to_spend (cumulative balance) for a specific budget using window functions.';