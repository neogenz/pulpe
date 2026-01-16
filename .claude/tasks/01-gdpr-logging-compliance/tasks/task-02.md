# Task: Remove Financial Data from Business Logs

## Problem

The `persistEndingBalance` method in `BudgetCalculator` logs the `endingBalance` value when recalculating budgets. Financial amounts are sensitive personal data under GDPR and should not be logged, even in structured logs.

## Proposed Solution

Remove the `endingBalance` field from the log context in `persistEndingBalance`. Keep the `budgetId` for traceability - this provides enough context for debugging without exposing financial data.

## Dependencies

- None (independent of Task 1, can be done in parallel)

## Context

- **Target file**: `backend-nest/src/modules/budget/budget.calculator.ts:194-201`
- **Current log**: Contains `{ budgetId, endingBalance, operation: 'balance.recalculated' }`
- **After change**: Should contain `{ budgetId, operation: 'balance.recalculated' }`
- **Rationale**: The log message describes the action, the `budgetId` provides traceability for debugging

## Success Criteria

- `endingBalance` no longer appears in log output
- `budgetId` and `operation` fields preserved
- No functional changes to balance calculation logic
- `pnpm quality` passes
