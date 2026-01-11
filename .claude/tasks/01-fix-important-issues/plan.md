# Implementation Plan: Fix 4 Important Issues (5, 6, 7, 8)

## Overview

This plan addresses 4 frontend issues in dependency order:
1. **Issue 5**: Remove double API call for budget check
2. **Issue 7**: Improve error handling in hasBudgetGuard (depends on understanding Issue 5)
3. **Issue 6**: Fix race condition in Product Tour service
4. **Issue 8**: Extract Turnstile logic from welcome-page.ts to dedicated service

**Strategy**: Fix issues in order of complexity and dependency. Issues 5 and 7 both touch the same guard/store files, so they're grouped. Issue 8 is independent and can be done last.

---

## Dependencies

| Issue | Depends On | Files Shared |
|-------|------------|--------------|
| Issue 5 | None | complete-profile-page.ts, complete-profile-store.ts |
| Issue 7 | Issue 5 | has-budget.guard.ts (both touch error handling logic) |
| Issue 6 | None | product-tour.service.ts |
| Issue 8 | None | welcome-page.ts |

---

## File Changes

### Issue 5: Remove Double API Call

#### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts`

- **Remove** lines 198-208: Delete the constructor and `#checkExistingBudgetsAndRedirect()` method entirely
- **Rationale**: The guard already checks for budgets before allowing navigation to this page. The comment at `app.routes.ts:47` confirms complete-profile is intentionally without hasBudgetGuard to avoid infinite loops
- **Keep**: `onSubmit()` method unchanged (lines 210-216)
- **Result**: Component will be ~15 lines shorter, no more double API call

#### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts`

- **Modify** line 31 in `createInitialState()`: Change `isCheckingExistingBudget: true` to `isCheckingExistingBudget: false`
- **Keep**: The `checkExistingBudgets()` method (lines 101-126) for potential future use or testing, but it won't be called from the component
- **Consider**: If method is truly unused, mark with `@deprecated` comment for future cleanup

#### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.spec.ts`

- **Modify** lines 74-75: Update test "should be checking existing budget initially" to expect `false` instead of `true`
- **Keep**: All `checkExistingBudgets` tests (lines 87-130) - they test the method in isolation, which is still valid

---

### Issue 7: Improve Error Handling in hasBudgetGuard

#### `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts`

- **Add import** at top: `import { HttpErrorResponse } from '@angular/common/http';`
- **Add import**: `import { retry, catchError } from 'rxjs';` and `import { of } from 'rxjs';`
- **Modify** lines 18-31: Replace simple try-catch with retry logic:
  1. Add retry operator with `{ count: 2, delay: 1000 }` to `getAllBudgets$()` call
  2. In catch block, distinguish error types following pattern from `demo-initializer.service.ts:104-119`:
     - `status === 0`: Network error - log warning, return `true` (let route proceed, component will show its own error)
     - `status >= 500`: Server error - same behavior
     - Other errors: Keep current redirect to complete-profile
- **Add**: Import `Logger` and inject it to log network errors
- **Pattern reference**: Follow `demo-initializer.service.ts:104-119` for HttpErrorResponse handling

#### `frontend/projects/webapp/src/app/core/auth/has-budget.guard.spec.ts`

- **Add test** after line 80: "should return true on network error (status 0)" - verify guard returns true instead of redirecting
- **Add test**: "should return true on server error (status 500+)" - same behavior
- **Add test**: "should retry on transient errors before failing"
- **Update** existing test "should redirect to complete-profile on API error" (line 65): Specify it's for non-network errors (e.g., validation errors, 4xx responses)

---

### Issue 6: Fix Race Condition in Product Tour

#### `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.ts`

- **Modify** method `#getTourKey()` (lines 51-57):
  1. Make userId required - throw error if not available instead of returning fallback key
  2. This ensures tour keys are ALWAYS user-specific, preventing the race condition
  3. Error: `throw new Error('ProductTourService: Cannot generate tour key - user not authenticated');`

- **Add** public method `isReady(): boolean`:
  1. Returns `!!this.#authApi.currentUser?.id`
  2. Components should call this before starting tours

