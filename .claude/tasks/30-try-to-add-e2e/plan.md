# Implementation Plan: Fix E2E Infrastructure + Add Envelope Allocation Tests

## Overview

Fix the E2E mock infrastructure to align with Zod schemas from `shared/schemas.ts`, then add 5 E2E tests for envelope allocation business logic.

**Root causes:**
1. Mock data uses snake_case instead of camelCase
2. Missing required fields (`userId`, `templateId`, `createdAt`, `updatedAt`)
3. Missing `success: true` in response wrappers
4. Dynamic `userId` causes mismatches between config and mocks

## Dependencies

Order of changes matters:
1. `test-config.ts` (defines constants used by other files)
2. `api-responses.ts` (uses test-config, consumed by auth-bypass)
3. `auth-bypass.ts` (uses api-responses)
4. New test file (depends on all above being correct)

---

## File Changes

### `frontend/e2e/config/test-config.ts`

- **Action 1**: Change `USER.ID` from dynamic to static UUID
  - Current: `'e2e-test-user-' + Date.now()` (line 14)
  - Change to: `'e2e-test-user-00000000-0000-0000-0000-000000000001'`
  - Reason: Budget mocks must reference consistent userId

- **Action 2**: Change `USER.EMAIL` from dynamic to static
  - Current: `` `e2e-test-${Date.now()}@pulpe.local` `` (line 15)
  - Change to: `'e2e-test@pulpe.local'`

- **Action 3**: Change `TOKENS.ACCESS` and `TOKENS.REFRESH` from dynamic to static
  - Reason: Consistency across test runs

- **Action 4**: Replace `BUDGETS.CURRENT_MONTH` with correct schema (lines 26-35)
  - Add: `userId`, `templateId`, `description`, `endingBalance`, `createdAt`, `updatedAt`
  - Remove: `total_income`, `total_expenses`, `available_to_spend` (not in schema)
  - Use camelCase throughout
  - Reference `TEST_CONFIG.USER.ID` for userId
  - Reference `TEST_CONFIG.TEMPLATES.DEFAULT.id` for templateId

- **Action 5**: Fix `TEMPLATES.DEFAULT` to use camelCase
  - Change `is_default` to `isDefault`

- **Action 6**: Update TypeScript types to match new shapes

### `frontend/e2e/mocks/api-responses.ts`

- **Action 1**: Update `MockBudgetResponse` interface (lines 22-31)
  - Add `success: true` property
  - Change `data` array item type to match `budgetSchema`:
    - `id`, `userId`, `templateId`, `month`, `year`, `description`
    - `endingBalance`, `rollover`, `remaining`, `createdAt`, `updatedAt`
  - Remove: `total_income`, `total_expenses`, `available_to_spend`

- **Action 2**: Add `MockBudgetDetailsResponse` interface
  - Structure: `{ success: true, data: { budget, transactions, budgetLines } }`
  - Follow `budgetDetailsResponseSchema` from shared/schemas.ts:527-534

- **Action 3**: Update `createMockBudgetResponse()` (lines 81-83)
  - Add `success: true` to returned object
  - Data will automatically use fixed TEST_CONFIG

- **Action 4**: Add `createMockBudgetDetailsResponse()` factory function
  - Return valid budget details with empty transactions/budgetLines arrays
  - This provides a default that tests can override

- **Action 5**: Add to `MOCK_API_RESPONSES` object (line 116+)
  - Add `budgetDetails: createMockBudgetDetailsResponse()`

### `frontend/e2e/utils/auth-bypass.ts`

- **Action 1**: Add budget details mock handler (after line 79)
  - Match pattern: `url.includes('budgets') && url.includes('/details')`
  - Return `MOCK_API_RESPONSES.budgetDetails`
  - Place BEFORE the existing budget list check (more specific route first)

- **Action 2**: Reorder budget route handlers
  - Current order processes `/budgets` before `/budgets/*/details`
  - Move details handler to check first

### `frontend/e2e/helpers/api-mocks.ts` (EXTEND EXISTING)

- **Action 1**: Add `createTransactionMock()` helper function
  - Parameters: `(id: string, budgetId: string, overrides?: Partial<Transaction>)`
  - Return valid `Transaction` object with defaults
  - Follow same pattern as existing `createBudgetLineMock()`

### `frontend/e2e/tests/features/envelope-allocation.spec.ts` (NEW FILE)

