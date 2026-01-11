# Task: Fix 4 Important Issues (5, 6, 7, 8)

## Summary

This exploration covers 4 issues requiring fixes in the Angular frontend:
1. **Issue 5**: Double API call for budget check (has-budget.guard.ts + complete-profile-page.ts)
2. **Issue 6**: Race condition in Product Tour (product-tour.service.ts)
3. **Issue 7**: Silent error handling in hasBudgetGuard (has-budget.guard.ts)
4. **Issue 8**: File too long - welcome-page.ts (390 lines, limit 300)

---

## Issue 5: Double API Call for Budget Check

### Problem Analysis

**Flow causing double call:**
1. User navigates to protected route
2. `hasBudgetGuard` runs → calls `budgetApi.getAllBudgets$()` (line 19)
3. No budgets found → redirects to `/complete-profile`
4. `CompleteProfilePage` constructor runs → calls `#checkExistingBudgetsAndRedirect()` (line 199)
5. Store's `checkExistingBudgets()` → calls `budgetApi.getAllBudgets$()` again (line 105)

**Result:** 2 identical API calls within milliseconds

### Key Files

| File | Line | Purpose |
|------|------|---------|
| `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts` | 19 | First API call in guard |
| `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts` | 199, 202-208 | Second API call in constructor |
| `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts` | 101-126 | `checkExistingBudgets()` method |

### Recommended Fix

**Option A: Remove redundant check in component (Simplest)**
- Remove `#checkExistingBudgetsAndRedirect()` call from constructor
- Set `isCheckingExistingBudget` to `false` by default in store initial state
- Guard already verified no budgets exist → component doesn't need to re-check

**Option B: Pass navigation state flag**
- Guard sets a flag before redirecting
- Component checks flag and skips the redundant API call
- Use service-based approach (no router state usage found in codebase)

**Preferred: Option A** - Simplest, follows KISS principle

### Code Changes (Option A)

```typescript
// complete-profile-page.ts - Remove lines 198-208
export default class CompleteProfilePage {
  protected readonly store = inject(CompleteProfileStore);
  readonly #router = inject(Router);

  // REMOVE: constructor() { this.#checkExistingBudgetsAndRedirect(); }
  // REMOVE: async #checkExistingBudgetsAndRedirect(): Promise<void> { ... }

  protected async onSubmit(): Promise<void> {
    // ... keep existing implementation
  }
}

// complete-profile-store.ts - Update initial state (line 31)
function createInitialState(): CompleteProfileState {
  return {
    // ...
    isCheckingExistingBudget: false,  // Changed from true
    // ...
  };
}
```

### Regression Risks

- **Risk:** Direct navigation to `/complete-profile` bypassing guard could allow users with budgets to see the page
- **Mitigation:** Route is protected by `hasBudgetGuard` chain - users can only reach it through guard
- **Verify:** Check route config ensures guard is always applied

---

## Issue 6: Race Condition in Product Tour

### Problem Analysis

**The race condition:**
```typescript
// product-tour.service.ts:51-57
#getTourKey(tourId: string): StorageKey {
  const userId = this.#authApi.currentUser?.id;  // Can be null during auth init!
  if (!userId) {
    return `pulpe-tour-${tourId}` as StorageKey;  // Generic key
  }
  return `pulpe-tour-${tourId}-${userId}` as StorageKey;  // User-specific key
}
```

**Scenario:**
1. User navigates to `/current-month` while auth is still initializing
2. `currentUser?.id` is null → tour uses generic key `pulpe-tour-current-month`
3. Tour shows, user completes it → stored with generic key
4. Later, auth completes → userId now available
5. Next visit checks `pulpe-tour-current-month-{userId}` → NOT FOUND
6. Tour shows again!

### Key Files

| File | Line | Purpose |
|------|------|---------|
| `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.ts` | 51-57 | Race condition in `#getTourKey()` |
| `frontend/projects/webapp/src/app/core/auth/auth-api.ts` | 399-401 | `currentUser` getter (synchronous) |
| `frontend/projects/webapp/src/app/feature/current-month/current-month.ts` | 244-253 | Tour trigger with `afterNextRender` |

### Recommended Fix

