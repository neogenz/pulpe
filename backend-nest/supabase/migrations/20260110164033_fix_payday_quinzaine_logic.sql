-- Fix payDay quinzaine logic in rollover calculation function
--
-- QUINZAINE RULE:
-- - payDay <= 15 (1ère quinzaine): Budget starts on payDay of SAME month
--   → Budget "Mars" starts: March payDay (covers 5 mars - 4 avril)
-- - payDay > 15 (2ème quinzaine): Budget starts on payDay of PREVIOUS month
--   → Budget "Mars" starts: February payDay (covers 27 fév - 26 mars)
--
-- This ensures the budget name corresponds to the month with the MAJORITY of days.

-- Drop the existing function to recreate with fixed logic
DROP FUNCTION IF EXISTS public.get_budget_with_rollover(UUID, INT);

-- Create fixed function with quinzaine logic
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
    -- Calculate effective budget start date for each budget using QUINZAINE logic
    SELECT
      mb.id,
      mb.user_id,
      mb.year,
      mb.month,
      COALESCE(mb.ending_balance, 0) as ending_balance,
      -- Calculate effective start date with QUINZAINE logic:
      -- - payDay <= 15: start in SAME month
      -- - payDay > 15: start in PREVIOUS month
      CASE
        WHEN (SELECT pay_day FROM normalized_pay_day) <= 15 THEN
          -- 1ère quinzaine: starts in same month as budget name
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
          )
        ELSE
          -- 2ème quinzaine: starts in PREVIOUS month
          make_date(
            CASE WHEN mb.month = 1 THEN mb.year - 1 ELSE mb.year END,
            CASE WHEN mb.month = 1 THEN 12 ELSE mb.month - 1 END,
            LEAST(
              (SELECT pay_day FROM normalized_pay_day),
              -- Get last day of PREVIOUS month for clamping
              EXTRACT(DAY FROM (
                date_trunc('month', make_date(mb.year, mb.month, 1))
                - INTERVAL '1 day'
              ))::INT
            )
          )
      END as budget_start_date
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
'Calculate budget rollover and available_to_spend for a specific budget, using QUINZAINE logic.
- payDay <= 15 (1ère quinzaine): Budget starts on payDay of same month → Budget "Mars" = 5 mars - 4 avril
- payDay > 15 (2ème quinzaine): Budget starts on payDay of previous month → Budget "Mars" = 27 fév - 26 mars
This ensures the budget name corresponds to the month containing the majority of days in the period.';

-- Set search_path to empty string for security (prevents schema hijacking)
ALTER FUNCTION public.get_budget_with_rollover(UUID, INT) SET search_path = '';
