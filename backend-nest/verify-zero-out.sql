-- Verification query to confirm zero-out implementation
-- Run this AFTER making API calls with X-Client-Key header
-- Expected result: 0 everywhere (no plaintext amounts for encrypted rows)

SELECT 'budget_line' as table_name, count(*) as plaintext_leak_count
FROM budget_line
WHERE amount > 0 AND amount_encrypted IS NOT NULL

UNION ALL

SELECT 'transaction', count(*)
FROM transaction
WHERE amount > 0 AND amount_encrypted IS NOT NULL

UNION ALL

SELECT 'template_line', count(*)
FROM template_line
WHERE amount > 0 AND amount_encrypted IS NOT NULL

UNION ALL

SELECT 'savings_goal', count(*)
FROM savings_goal
WHERE target_amount > 0 AND target_amount_encrypted IS NOT NULL

UNION ALL

SELECT 'monthly_budget', count(*)
FROM monthly_budget
WHERE ending_balance > 0 AND ending_balance_encrypted IS NOT NULL;

-- If all counts are 0, the zero-out is working correctly