- **Modify** public methods `hasSeenIntro()`, `hasSeenPageTour()`, `startPageTour()`:
  1. Add early return if `!this.isReady()`:
     - `hasSeenIntro()` / `hasSeenPageTour()`: Return `true` (assume seen = don't show tour if not ready)
     - `startPageTour()`: Return early without starting tour
  2. This provides graceful degradation instead of throwing

- **Consider**: Add migration logic to convert any existing generic keys (`pulpe-tour-{tourId}`) to user-specific keys on first access with valid userId (optional, for existing users)

#### `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.spec.ts`

- **Update** test at line 153-162 "should use fallback key when no user is logged in":
  - Change expectation: Service should return `true` for `hasSeenIntro()` (not start tour) when user is not logged in
  - Or: Service should throw/warn when trying to generate key without userId

- **Add test**: "should be ready when currentUser.id is available"
- **Add test**: "should not be ready when currentUser is null"
- **Add test**: "should not start tour when not ready"
- **Add test**: "should return true for hasSeenPageTour when not ready (graceful degradation)"

---

### Issue 8: Extract Turnstile Logic to Service

#### Create folder: `frontend/projects/webapp/src/app/core/turnstile/`

#### `frontend/projects/webapp/src/app/core/turnstile/turnstile.service.ts` (NEW)

- **Create** service following pattern from `demo-initializer.service.ts`:
  ```
  @Injectable({ providedIn: 'root' })
  export class TurnstileService {
    // Injected dependencies
    readonly #config = inject(ApplicationConfiguration);
    readonly #logger = inject(Logger);

    // Constants
    readonly #TIMEOUT_MS = 5000;

    // Private state
    #timeoutId: ReturnType<typeof setTimeout> | null = null;
    #resolutionHandled = false;

    // Signals
    readonly #isProcessing = signal(false);
    readonly #shouldRender = signal(false);

    // Public readonly signals
    readonly isProcessing = this.#isProcessing.asReadonly();
    readonly shouldRender = this.#shouldRender.asReadonly();

    // Computed
    readonly siteKey = computed(() => this.#config.turnstile().siteKey);
    readonly shouldUseTurnstile = computed(() => !this.#config.isLocal());

    // Public methods
    startVerification(widget: NgxTurnstileComponent | undefined): void { ... }
    handleResolved(token: string | null): string | null { ... }
    handleError(): void { ... }
    isSafariIOS(): boolean { ... }
    reset(): void { ... }

    // Private helpers
    #clearTimeout(): void { ... }
    #handleTimeout(): void { ... }
  }
  ```
- **Extract** from `welcome-page.ts`:
  - Constant `#TURNSTILE_TIMEOUT_MS` (line 208)
  - State `#turnstileTimeoutId` (line 209)
  - State `#turnstileResolutionHandled` (line 210)
  - Signal `shouldRenderTurnstile` (line 230)
  - Computed `turnstileSiteKey` (lines 223-225)
  - Computed `shouldUseTurnstile` (lines 226-228)
  - Method `onTurnstileResolved()` (lines 268-287) → `handleResolved()`
  - Method `onTurnstileError()` (lines 289-296) → `handleError()`
  - Method `#isSafariIOS()` (lines 355-369)
  - Method `#handleTurnstileTimeout()` (lines 371-381)
  - Method `#clearTurnstileTimeout()` (lines 383-388)
- **Keep in component**: The signal `isTurnstileProcessing` (line 215) since it's used in computed `isDemoLoading`

#### `frontend/projects/webapp/src/app/core/turnstile/turnstile.service.spec.ts` (NEW)

- **Create** tests following pattern from `product-tour.service.spec.ts`:
  - Test `isProcessing` signal state changes
  - Test `shouldRender` signal state changes
  - Test `isSafariIOS()` detection logic
  - Test `handleResolved()` with valid token
  - Test `handleResolved()` with null token
  - Test `handleError()` resets state
  - Test timeout behavior
  - Test E2E bypass path (if applicable)

#### `frontend/projects/webapp/src/app/core/turnstile/index.ts` (NEW)

- **Create** barrel export: `export { TurnstileService } from './turnstile.service';`

#### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts`

- **Add import**: `import { TurnstileService } from '@core/turnstile';`
- **Inject** service: `readonly #turnstileService = inject(TurnstileService);`
- **Remove**:
  - Lines 197-210: Error messages constant `#ERROR_MESSAGES` → Keep only GOOGLE_AUTH_FAILED and DEMO_INIT_FAILED (others move to service)
  - Line 208: `#TURNSTILE_TIMEOUT_MS`
  - Lines 209-210: `#turnstileTimeoutId`, `#turnstileResolutionHandled`
  - Line 230: `shouldRenderTurnstile` signal
  - Lines 223-228: `turnstileSiteKey` and `shouldUseTurnstile` computed
  - Lines 268-296: `onTurnstileResolved()` and `onTurnstileError()` methods
  - Lines 355-388: `#isSafariIOS()`, `#handleTurnstileTimeout()`, `#clearTurnstileTimeout()` methods
- **Modify** template (lines 125-134):
  - Replace `shouldRenderTurnstile()` with `#turnstileService.shouldRender()`
  - Replace `shouldUseTurnstile()` with `#turnstileService.shouldUseTurnstile()`
  - Replace `turnstileSiteKey()` with `#turnstileService.siteKey()`
  - Replace `(resolved)` handler with call to service
  - Replace `(errored)` handler with call to service
- **Modify** `startDemoMode()` method (lines 298-336):
  - Replace direct Turnstile logic with service calls
  - Call `#turnstileService.startVerification(this.turnstileWidget())`
  - Update to use service signals for state management
- **Result**: Component should be ~270 lines (under 300 limit)

#### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.spec.ts`

- **Update** any tests that mock Turnstile-related behavior
- **Add** mock for TurnstileService
- **Verify** existing tests still pass after refactoring

---

## Testing Strategy

### Tests to Create

| File | Purpose |
|------|---------|
| `turnstile.service.spec.ts` | New service tests |

### Tests to Update

| File | Changes |
|------|---------|
| `complete-profile-store.spec.ts` | Update initial state test (line 74-75) |
| `has-budget.guard.spec.ts` | Add network error tests |
| `product-tour.service.spec.ts` | Update auth readiness tests |
| `welcome-page.spec.ts` | Add TurnstileService mock |

### Manual Verification

1. **Issue 5**: Navigate to `/app/current-month` as new user, verify only ONE getAllBudgets call in Network tab
2. **Issue 6**: Open app in incognito, verify product tour only shows after auth is fully loaded
3. **Issue 7**: Simulate network offline in DevTools, navigate to protected route, verify no redirect loop
4. **Issue 8**: Verify demo mode still works on welcome page after refactoring

---

## Documentation

No documentation changes required. Changes are internal refactoring.

---

## Rollout Considerations

1. **No breaking changes**: All changes are internal, no API/route changes
2. **No migration needed**: User-specific tour keys already exist for authenticated users
3. **Backward compatible**: Existing generic tour keys will be treated as "seen" (graceful degradation in Issue 6)
4. **Feature flags**: None needed, changes are safe to deploy together

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Issue 5: Regression if route accessed directly | Low | Medium | Route protected by authGuard chain |
| Issue 6: Tour never shows if auth slow | Low | Low | Tour will show on next page load |
| Issue 7: User sees error in component | Medium | Low | Better than redirect loop |
| Issue 8: Service injection order | Low | Low | providedIn: 'root' ensures singleton |

---

## Implementation Checklist

### Issue 5 (Estimated: 15 min)
- [ ] Remove constructor and method from complete-profile-page.ts
- [ ] Update initial state in complete-profile-store.ts
- [ ] Update test in complete-profile-store.spec.ts
- [ ] Verify no regression

### Issue 7 (Estimated: 30 min)
- [ ] Add imports to has-budget.guard.ts
- [ ] Implement retry logic
- [ ] Add error type handling
- [ ] Add tests to has-budget.guard.spec.ts
- [ ] Manual test with network offline

### Issue 6 (Estimated: 30 min)
- [ ] Add isReady() method to product-tour.service.ts
- [ ] Update #getTourKey() to throw if no userId
- [ ] Add early returns to public methods
- [ ] Update tests in product-tour.service.spec.ts
- [ ] Manual test tour behavior

### Issue 8 (Estimated: 1 hour)
- [ ] Create turnstile/ folder structure
- [ ] Create turnstile.service.ts
- [ ] Create turnstile.service.spec.ts
- [ ] Create index.ts barrel
- [ ] Update welcome-page.ts to use service
- [ ] Update welcome-page.spec.ts if needed
- [ ] Verify line count < 300
- [ ] Manual test demo mode

---

## Next Step

Run `/epct:code .claude/tasks/01-fix-important-issues` to execute this plan.
