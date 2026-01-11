# Implementation: Fix 4 Important Issues (5, 6, 7, 8)

## Completed

### Issue 5: Remove Double API Call
- **Removed** constructor and `#checkExistingBudgetsAndRedirect()` method from `complete-profile-page.ts`
- **Changed** initial state `isCheckingExistingBudget` from `true` to `false` in `complete-profile-store.ts`
- **Updated** test expectation in `complete-profile-store.spec.ts`

### Issue 7: Improve Error Handling in hasBudgetGuard
- **Added** imports: `HttpErrorResponse`, `retry`, `timer`, `Logger`
- **Implemented** retry logic with 2 retries and 1 second delay
- **Differentiated** error types:
  - Network errors (status 0) and server errors (status >= 500): Return `true` (allow navigation)
  - Other errors: Redirect to complete-profile
- **Added** 4 new test cases for error handling

### Issue 6: Fix Race Condition in Product Tour
- **Added** `isReady()` public method to check authentication status
- **Modified** `#getTourKey()` to return `null` when user not authenticated
- **Implemented** graceful degradation:
  - `hasSeenIntro()` / `hasSeenPageTour()`: Return `true` when not ready (don't show tour)
  - `startPageTour()`: Early return when not ready
  - `resetAllTours()`: Early return when not ready
- **Added** 6 new test cases for auth readiness and graceful degradation

### Issue 8: Extract Turnstile Logic to Service
- **Created** `frontend/projects/webapp/src/app/core/turnstile/` folder with:
  - `turnstile.service.ts`: Main service with all Turnstile logic
  - `turnstile.service.spec.ts`: 14 test cases
  - `index.ts`: Barrel export
- **Refactored** `welcome-page.ts`:
  - Reduced from 349 lines to 228 lines (under 300 limit)
  - Extracted all Turnstile-related state and methods
  - Uses callback-based API from service
- **Updated** `welcome-page.spec.ts` to use mocked `TurnstileService`

## Deviations from Plan

- **Issue 8**: Used callback-based API (`onToken`, `onError`) instead of Observable pattern for simpler integration

## Test Results

- Typecheck: ✓
- Lint: ✓
- Format: ✓
- Tests: ✓
  - `has-budget.guard.spec.ts`: 6 tests passed
  - `product-tour.service.spec.ts`: 17 tests passed
  - `turnstile.service.spec.ts`: 14 tests passed
  - `welcome-page.spec.ts`: 12 tests passed
  - `complete-profile-store.spec.ts`: 17 tests passed

## Files Changed

| File | Change Type |
|------|-------------|
| `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts` | Modified |
| `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts` | Modified |
| `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.spec.ts` | Modified |
| `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts` | Modified |
| `frontend/projects/webapp/src/app/core/auth/has-budget.guard.spec.ts` | Modified |
| `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.ts` | Modified |
| `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.spec.ts` | Modified |
| `frontend/projects/webapp/src/app/core/turnstile/turnstile.service.ts` | Created |
| `frontend/projects/webapp/src/app/core/turnstile/turnstile.service.spec.ts` | Created |
| `frontend/projects/webapp/src/app/core/turnstile/index.ts` | Created |
| `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts` | Modified |
| `frontend/projects/webapp/src/app/feature/welcome/welcome-page.spec.ts` | Modified |

## Follow-up Tasks

None identified.