**Option A: Require userId (throw if not ready)**
```typescript
#getTourKey(tourId: string): StorageKey {
  const userId = this.#authApi.currentUser?.id;
  if (!userId) {
    throw new Error('ProductTourService: Cannot generate tour key without userId');
  }
  return `pulpe-tour-${tourId}-${userId}` as StorageKey;
}
```

**Option B: Wait for auth before starting tour (Safer)**
```typescript
// In component: Check auth is ready before starting tour
constructor() {
  afterNextRender(() => {
    // Only start tour if auth is ready
    if (!this.#authApi.isAuthenticated() || !this.#authApi.currentUser?.id) {
      return; // Skip tour if auth not ready
    }
    if (!this.#productTourService.hasSeenPageTour('current-month')) {
      setTimeout(() => this.#productTourService.startPageTour('current-month'), TOUR_START_DELAY);
    }
  });
}
```

**Option C: Migrate generic keys to user-specific keys**
- On first tour check with userId available, check for generic key
- If found, migrate to user-specific key
- More complex but handles existing users

**Preferred: Option B** - Safest, follows existing auth readiness patterns

### Codebase Pattern

Other guards use `toObservable(authApi.authState).pipe(filter(s => !s.isLoading), take(1))` to wait for auth.

---

## Issue 7: Silent Error Handling in hasBudgetGuard

### Problem Analysis

```typescript
// has-budget.guard.ts:27-31
} catch {
  // On error (API failure or validation error), redirect to complete-profile
  return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
}
```

**Problem scenario:**
1. User has budgets, navigates to dashboard
2. Network error during `getAllBudgets$()` call
3. Catch block redirects to `/complete-profile`
4. `complete-profile-page` checks API again → works this time
5. Finds budgets → redirects to dashboard
6. **Result:** Confusing redirect loop for user

### Key Files

| File | Line | Purpose |
|------|------|---------|
| `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts` | 27-31 | Catch-all error handling |

### Recommended Fix

**Option A: Distinguish error types**
```typescript
} catch (error) {
  // Only redirect to complete-profile for expected "no data" scenarios
  // For network errors, show error or retry
  if (error instanceof HttpErrorResponse && error.status === 0) {
    // Network error - could retry or show error page
    return router.createUrlTree(['/', ROUTES.ERROR, 'network']);
  }
  // Other errors (e.g., validation) - redirect to complete-profile
  return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
}
```

**Option B: Return true on error, let component handle**
```typescript
} catch (error) {
  // Let the route proceed, component will show error state
  console.error('hasBudgetGuard: Error checking budgets', error);
  return true;
}
```

**Option C: Retry mechanism**
```typescript
try {
  const budgets = await firstValueFrom(
    budgetApi.getAllBudgets$().pipe(
      retry({ count: 2, delay: 1000 }),
      catchError(() => of([]))  // Empty array on persistent failure
    )
  );
  // ...
}
```

**Preferred: Option A** - Distinguishes network errors from "no budgets" scenario

### Codebase Pattern

The codebase pattern (from `demo-initializer.service.ts:105-119`) distinguishes errors by status code:
- `status === 0`: Network error
- `status === 429`: Rate limit
- `status >= 500`: Server error

---

## Issue 8: File Too Long - welcome-page.ts

### Problem Analysis

- **Current:** 390 lines
- **Limit:** 300 lines
- **Turnstile logic:** ~120 lines (268-389)

### Key Files

| File | Line Range | Purpose |
|------|------------|---------|
| `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts` | 1-391 | Entire component |
| Lines 197-246 | Component signals and config | Keep in component |
| Lines 248-266 | `signInWithGoogle()` | Keep in component |
| Lines 268-296 | Turnstile callbacks | Extract to service |
| Lines 298-336 | `startDemoMode()` | Extract Turnstile parts |
| Lines 338-389 | Turnstile helpers | Extract to service |

### Recommended Fix

**Create `TurnstileService`** in `frontend/projects/webapp/src/app/core/turnstile/`

