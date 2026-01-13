# Implementation Plan: Fix Backend Budget List Envelope Calculation

## Overview

The backend endpoint `GET /api/v1/budgets` returns incorrect `remaining` and `endingBalance` values because it uses the naive `BudgetFormulas.calculateTotalExpenses()` which double-counts allocated transactions.

**Strategy**: Move envelope-aware calculation logic to the shared package, then update the backend calculator to use it. This ensures frontend and backend use identical business logic.

## Dependencies

Order matters - earlier items must be completed before later ones:

1. **Shared package** must have envelope functions before backend can use them
2. **Backend repository** must fetch required fields before calculator can use them
3. **Shared package rebuild** required after changes (`pnpm build:shared`)

## File Changes

### Phase 1: Shared Package (Foundation)

#### `shared/src/calculators/budget-line-consumption.ts` (NEW FILE)

- Create new file with envelope consumption calculation logic
- Define `BudgetLineConsumption` interface matching frontend version:
  - `budgetLine: BudgetLine`
  - `consumed: number`
  - `remaining: number`
  - `allocatedTransactions: Transaction[]`
  - `transactionCount: number`
- Implement `calculateBudgetLineConsumption(budgetLine, allTransactions)` function
- Implement `calculateAllConsumptions(budgetLines, transactions)` function returning `Map<string, BudgetLineConsumption>`
- Skip virtual rollover lines (id starting with `rollover-`)
- Use `.js` extension in imports (ESM requirement per shared/README.md)
- Follow pattern from `frontend/projects/webapp/src/app/core/budget/budget-line-consumption.ts`

#### `shared/src/calculators/budget-formulas.ts`

- Add import for `calculateAllConsumptions` from `./budget-line-consumption.js`
- Add new static method `calculateTotalExpensesWithEnvelopes(budgetLines, transactions)`:
  - Calculate consumption map using `calculateAllConsumptions`
  - For each expense/saving budget line: use `Math.max(line.amount, consumption.consumed)` as effective amount
  - Add free transaction amounts (transactions without `budgetLineId`)
  - Return total
- Keep existing `calculateTotalExpenses()` for backward compatibility
- Consider: Interface needs `id` on budget lines and `budgetLineId` on transactions

#### `shared/src/calculators/index.ts`

- Add export for `calculateAllConsumptions` function
- Add export for `calculateBudgetLineConsumption` function
- Add export for `BudgetLineConsumption` type

#### `shared/index.ts`

- Add re-export for envelope functions from `./src/calculators/index.js`:
  - `calculateAllConsumptions`
  - `calculateBudgetLineConsumption`
  - `type BudgetLineConsumption`

### Phase 2: Shared Tests

#### `shared/src/calculators/budget-formulas.spec.ts`

- Add new `describe` block: `'calculateTotalExpensesWithEnvelopes'`
- Add test cases matching frontend tests from `current-month-store.spec.ts`:
  - Allocated within envelope (100/500) - only envelope amount counts
  - Multiple allocated within same envelope
  - Overage case (150/100) - consumed amount counts
  - User scenario (188/100 = 88 overage)
  - Mixed free + allocated transactions
  - Multiple envelopes with different states
  - Free income transaction - no impact on expenses
  - Empty arrays - returns 0
- Use helper function to create test data with required fields (id, budgetLineId)

### Phase 3: Backend Tests (TDD - Write First)

#### `backend-nest/src/modules/budget/budget.calculator.spec.ts` (NEW FILE)

- Create new test file for BudgetCalculator behavior tests
- Follow existing pattern from `budget.service.spec.ts` for mocking
- Import test utilities from `../../test/test-mocks`
- Mock `BudgetRepository.fetchBudgetData` to return controlled data
- Test `calculateEndingBalance()` with envelope scenarios:
  - Test: "when transactions are within envelope, should not increase expenses beyond envelope"
  - Test: "when transactions exceed envelope, should count the overage"
  - Test: "when transactions are free (no budgetLineId), should count full amount"
