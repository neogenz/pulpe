# Task: Remove Double API Call for Budget Check

## Problem

When a user is redirected by `hasBudgetGuard` to `/complete-profile`, there are 2 identical API calls to `getAllBudgets$()` within milliseconds:
1. First call in `hasBudgetGuard` (line 19)
2. Second call in `CompleteProfilePage` constructor via `checkExistingBudgets()` (line 199)

This is wasteful and unnecessary since the guard already verified the user has no budgets.

## Proposed Solution

Remove the redundant budget check from `CompleteProfilePage`. Since the route is protected by `authGuard` and the guard already confirmed no budgets exist, the component doesn't need to re-verify.

Key changes:
- Remove the constructor call and `#checkExistingBudgetsAndRedirect()` method from the component
- Update the store's initial state to reflect that no check is needed
- Update related tests

## Dependencies

- None (can start immediately)

## Context

- Route configuration at `app.routes.ts:47-52` confirms complete-profile is intentionally WITHOUT `hasBudgetGuard` (comment: "would cause infinite loop")
- The guard at `has-budget.guard.ts:19` already calls `getAllBudgets$()`
- The component at `complete-profile-page.ts:199` calls same API again in constructor

Key files:
- `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts:198-208`
- `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts:31`
- `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.spec.ts:74-75`

Pattern: Component doesn't need to validate what guard already validated.

## Success Criteria

- Only ONE `getAllBudgets$()` call visible in Network tab when navigating to complete-profile
- No regression in user flow (new users still see complete-profile, existing users are redirected)
- Test `complete-profile-store.spec.ts` passes after updating initial state expectation
- No loading spinner shown unnecessarily in complete-profile page