```typescript
// turnstile.service.ts
@Injectable({ providedIn: 'root' })
export class TurnstileService {
  readonly #config = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);

  // State signals
  readonly #isProcessing = signal(false);
  readonly #shouldRender = signal(false);
  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #resolutionHandled = false;

  // Public readonly signals
  readonly isProcessing = this.#isProcessing.asReadonly();
  readonly shouldRender = this.#shouldRender.asReadonly();

  // Config getters
  readonly siteKey = computed(() => this.#config.turnstile().siteKey);
  readonly shouldUseTurnstile = computed(() => !this.#config.isLocal());

  // Methods
  startVerification(widget: NgxTurnstileComponent | undefined): void { ... }
  onResolved(token: string | null): string | null { ... }
  onError(): void { ... }
  isSafariIOS(): boolean { ... }
  reset(): void { ... }

  // Private helpers
  #clearTimeout(): void { ... }
  #handleTimeout(): void { ... }
}
```

### Service Structure (Following Codebase Patterns)

Based on `demo-initializer.service.ts` and `product-tour.service.ts`:

```
frontend/projects/webapp/src/app/core/turnstile/
├── index.ts                    # Public exports
├── turnstile.service.ts        # Main service
└── turnstile.service.spec.ts   # Tests
```

### Extraction Checklist

- [ ] Extract `#TURNSTILE_TIMEOUT_MS` constant
- [ ] Extract `#turnstileTimeoutId` state
- [ ] Extract `#turnstileResolutionHandled` flag
- [ ] Extract `shouldRenderTurnstile` signal
- [ ] Extract `turnstileSiteKey` computed
- [ ] Extract `shouldUseTurnstile` computed
- [ ] Extract `onTurnstileResolved()` method
- [ ] Extract `onTurnstileError()` method
- [ ] Extract `#isSafariIOS()` method
- [ ] Extract `#handleTurnstileTimeout()` method
- [ ] Extract `#clearTurnstileTimeout()` method
- [ ] Refactor `startDemoMode()` to use service

---

## Patterns to Follow

### Service Extraction Pattern (from codebase)

```typescript
// Pattern from demo-mode.service.ts:17-56
@Injectable({ providedIn: 'root' })
export class ServiceName {
  // Private writable signals
  readonly #privateSignal = signal<Type>(initialValue);

  // Public readonly signals
  readonly publicSignal = this.#privateSignal.asReadonly();

  // Computed signals
  readonly derivedValue = computed(() => ...);

  // Effect for side-effects (localStorage sync)
  constructor() {
    effect(() => {
      // Side effect logic
    });
  }

  // Public methods
  publicMethod(): void { ... }

  // Private helpers
  #privateHelper(): void { ... }
}
```

### Guard Error Handling Pattern

```typescript
// Pattern from demo-initializer.service.ts:105-119
catch (error) {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      // Network error
    } else if (error.status === 429) {
      // Rate limited
    } else if (error.status >= 500) {
      // Server error
    }
  }
}
```

### Auth Readiness Pattern

```typescript
// Pattern from auth-guard.ts:20-22
toObservable(authApi.authState).pipe(
  filter(state => !state.isLoading),
  take(1),
  map(state => ...)
)
```

---

## Dependencies

| Issue | Dependencies |
|-------|-------------|
| Issue 5 | Route configuration, complete-profile-store.ts |
| Issue 6 | AuthApi, StorageService |
| Issue 7 | @angular/common/http (HttpErrorResponse) |
| Issue 8 | ApplicationConfiguration, Logger, NgxTurnstile |

---

## Test Files to Update

| Issue | Test File |
|-------|-----------|
| Issue 5 | `complete-profile-store.spec.ts` - Remove/update `checkExistingBudgets` tests |
| Issue 6 | `product-tour.service.spec.ts` - Add auth readiness tests |
| Issue 7 | `has-budget.guard.spec.ts` - Add network error test case |
| Issue 8 | New `turnstile.service.spec.ts` + update `welcome-page.spec.ts` |

---

## Implementation Order

1. **Issue 5** (Quick win, low risk)
2. **Issue 7** (Important for UX, moderate complexity)
3. **Issue 6** (Race condition fix, requires auth understanding)
4. **Issue 8** (Refactoring, most code changes)

---

## Next Step

Run `/epct:plan .claude/tasks/01-fix-important-issues` to create detailed implementation plan.
