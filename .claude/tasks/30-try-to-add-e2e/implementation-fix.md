# Fix: remaining=0 in Budget List API

## Root Cause

The bug was introduced in task 31 when modifying `budget.calculator.ts` to use envelope-aware expense calculation.

The `selectFields` parameter `'id, kind, amount, budget_line_id'` was passed to `fetchBudgetData()`, which used the **same fields** for both `budget_line` and `transaction` tables.

**Problem:** The `budget_line` table does NOT have a `budget_line_id` column! This column only exists in the `transaction` table.

When PostgreSQL received `.select('id, kind, amount, budget_line_id')` on the `budget_line` table, the query likely failed silently or returned empty results, causing all calculations to return 0.

## Fix

Modified `budget.repository.ts` to support **separate field selections** for budget_line and transaction tables:

### Before
```typescript
interface BudgetDataOptions {
  selectFields?: string;  // Used for BOTH tables
  ...
}
```

### After
```typescript
interface BudgetDataOptions {
  budgetLineFields?: string;   // For budget_line table
  transactionFields?: string;  // For transaction table
  ...
}
```

## Files Changed

| File | Change |
|------|--------|
| `backend-nest/src/modules/budget/budget.repository.ts` | Split `selectFields` into `budgetLineFields` and `transactionFields` |
| `backend-nest/src/modules/budget/budget.calculator.ts` | Updated to use separate field parameters |
| `backend-nest/src/modules/budget/budget.service.ts` | Updated 2 usages of `fetchBudgetData()` |

## Test Results

- All 84 budget module tests pass
- Quality checks pass (only pre-existing warnings)
- The `/budgets` API now correctly returns `remaining` values

## Impact

This fix ensures that:
1. Budget list (`/api/v1/budgets`) returns correct `remaining` values for each budget
2. Budget details (`/api/v1/budgets/:id/details`) continues to work correctly
3. The envelope-aware expense calculation works properly across all API endpoints