- Use business language in test descriptions
- These tests should FAIL initially (TDD approach)

#### `backend-nest/src/modules/budget/budget.service.spec.ts` (ENHANCE)

- Add new `describe` block for envelope allocation in `findAll`
- Test: "should return remaining that accounts for envelope coverage"
- Mock calculator to verify it's called and response is correct
- This test verifies the integration point

### Phase 4: Backend Implementation

#### `backend-nest/src/modules/budget/budget.calculator.ts`

- Line 8: Add import for `calculateTotalExpensesWithEnvelopes` from `pulpe-shared` (or import from BudgetFormulas)
- Line 34-38: Update `fetchBudgetData` call to request required fields:
  - Change from `{ selectFields: 'kind, amount' }`
  - To `{ selectFields: 'id, kind, amount, budget_line_id' }` (or use '*' for simplicity)
- Lines 44-47: Replace naive calculation with envelope-aware version:
  - Replace `BudgetFormulas.calculateTotalExpenses(budgetLines, transactions)`
  - With `BudgetFormulas.calculateTotalExpensesWithEnvelopes(budgetLines, transactions)`
- Consider: Map database snake_case `budget_line_id` to camelCase `budgetLineId` if needed

#### `backend-nest/src/modules/budget/budget.repository.ts` (VERIFY)

- Line 126: Default `selectFields = 'kind, amount'` is too limited
- Verify that when `selectFields = '*'` is used (lines 192, 397), all fields including `budget_line_id` are returned
- May need to add explicit field list for calculator use case

### Phase 5: Frontend Alignment (Optional but Recommended)

#### `frontend/projects/webapp/src/app/core/budget/budget-line-consumption.ts`

- Replace local implementation with re-export from shared:
  ```typescript
  export {
    calculateBudgetLineConsumption,
    calculateAllConsumptions,
    type BudgetLineConsumption,
  } from 'pulpe-shared';
  ```
- This ensures frontend and backend use identical code
- Consider: May need to test imports still work for existing consumers

#### `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

- Lines 175-200: Could simplify `totalExpenses` computed to use shared function:
  ```typescript
  return BudgetFormulas.calculateTotalExpensesWithEnvelopes(budgetLines, transactions);
  ```
- This ensures identical calculation between frontend computed and backend API
- Optional: Current implementation already correct, this is for consistency

## Testing Strategy

### Core Principle: Test BEHAVIOR, Not Implementation

Tests must verify the **business rule**, not implementation details. Test names should read like business requirements:

- GOOD: `"when a transaction is allocated within its envelope, should only count the envelope amount"`
- BAD: `"should call Math.max on envelope amount and consumed"`

### The Bug This Would Have Caught

Current (buggy) backend behavior:
```
totalExpenses = budgetLines + transactions = 500 + 100 = 600 ❌
```

Correct business behavior:
```
totalExpenses = max(envelope, consumed) = max(500, 100) = 500 ✓
```

A behavior test asserting `"expenses should be 500"` would have **immediately failed** with the current implementation returning `600`.

### Business Scenarios to Test

| Scenario | Setup | Expected Behavior | Would Catch Bug? |
|----------|-------|-------------------|------------------|
| Within envelope | Envelope 500€, spent 100€ | Expenses = 500€ | **YES** |
| Exceeds envelope | Envelope 100€, spent 150€ | Expenses = 150€ | No (already correct) |
| Free transaction | No envelope, spent 50€ | Expenses = 50€ | No (already correct) |
| Multiple in envelope | Envelope 500€, spent 200€+150€ | Expenses = 500€ | **YES** |
| Mixed scenario | Envelopes + free transactions | Sum of rules above | **YES** |

### Test Files

#### 1. `shared/src/calculators/budget-formulas.spec.ts` (ENHANCE)

Add behavior tests for the new `calculateTotalExpensesWithEnvelopes` function:

