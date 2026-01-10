# Task: Fix SQL Quinzaine Logic in Budget Rollover Function

## Problem

The PostgreSQL function `get_budget_with_rollover` calculates `budget_start_date` incorrectly. It always uses the budget's calendar month for the start date, but should apply the **quinzaine rule**:

| PayDay | Current Behavior | Expected Behavior |
|--------|------------------|-------------------|
| 1-15 | Uses budget month | Uses budget month (correct) |
| 16-31 | Uses budget month | Uses **previous** month |

**Example Bug:**
- Budget "Mars 2026" with payDay=27
- Current: Starts 27 mars (wrong)
- Expected: Starts 27 fév (correct - majority of days are in March)

This causes incorrect rollover calculations and budget ordering.

## Proposed Solution

Create a new SQL migration that updates the `budget_start_date` calculation in `get_budget_with_rollover`:

1. Add quinzaine logic with `CASE WHEN pay_day <= 15 THEN ... ELSE ... END`
2. For `payDay > 15`: Calculate start date in **previous month**
   - Handle year transition (January budget → December of previous year)
   - Handle month-end edge cases with `LEAST()` for Feb 28/29
3. Keep all existing logic unchanged:
   - `normalized_pay_day` CTE
   - `LAG()` for `previous_budget_id`
   - `SUM()` window function for rollover

## Dependencies

- None (SQL is independent from TypeScript code)

## Context

- Current migration: `backend-nest/supabase/migrations/20260110150309_add_payday_to_rollover_function.sql`
- Bug location: Lines 37-49 (budget_start_date calculation)
- Window functions depend on correct ordering by `budget_start_date`
- Supabase local: Run `supabase start` to test locally

## Success Criteria

- New migration file created with timestamp naming
- Budget "Mars 2026" with payDay=27 → starts 27 fév
- Budget "Mars 2026" with payDay=5 → starts 5 mars (unchanged)
- Year transitions work: Budget "Jan 2026" with payDay=27 → starts 27 déc 2025
- February edge case: payDay=30 → clamps to 28 or 29
- Rollover and previous_budget_id still calculated correctly
- Migration applies cleanly: `supabase db push` (local only)