- **Action 1**: Create new test file with describe block
  - Import fixtures: `test`, `expect` from `../../fixtures/test-fixtures`
  - Import EXISTING helpers: `createBudgetDetailsMock`, `createBudgetLineMock`, `createTransactionMock`, `TEST_UUIDS` from `../../helpers/api-mocks`

- **Action 2**: Implement test: "allocated transaction within envelope should NOT reduce remaining budget"
  - Setup: Income 5000, Envelope 500 (expense), Allocated transaction 100
  - Mock budget details with this data
  - Expected: Remaining = 4500 (income - envelope)
  - Assert: `expectRemainingAmount('4500')` or `expectRemainingAmount("4'500")`

- **Action 3**: Implement test: "allocated transaction exceeding envelope should only count overage"
  - Setup: Income 5000, Envelope 100, Allocated transaction 150
  - Expected: Remaining = 4850 (5000 - 100 - 50 overage)
  - Assert via page object

- **Action 4**: Implement test: "mixed free and allocated transactions should be calculated correctly"
  - Setup: Envelope 500 + allocated 200 + free 50
  - Expected: Expenses = 550 (500 envelope + 50 free)
  - Assert via `expectExpensesAmount()`

- **Action 5**: Implement test: "should calculate overage correctly when allocated exceeds envelope"
  - Setup: Envelope 100, Allocated 188
  - Expected: Expenses includes 188 (not just 100)
  - Business rule: `Math.max(envelope.amount, consumed)`

- **Action 6**: Implement test: "multiple envelopes with different states"
  - Setup: Envelope1 500/300 allocated + Envelope2 200/350 allocated
  - Expected: Expenses = 850 (500 + 200 + 150 overage from Envelope2)

### `frontend/e2e/pages/current-month.page.ts`

- **Action 1**: Verify `data-testid` attributes exist (already done per explore.md)
  - `expenses-amount` - exists
  - `remaining-amount` - exists

- **Action 2**: Add `waitForBudgetData()` method if needed
  - Wait for budget-related elements to be visible before assertions
  - Helps with flaky tests due to async loading

---

## Testing Strategy

**New tests to create:**
- `frontend/e2e/tests/features/envelope-allocation.spec.ts` (5 tests)

**Existing tests to verify:**
- `frontend/e2e/tests/features/monthly-budget-management.spec.ts`
  - Run after mock fixes to ensure no regressions
  - Tests at lines 42-75 use budget mocks that will change

**Manual verification:**
1. Run `pnpm test:e2e` from frontend directory
2. Verify all existing tests still pass
3. Verify new envelope allocation tests pass
4. Check for Zod validation errors in test output

---

## Stability Analysis (Verified)

**Existing tests are PROTECTED:**
- All feature tests override routes with `page.route()` and use `helpers/api-mocks.ts`
- The helpers (`createBudgetDetailsMock`, `createBudgetLineMock`) are already Zod-compliant
- Changes to `test-config.ts` and `api-responses.ts` only affect DEFAULT mocks in `auth-bypass.ts`

**Zod validation flow confirmed:**
- `BudgetApi.getAllBudgets$()` → `budgetListResponseSchema.parse()` (line 85)
- `BudgetApi.getBudgetWithDetails$()` → `budgetDetailsResponseSchema.parse()` (line 115)
- Invalid mocks throw ZodError, caught by `catchError()` handler

**Business logic verified:**
- `totalExpenses = Σ(Math.max(envelope, consumed)) + Σ(freeTransactions)`
- Located in `current-month-store.ts:175-200`
- Calculation depends on `budgetLines` and `transactions` from mock

## Rollout Considerations

**No breaking changes expected:**
- Tests using `helpers/api-mocks.ts` are unaffected
- Only tests relying on DEFAULT mocks (without custom routes) will benefit from fixes

**Test isolation:**
- Each new test should set up its own specific budget details mock
- Use existing `helpers/api-mocks.ts` helpers for consistency

**Swiss number formatting:**
- Remaining/expenses displayed as `"4'500.00"` format
- Use flexible assertions that handle locale formatting

---

## Summary

| Step | File | Complexity |
|------|------|------------|
| 1 | `test-config.ts` | Low - data changes only |
| 2 | `api-responses.ts` | Medium - add interface + factory |
| 3 | `auth-bypass.ts` | Low - add route handler |
| 4 | `envelope-allocation.spec.ts` | Medium - 5 new tests |
| 5 | Verify existing tests | Low - run and check |
