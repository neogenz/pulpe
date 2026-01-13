# Task: Improve Error Handling in hasBudgetGuard

## Problem

The `hasBudgetGuard` catch block silently redirects ALL errors to `/complete-profile`, including temporary network errors. This causes a confusing redirect loop:

1. User with existing budgets navigates to dashboard
2. Network error during `getAllBudgets$()` call
3. Guard catches error, redirects to `/complete-profile`
4. Complete-profile page (if it checked API) finds budgets, redirects back to dashboard
5. User sees confusing redirect loop

The guard doesn't distinguish between "user has no budgets" and "API temporarily unavailable."

## Proposed Solution

Add proper error type handling with retry logic:
1. Add RxJS `retry` operator to handle transient failures
2. Distinguish network errors (status 0, 500+) from business errors
3. For network/server errors: let the route proceed and let the component handle displaying errors
4. For other errors (validation, etc.): keep current redirect behavior

This follows the pattern already established in `demo-initializer.service.ts:104-119`.

## Dependencies

- **Task 1**: Remove double API call (should understand the guard/complete-profile flow first)

## Context

- Current catch block at `has-budget.guard.ts:27-31` redirects on ANY error
- No dedicated error route exists in the application
- Pattern for error handling exists at `demo-initializer.service.ts:104-119` with HttpErrorResponse status checks
- RxJS `retry` operator can be used with `{ count: 2, delay: 1000 }`

Key files:
- `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts:18-31`
- `frontend/projects/webapp/src/app/core/auth/has-budget.guard.spec.ts`
- Pattern: `frontend/projects/webapp/src/app/core/demo/demo-initializer.service.ts:104-119`

## Success Criteria

- Guard retries API call twice with 1s delay before giving up
- Network errors (status 0) return `true` instead of redirecting
- Server errors (status 500+) return `true` instead of redirecting
- Validation/business errors still redirect to complete-profile
- Tests added for network error, server error, and retry scenarios
- Manual test: simulate offline in DevTools, no redirect loop occurs
