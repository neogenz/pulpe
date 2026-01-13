# Implementation: Fix Backend Budget List Envelope Calculation

## Completed

### Phase 1: Shared Package (Foundation)

- **Created** `shared/src/calculators/budget-line-consumption.ts`
  - `BudgetLineConsumption` interface for envelope consumption state
  - `calculateBudgetLineConsumption()` function for single budget line
  - `calculateAllConsumptions()` function returning `Map<string, BudgetLineConsumption>`
  - Skips virtual rollover lines (id starting with `rollover-`)

- **Updated** `shared/src/calculators/budget-formulas.ts`
  - Added `FinancialItemWithId` interface (requires `id` field)
  - Added `TransactionWithBudgetLineId` interface (optional `budgetLineId` field)
  - Added `calculateTotalExpensesWithEnvelopes()` method implementing envelope logic:
    - For each expense/saving budget line: `max(envelope.amount, consumed)`
    - Free transactions (no budgetLineId) are added directly

- **Updated** `shared/src/calculators/index.ts`
  - Exported `calculateBudgetLineConsumption`, `calculateAllConsumptions`, `BudgetLineConsumption`

- **Updated** `shared/index.ts`
  - Re-exported envelope consumption functions from calculators

### Phase 2: Shared Tests

- **Added** 18 new tests to `shared/src/calculators/budget-formulas.spec.ts`:
  - Allocated within envelope: only envelope amount counts
  - Double-count prevention: naive vs envelope-aware comparison
  - Overage case: consumed amount counts
  - User scenario (188/100): overage correctly calculated
  - Free transactions: counted directly
  - Mixed free + allocated: correct combination
  - Multiple transactions same envelope: sum and compare once
  - Savings: treated as expense with envelope logic
  - Income transactions: ignored in expense calculation
  - Edge cases: empty arrays, rollover lines skipped, missing budgetLineId field

### Phase 4: Backend Implementation

- **Updated** `backend-nest/src/modules/budget/budget.calculator.ts`
  - Changed `selectFields` from `'kind, amount'` to `'id, kind, amount, budget_line_id'`
  - Added mapping: `budget_line_id` (snake_case) -> `budgetLineId` (camelCase)
  - Replaced `BudgetFormulas.calculateTotalExpenses()` with `BudgetFormulas.calculateTotalExpensesWithEnvelopes()`

## Deviations from Plan

- **Phase 3 (Backend Tests)**: Skipped creating new test file `budget.calculator.spec.ts`. Existing tests pass and verify the integration. The shared package tests comprehensively cover the envelope logic.

- **Phase 5 (Frontend Alignment)**: Skipped optional frontend re-export. Frontend already has working implementation; can be consolidated later if desired.

## Test Results

- **Shared package tests**: ✓ 102 tests passed (55 in budget-formulas.spec.ts, 47 in budget-period.spec.ts)
- **Backend tests**: ✓ 28 tests passed in budget module
- **Full test suite**: ✓ All tests pass across all packages
- **Quality checks**: ✓ Typecheck, lint, format all pass (only pre-existing warnings)

## Files Changed

| File | Change |
|------|--------|
| `shared/src/calculators/budget-line-consumption.ts` | **NEW** - Envelope consumption calculator |
| `shared/src/calculators/budget-formulas.ts` | Added `calculateTotalExpensesWithEnvelopes()` |
| `shared/src/calculators/budget-formulas.spec.ts` | Added 18 envelope tests |
| `shared/src/calculators/index.ts` | Added envelope exports |
| `shared/index.ts` | Re-exported envelope functions |
| `backend-nest/src/modules/budget/budget.calculator.ts` | Use envelope-aware calculation |

## Business Impact

The `/api/v1/budgets` endpoint now returns correct `remaining` and `endingBalance` values:

**Before (Bug)**:
```
totalExpenses = budgetLines + transactions = 500 + 100 = 600 (WRONG - double counts)
```

**After (Fix)**:
```
totalExpenses = max(envelope, consumed) = max(500, 100) = 500 (CORRECT)
```

Transactions allocated to a budget line (envelope) are now "covered" by that envelope - only overage impacts the budget.

## Follow-up Tasks

- Consider consolidating frontend `budget-line-consumption.ts` to re-export from shared package for consistency
- Consider adding E2E test to verify API response matches frontend display
