# Implementation: Fix Envelope Allocated Expense Budget Regression

## Completed

- Added import for `calculateAllConsumptions` from `@core/budget`
- Rewrote `totalExpenses` computed signal in `CurrentMonthStore` with envelope-aware logic
- Aligned dashboard calculations with `BudgetFinancialOverview` pattern

## Changes Made

### `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

**Lines 3, 167-200**

1. Added `calculateAllConsumptions` to the `@core/budget` import
2. Replaced the naive `BudgetFormulas.calculateTotalExpenses()` call with envelope-aware logic:
   - Calculate consumption map using `calculateAllConsumptions(budgetLines, transactions)`
   - For each expense/saving budget line: use `Math.max(line.amount, consumption.consumed)` as effective amount
   - Add free transaction amounts (transactions without `budgetLineId`)

## Business Rule Implemented

```
Les transactions ALLOUÉES sont "couvertes" par leur enveloppe
- Seul le DÉPASSEMENT (consumed > envelope.amount) impacte le budget
- Les transactions LIBRES impactent directement le budget
```

## Deviations from Plan

None. The implementation followed the plan exactly.

## Test Results

- Typecheck: ✓
- Lint: ✓
- Format: ✓
- Tests: ✓ All 32 tests pass in `current-month-store.spec.ts`

### Envelope Allocation Tests (previously failing, now passing)

| Test Case | Expected | Result |
|-----------|----------|--------|
| Allocated within envelope (100/500) | 4500 | ✓ |
| Multiple allocated within (400/500) | 4500 | ✓ |
| Overage only (150/100) | 4850 | ✓ |
| User scenario (188/100 = 88 overage) | 812 | ✓ |
| Mixed free + allocated | 4450 | ✓ |
| Multiple envelopes (one overage) | 4150 | ✓ |
| Free income transaction | 4600 | ✓ |

## Follow-up Tasks

### E2E Test Coverage (Deferred)

E2E tests were attempted but deferred due to infrastructure issues:

1. **Preparatory work completed:**
   - Added `data-testid="remaining-amount"` to `budget-progress-bar.ts:67`
   - Added `data-testid="expenses-amount"` to `budget-progress-bar.ts:58`
   - Updated `CurrentMonthPage` page object with helper methods

2. **Issue encountered:**
   - The existing E2E mock infrastructure in `auth-bypass.ts` returns invalid budget data (wrong schema, missing `success: true`, snake_case fields)
   - This causes Zod validation to fail when the frontend tries to parse the response

3. **Recommendation:**
   - Fix `test-config.ts` and `api-responses.ts` to return properly structured budget data
   - Then add E2E tests for envelope allocation scenarios

The unit tests (32 tests in `current-month-store.spec.ts`) provide comprehensive coverage of the envelope allocation logic.
