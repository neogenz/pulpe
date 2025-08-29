-- Script de migration des données existantes pour rollover_balance
-- À exécuter APRÈS avoir appliqué la migration 20250829100000_add_rollover_balance_to_monthly_budget.sql

-- Recalculer rollover_balance pour tous les budgets existants
WITH ordered_budgets AS (
  SELECT 
    id,
    user_id,
    year,
    month,
    ending_balance,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY year, month
    ) as row_num
  FROM monthly_budget 
  WHERE ending_balance IS NOT NULL
),
cumulative_calculation AS (
  SELECT 
    id,
    user_id,
    year,
    month,
    ending_balance,
    SUM(ending_balance) OVER (
      PARTITION BY user_id 
      ORDER BY year, month 
      ROWS UNBOUNDED PRECEDING
    ) as calculated_rollover_balance
  FROM ordered_budgets
)
UPDATE monthly_budget 
SET rollover_balance = cc.calculated_rollover_balance
FROM cumulative_calculation cc
WHERE monthly_budget.id = cc.id;

-- Vérification : Afficher quelques lignes pour validation
SELECT 
  user_id,
  year,
  month,
  ending_balance,
  rollover_balance,
  LAG(rollover_balance) OVER (
    PARTITION BY user_id 
    ORDER BY year, month
  ) as prev_rollover_balance
FROM monthly_budget 
WHERE ending_balance IS NOT NULL
ORDER BY user_id, year, month
LIMIT 10;

-- Validation finale : Vérifier la cohérence
-- Cette requête doit retourner 0 lignes si tout est correct
WITH validation AS (
  SELECT 
    user_id,
    year,
    month,
    ending_balance,
    rollover_balance,
    LAG(rollover_balance) OVER (
      PARTITION BY user_id 
      ORDER BY year, month
    ) as prev_rollover_balance,
    rollover_balance - COALESCE(
      LAG(rollover_balance) OVER (
        PARTITION BY user_id 
        ORDER BY year, month
      ), 0
    ) as calculated_ending_balance
  FROM monthly_budget
  WHERE ending_balance IS NOT NULL
)
SELECT 
  user_id,
  year,
  month,
  ending_balance,
  calculated_ending_balance,
  ABS(ending_balance - calculated_ending_balance) as difference
FROM validation
WHERE ABS(ending_balance - calculated_ending_balance) > 0.01;