```
describe('Envelope allocation business rules', () => {
  describe('when transaction is allocated within its envelope', () => {
    it('should only count the envelope amount in total expenses')
    it('should not double-count the transaction amount')
  })

  describe('when transaction exceeds its envelope', () => {
    it('should count the actual consumed amount (overage)')
  })

  describe('when transaction has no envelope allocation (free)', () => {
    it('should count the full transaction amount directly')
  })

  describe('when multiple transactions are allocated to same envelope', () => {
    it('should sum transactions and compare to envelope once')
  })

  describe('with mixed envelope and free transactions', () => {
    it('should apply envelope rules to allocated and direct impact for free')
  })
})
```

#### 2. `backend-nest/src/modules/budget/budget.calculator.spec.ts` (NEW FILE)

Create integration tests for the calculator's behavior:

- Mock `BudgetRepository` to return controlled data
- Test `calculateEndingBalance()` with envelope scenarios
- Verify the calculator applies business rules correctly
- Use realistic data structures matching database schema

Test structure:
```
describe('BudgetCalculator', () => {
  describe('calculateEndingBalance', () => {
    describe('envelope allocation behavior', () => {
      it('when transactions are within envelope, should not increase expenses beyond envelope')
      it('when transactions exceed envelope, should count the overage')
      it('when transactions are free (no budgetLineId), should count full amount')
    })
  })
})
```

#### 3. `backend-nest/src/modules/budget/budget.service.spec.ts` (ENHANCE)

Add tests for `findAll()` that verify the response contains correct values:

```
describe('findAll', () => {
  describe('envelope allocation in remaining calculation', () => {
    it('should return remaining that accounts for envelope coverage')
    // This test would have caught the bug!
  })
})
```

### TDD Approach

1. **Write failing tests FIRST** that assert correct behavior
2. Run tests - they should **FAIL** with current implementation
3. Implement the fix
4. Run tests - they should **PASS**
5. Verify no regression in existing tests

### Existing Tests to Verify Still Pass

- `frontend/.../current-month-store.spec.ts` - 32 tests
- `shared/.../budget-formulas.spec.ts` - Existing tests
- `backend-nest/.../budget.service.spec.ts` - Existing tests

### Manual Verification

1. Start local stack: `pnpm dev`
2. Seed database: `supabase db reset` (in backend-nest)
3. Create budget with envelope and allocated transaction within envelope
4. Call `GET /api/v1/budgets`
5. Verify `remaining`/`endingBalance` reflect envelope logic (not double-counted)
6. Compare with frontend display (should match)

### Quality Checks

- Run `pnpm quality` before committing
- Rebuild shared: `pnpm build:shared`
- Run all tests: `pnpm test`

## Rollout Considerations

### Breaking Changes
- None - `calculateTotalExpenses()` remains for backward compatibility

### Data Requirements
- Transactions need `budget_line_id` field populated for envelope logic
- Budget lines need `id` field for consumption mapping
- Both fields already exist in database schema

### Migration
- No database migration needed
- Backend behavior changes for `/budgets` endpoint
- Frontend already uses correct logic via `CurrentMonthStore`

## Summary

| Phase | Files | Purpose |
|-------|-------|---------|
| 1 | `shared/src/calculators/*.ts` | Add envelope calculation to shared |
| 2 | `shared/src/calculators/*.spec.ts` | Add behavior tests for envelope logic |
| 3 | `backend-nest/**/*.spec.ts` | Add backend behavior tests (TDD - write first, expect failures) |
| 4 | `backend-nest/src/modules/budget/*.ts` | Implement fix using shared envelope calculation |
| 5 | `frontend/**/*.ts` | (Optional) Re-export from shared for consistency |

### Test-Driven Development Flow

```
Phase 3: Write tests → Tests FAIL (expected)
Phase 4: Implement fix → Tests PASS (goal achieved)
```

**Estimated impact**: `/api/v1/budgets` will return correct `remaining` and `endingBalance` values that account for envelope allocation rules. Behavior tests will prevent future regressions.
