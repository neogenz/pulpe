# Task: Add Unit Tests for Period Calculation Functions

## Problem

The new `getBudgetPeriodDates()` and `formatBudgetPeriod()` functions need comprehensive test coverage to ensure the quinzaine logic works correctly across all edge cases.

## Proposed Solution

Add test cases to `shared/src/calculators/budget-period.spec.ts`:

**Tests for `getBudgetPeriodDates()`:**
1. Standard calendar behavior (payDay=1 or null)
2. First quinzaine scenarios (payDay <= 15)
3. Second quinzaine scenarios (payDay > 15)
4. Boundary cases (payDay=15 vs payDay=16)
5. Year transitions (January budget with payDay > 15)
6. Month-end edge cases:
   - payDay=30 with February (should clamp to 28/29)
   - payDay=31 with April (should clamp to 30)
7. Leap year handling

**Tests for `formatBudgetPeriod()`:**
1. French locale formatting verification
2. Various payDay values with expected output strings
3. Year transition formatting (spanning December to January)
4. Null/undefined payDay handling

## Dependencies

- Task 1: Add Period Calculation Functions (must be completed first)

## Context

- Test file: `shared/src/calculators/budget-period.spec.ts`
- Test framework: Vitest with `describe`, `it`, `expect`
- Pattern: AAA (Arrange, Act, Assert) with blank line separators
- Existing tests: 68+ test cases for related functions
- Run tests: `cd shared && pnpm test`

## Success Criteria

- All quinzaine scenarios covered with explicit test cases
- Edge cases tested: February, year transitions, month-end clamping
- Test names follow pattern: `should + expected behavior`
- All tests pass: `pnpm test` in shared directory
- No regression on existing `getBudgetPeriodForDate()` tests
