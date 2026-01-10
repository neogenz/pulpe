-- Add payDayOfMonth parameter to rollover calculation function
-- This migration modifies the function to order budgets by pay period instead of calendar month

-- Drop the old function (single parameter version)
DROP FUNCTION IF EXISTS public.get_budget_with_rollover(UUID);

-- Create new function with payDay parameter
CREATE OR REPLACE FUNCTION public.get_budget_with_rollover(
  p_budget_id UUID,
  p_pay_day_of_month INT DEFAULT 1
)
RETURNS TABLE (
  ending_balance NUMERIC,
  rollover NUMERIC,
  available_to_spend NUMERIC,
  previous_budget_id UUID
) AS $$
  WITH
  -- Normalize payDay to valid range (1-31)
  normalized_pay_day AS (
    SELECT GREATEST(1, LEAST(31, COALESCE(p_pay_day_of_month, 1))) as pay_day
  ),
  user_budget AS (
    -- Get the user info for the target budget
    SELECT user_id
    FROM public.monthly_budget
    WHERE id = p_budget_id
  ),
  budgets_with_sort_date AS (
    -- Calculate effective budget start date for each budget
    SELECT
      mb.id,
      mb.user_id,
      mb.year,
      mb.month,
      COALESCE(mb.ending_balance, 0) as ending_balance,
      -- Calculate effective start date: use payDay or last day of month if payDay > days in month
      make_date(
        mb.year,
        mb.month,
        LEAST(
          (SELECT pay_day FROM normalized_pay_day),
          EXTRACT(DAY FROM (
            date_trunc('month', make_date(mb.year, mb.month, 1))
            + INTERVAL '1 month'
            - INTERVAL '1 day'
          ))::INT
        )
      ) as budget_start_date
    FROM public.monthly_budget mb
    INNER JOIN user_budget ub ON mb.user_id = ub.user_id
  ),
  user_budgets_with_rollover AS (
    -- Get ALL budgets for this user with rollover calculations ordered by pay period
    SELECT
      bsd.id,
      bsd.ending_balance,
      -- Previous budget ID using LAG() ordered by pay period start date
      LAG(bsd.id) OVER (
        PARTITION BY bsd.user_id
        ORDER BY bsd.budget_start_date
      ) as previous_budget_id,
      -- Rollover = Sum of all previous months' ending_balance for this user
      COALESCE(
        SUM(bsd.ending_balance) OVER (
          PARTITION BY bsd.user_id
          ORDER BY bsd.budget_start_date
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0
      ) as rollover,
      -- Available to spend = Sum of ALL months (including current) ending_balance
      COALESCE(
        SUM(bsd.ending_balance) OVER (
          PARTITION BY bsd.user_id
          ORDER BY bsd.budget_start_date
          ROWS UNBOUNDED PRECEDING
        ), 0
      ) as available_to_spend
    FROM budgets_with_sort_date bsd
  )
  SELECT
    ubwr.ending_balance,
    ubwr.rollover,
    ubwr.available_to_spend,
    ubwr.previous_budget_id
  FROM user_budgets_with_rollover ubwr
  WHERE ubwr.id = p_budget_id;
$$ LANGUAGE sql STABLE;

-- Update function comment
COMMENT ON FUNCTION public.get_budget_with_rollover(UUID, INT) IS
'Calculate budget rollover and available_to_spend for a specific budget, ordered by pay period (payDayOfMonth).
When payDayOfMonth=1 (default), uses calendar month ordering.
When payDayOfMonth>1, orders budgets by the pay period start date (e.g., payDay=27 means January budget starts Jan 27th).';

-- Set search_path to empty string for security (prevents schema hijacking)
ALTER FUNCTION public.get_budget_with_rollover(UUID, INT) SET search_path = '';
