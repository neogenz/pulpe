# Implementation Plan: Pre-Load hasBudget for Instant Navigation

## Overview

Implement a robust, zero-compromise solution for instant navigation to budget-protected routes while maintaining guard correctness and avoiding race conditions.

**Current Problem:**
- Slow network: user clicks protected route → no feedback → 2-5s wait → page displays
- Guard fetches `getAllBudgets$()` (heavy) on every navigation
- No visual feedback during guard execution

**Solution Strategy:**
1. Pre-load lightweight `hasBudget` flag at login (optimization)
2. Guard checks cache first (instant 90% of cases), falls back to API if cache miss
3. Auto-sync cache on all budget API calls (eliminates stale cache)
4. Debounced progress bar (prevents flicker on fast navigations)
5. Use `firstValueFrom` instead of subscribe patterns

**Key Guarantees:**
- ✅ Zero race conditions (guard is deterministic)
- ✅ Zero stale cache (auto-sync on all API calls)
- ✅ Instant navigation (90% cache hit after pre-load)
- ✅ Robust fallback (guard fetches if cache miss)
- ✅ Visual feedback (debounced progress bar for slow operations)

## Dependencies

**Must be done in order:**
1. Backend endpoint (isolated, can test independently)
2. Frontend cache service (rename + simplify existing)
3. Frontend API methods (add checkBudgetExists$ + auto-sync)
4. Auth pre-load (background optimization)
5. Guard refactor (core robustness)
6. Progress bar debounce (UX polish)
7. Cleanup old references

## File Changes

### Backend

#### `backend-nest/src/modules/budget/controllers/budget.controller.ts`

**Action:** Add lightweight endpoint to check budget existence
- Add new `@Get('exists')` route
- Create method `checkBudgetExists()` that calls `budgetService.countUserBudgets()`
- Return `{ hasBudget: boolean }` (simple boolean, not full budget data)
- Add Swagger decorators: `@ApiOperation()`, `@ApiResponse()`
- Use existing `@CurrentUser()` decorator for user authentication
- Pattern: Follow existing controller methods structure (lines 30-50)

**Consider:**
- Place route ABOVE `@Get(':id')` to avoid route shadowing
- Keep method simple (single responsibility: existence check only)

#### `backend-nest/src/modules/budget/services/budget.service.ts`

**Action:** Add optimized count method
- Create `countUserBudgets(userId: string): Promise<number>` method
- Use Supabase `.select('*', { count: 'exact', head: true })` (no data transfer)
- Filter by `user_id` equals `userId`
- Return `count ?? 0` (handle null case)
- Pattern: Follow existing `getBudgetsByUserId()` method structure

**Consider:**
- This is ultra-lightweight (COUNT query with head: true = metadata only)
- Reusable for other features needing existence check

---

### Frontend Core - State Management

#### `frontend/projects/webapp/src/app/core/auth/has-budget-state.ts`

**Action 1:** Rename file to `has-budget-cache.ts` (better semantic - it's a cache, not a store)

**Action 2:** Simplify implementation
- Keep existing signal structure (already correct pattern per `LoadingIndicator`)
- Rename class from `HasBudgetState` to `HasBudgetCache`
- Remove `setHasBudget()` and `setNoBudget()` methods (confusing dual API)
- Replace with single `setHasBudget(value: boolean)` method
- Keep `get()` method as-is (returns `boolean | null`)
- Keep `clear()` method as-is
- Update JSDoc to reflect cache semantic

**Pattern:** Match `LoadingIndicator` service (line 1-14 in loading-indicator.ts)

**Consider:**
- Naming: "Cache" is more accurate than "State" (it's an optimization layer over API)
- API: `setHasBudget(true/false)` is clearer than two separate methods

---

### Frontend Core - API Layer

#### `frontend/projects/webapp/src/app/core/budget/budget-api.ts`

**Action 1:** Add lightweight existence check method
- Create `checkBudgetExists$(): Observable<boolean>` method
- HTTP GET to `/budgets/exists`
- Type response as `{ hasBudget: boolean }`
- Map response to boolean (`response.hasBudget`)
- **CRITICAL:** Inject `HasBudgetCache` and call `this.#hasBudgetCache.setHasBudget(response.hasBudget)` before returning
- Use `this.#handleApiError()` in catchError (consistent with other methods)
- Pattern: Follow structure of `getBudgetById$()` (lines 98-105)

**Action 2:** Add auto-sync to existing `getAllBudgets$()` method
- After parsing response (line 85), add: `this.#hasBudgetCache.setHasBudget(budgets.length > 0)`
- This ensures cache is ALWAYS synced with API state on every budget fetch
- Inject `HasBudgetCache` in service constructor area (line ~45)

**Consider:**
- Auto-sync makes cache impossible to be stale (source of truth = API)
- Every method that fetches budgets keeps cache fresh
- `checkBudgetExists$` is just an optimization (guard can use either method)

#### `frontend/projects/webapp/src/app/core/auth/auth-api.ts`

**Action 1:** Update imports
- Line ~16: Replace `import { HasBudgetState }` with `import { HasBudgetCache }`
- Line ~49: Replace injection `#hasBudgetState` with `#hasBudgetCache`
- Add import: `import { DestroyRef } from '@angular/core'`
- Add import: `import { firstValueFrom, EMPTY } from 'rxjs'`

**Action 2:** Inject DestroyRef for cleanup
- Line ~49 (after other injections): Add `readonly #destroyRef = inject(DestroyRef);`

**Action 3:** Add pre-load call in `initializeAuthState()`
- Line ~149 (after `this.updateAuthState(session);`): Add conditional pre-load
  ```typescript
  // Pre-load hasBudget flag for instant navigation (non-blocking optimization)
  if (session) {
    this.#preloadHasBudgetFlag();
  }
  ```

**Action 4:** Add pre-load call in auth state change listener
- Line ~161 (in `case 'SIGNED_IN':`): Add `this.#preloadHasBudgetFlag();`
- Also in `case 'TOKEN_REFRESHED':` (same line): Add call

**Action 5:** Update `handleSignOut()` method
- Line ~219: Replace `this.#hasBudgetState.clear()` with `this.#hasBudgetCache.clear()`

**Action 6:** Create new private method `#preloadHasBudgetFlag()`
- Add after `handleSignOut()` method (before closing brace)
- Implementation:
  ```typescript
  /**
   * Pre-loads hasBudget flag in background for instant guard checks.
   * Uses firstValueFrom for automatic completion (no manual unsubscribe needed).
   * Non-blocking: errors are logged but don't prevent login.
   */
  async #preloadHasBudgetFlag(): Promise<void> {
    try {
      await firstValueFrom(
        this.#budgetApi.checkBudgetExists$().pipe(
          catchError((error) => {
            this.#logger.info(
              'Pre-load hasBudget failed (non-blocking), guard will fetch on demand',
              error,
            );
            return EMPTY; // Silent fail, don't propagate error
          }),
        ),
      );
    } catch {
      // firstValueFrom throws if EMPTY completes - this is expected for error case
      // No action needed, guard will handle cache miss
    }
  }
  ```

**Pattern:** Use `firstValueFrom` instead of `subscribe()` (cleaner, auto-completes)

**Consider:**
- Pre-load is optimization, NOT requirement (guard handles cache miss)
- `EMPTY` + try/catch ensures no errors bubble up to login flow
- DestroyRef not needed with firstValueFrom (auto-completes after first emit)

---

### Frontend Core - Guard

#### `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts`

**Action 1:** Update imports
- Line 8: Replace `HasBudgetState` with `HasBudgetCache`
- Import path: `import { HasBudgetCache } from './has-budget-cache';`

**Action 2:** Refactor guard to robust async pattern
- Keep function signature as `CanActivateFn` (async implicit via Promise return)
- Inject `HasBudgetCache` instead of `HasBudgetState`
- Change logic:
  1. **Fast path (cache hit):** Check `hasBudgetCache.get()` - if not null, return immediately (0ms)
  2. **Slow path (cache miss):** Call `budgetApi.checkBudgetExists$()` with `firstValueFrom`
  3. **Fail-safe:** Catch API errors and allow navigation (log warning)
- Remove retry logic (lines 30) - `checkBudgetExists$` is lightweight, single attempt sufficient
- Update JSDoc to document both paths and edge cases

**New implementation structure:**
```typescript
export const hasBudgetGuard: CanActivateFn = async () => {
  const hasBudgetCache = inject(HasBudgetCache);
  const budgetApi = inject(BudgetApi);
  const router = inject(Router);
  const logger = inject(Logger);

  const cached = hasBudgetCache.get();

  // Fast path: cache hit (90% of cases after pre-load)
  if (cached !== null) {
    if (!cached) {
      return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
    }
    return true;
  }

  // Slow path: cache miss - fetch from API
  // Router automatically shows loading indicator during async operation
  try {
    const hasBudget = await firstValueFrom(budgetApi.checkBudgetExists$());

    if (!hasBudget) {
      return router.createUrlTree(['/', ROUTES.APP, ROUTES.COMPLETE_PROFILE]);
    }

    return true;
  } catch (error) {
    logger.warn(
      'hasBudgetGuard: API error during cache miss, allowing navigation (fail-safe)',
      error,
    );
    return true; // Fail-safe: allow navigation on network errors
  }
};
```

**Consider:**
- Guard is now deterministic (no race conditions possible)
- Cache miss triggers router NavigationStart → progress bar visible
- API auto-syncs cache (checkBudgetExists$ sets cache before returning)

---

### Frontend Core - UX

#### `frontend/projects/webapp/src/app/layout/main-layout.ts`

**Action:** Add debounce to prevent progress bar flicker
- Line 464-476: Replace `isNavigating` signal implementation
- Add import: `import { delay, switchMap, of } from 'rxjs/operators';`
- Change observable to delay showing loader by 100ms
- Hide loader immediately on navigation end (no delay)

**New implementation:**
```typescript
// Navigation state for progress bar feedback (debounced to prevent flicker)
protected readonly isNavigating = toSignal(
  this.#router.events.pipe(
    filter(
      (e) =>
        e instanceof NavigationStart ||
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError,
    ),
    switchMap((e) =>
      e instanceof NavigationStart
        ? of(true).pipe(delay(100)) // Show loader only if navigation > 100ms
        : of(false) // Hide immediately
    ),
  ),
  { initialValue: false },
);
```

**Consider:**
- Fast navigations (< 100ms) never show loader (no flicker)
- Slow navigations (> 100ms) show loader after 100ms delay (smooth UX)
- NavigationEnd immediately hides loader (no delay on success)
- This works for ALL async guards, not just hasBudgetGuard

---

### Frontend Features

#### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts`

**Action 1:** Update import
- Line 8: Replace `import { HasBudgetState }` with `import { HasBudgetCache }`
- Line 47: Replace injection `#hasBudgetState` with `#hasBudgetCache`

**Action 2:** Update method call
- Line ~210: Replace `this.#hasBudgetState.setHasBudget()` with `this.#hasBudgetCache.setHasBudget(true)`
- Update comment: "Update cache so guard allows navigation immediately"

**Consider:**
- This manual sync is redundant now (BudgetApi auto-syncs) but harmless
- Can be removed later if preferred (optimization)

#### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-store.ts`

**Action:** Remove manual cache invalidation (auto-sync handles it)
- Find `deleteBudget()` method
- Remove any manual calls to `HasBudgetState` or `HasBudgetCache`
- The guard will auto-refresh on next navigation via `getAllBudgets$` auto-sync

**Consider:**
- Auto-sync in BudgetApi makes manual invalidation unnecessary
- Simpler code (less coupling between store and cache)
- If user deletes last budget and navigates, guard will fetch fresh state

---

### Tests

#### `frontend/projects/webapp/src/app/core/auth/has-budget-state.spec.ts`

**Action 1:** Rename file to `has-budget-cache.spec.ts`

**Action 2:** Update test suite
- Replace all references to `HasBudgetState` with `HasBudgetCache`
- Update test for `setHasBudget()` method (now takes boolean parameter)
- Remove tests for `setHasBudget()` and `setNoBudget()` (old API)
- Add test: `setHasBudget(true)` sets value to true
- Add test: `setHasBudget(false)` sets value to false
- Keep existing tests for `get()` and `clear()`

**Pattern:** Follow existing test structure (AAA pattern, Vitest)

#### `frontend/projects/webapp/src/app/core/auth/has-budget.guard.spec.ts`

**Action:** Update tests for new async behavior
- Replace `HasBudgetState` with `HasBudgetCache` in imports and mocks
- Update test "should allow navigation if cached true": verify fast path (no API call)
- Update test "should redirect if cached false": verify fast path (no API call)
- Add test "should call API if cache miss (null)": verify slow path with `checkBudgetExists$` call
- Add test "should sync cache after API call": verify cache updated after API response
- Add test "should fail-safe on API error": verify navigation allowed on error
- Mock `BudgetApi.checkBudgetExists$()` instead of `getAllBudgets$()`

**Consider:**
- Guard is now fully async (returns Promise), adjust test expectations
- Use `TestBed.runInInjectionContext()` for functional guard testing

#### `frontend/projects/webapp/src/app/core/auth/auth-api.spec.ts`

**Action:** Add test for pre-load behavior
- Add test suite: "hasBudget pre-load"
- Test: "should pre-load flag on successful login"
  - Call `initializeAuthState()` with valid session
  - Verify `budgetApi.checkBudgetExists$()` was called
  - Verify `hasBudgetCache.setHasBudget()` was called with correct value
- Test: "should not block login if pre-load fails"
  - Mock `checkBudgetExists$()` to throw error
  - Verify `initializeAuthState()` completes successfully
  - Verify error logged but not thrown

**Pattern:** Follow existing auth-api test patterns (mocked Supabase client)

#### `frontend/projects/webapp/src/app/core/budget/budget-api.spec.ts`

**Action:** Add tests for new method and auto-sync
- Add test suite: "checkBudgetExists$"
  - Test: "should return true if user has budgets"
  - Test: "should return false if user has no budgets"
  - Test: "should sync cache with response value"
  - Test: "should handle API errors via handleApiError"
- Add test to existing `getAllBudgets$` suite:
  - Test: "should auto-sync hasBudget cache with result"
  - Verify `hasBudgetCache.setHasBudget(true)` called if budgets.length > 0
  - Verify `hasBudgetCache.setHasBudget(false)` called if budgets.length === 0

**Pattern:** Follow existing BudgetApi test structure (mocked HttpClient)

---

## Testing Strategy

### Unit Tests (Vitest)

**Files to create/modify:**
- `has-budget-cache.spec.ts` (rename + update)
- `has-budget.guard.spec.ts` (update for async + cache miss)
- `auth-api.spec.ts` (add pre-load tests)
- `budget-api.spec.ts` (add checkBudgetExists$ + auto-sync tests)

**Run:**
```bash
cd frontend
pnpm test -- has-budget-cache.spec.ts
pnpm test -- has-budget.guard.spec.ts
pnpm test -- auth-api.spec.ts
pnpm test -- budget-api.spec.ts
```

### Manual Testing

**Critical scenarios:**

1. **Instant navigation (cache hit)**
   - Login → wait 1s → click "Mois en cours"
   - ✅ Expected: Page displays instantly (< 100ms), no progress bar

2. **Navigation with cache miss**
   - Login → immediately click "Mois en cours" (< 200ms)
   - ✅ Expected: Progress bar shows briefly, page displays after API response

3. **Slow network (primary problem)**
   - Chrome DevTools → Network → Throttle to "Slow 3G"
   - Login → click "Mois en cours"
   - ✅ Expected: Progress bar visible, navigation completes after ~2s

4. **New user (no budget)**
   - Signup fresh account → click "Mois en cours"
   - ✅ Expected: Redirect to complete-profile (instant or with brief progress bar)

5. **Budget creation flow**
   - Complete profile → create budget → navigate to "Mois en cours"
   - ✅ Expected: No redirect, page displays (cache synced)

6. **Last budget deletion**
   - Delete only budget → try to access "Mois en cours"
   - ✅ Expected: Redirect to complete-profile

7. **API error handling**
   - Mock 500 error on `/budgets/exists`
   - Try to navigate
   - ✅ Expected: Navigation allowed (fail-safe), error logged

### E2E Testing (Playwright)

**Scenarios to add:**

1. Test instant navigation with pre-loaded cache
2. Test progress bar debounce (no flicker on fast navigation)
3. Test guard redirect for users without budgets
4. Test slow network navigation (verify progress bar visible)

**File:** `frontend/e2e/navigation/has-budget-guard.spec.ts`

---

## Documentation

### Update Comments

**Files with updated JSDoc:**
- `has-budget-cache.ts` - Document cache semantic (optimization layer)
- `has-budget.guard.ts` - Document fast/slow path behavior
- `auth-api.ts` - Document pre-load as non-blocking optimization
- `budget-api.ts` - Document auto-sync behavior

### README Updates

**Not required** - internal implementation detail, no user-facing changes

---

## Rollout Considerations

### Breaking Changes
**None** - Internal refactoring only, no API changes for consumers

### Migration Steps
1. Deploy backend first (endpoint can exist unused)
2. Deploy frontend (guards backward compatible - still works with old endpoint if new fails)
3. Monitor pre-load success rate via logs
4. Monitor guard performance (cache hit rate)

### Feature Flags
**Not needed** - Changes are additive and fail-safe

### Performance Monitoring

**Metrics to track:**
- Cache hit rate (should be ~90% after rollout)
- Pre-load success rate (should be ~95%+)
- Guard execution time (should be < 50ms for cache hits)
- Progress bar visibility duration (should be < 100ms for 90% of navigations)

**Log points:**
- Pre-load failures (info level - not critical)
- Cache miss on guard check (debug level)
- Guard API fallback (debug level)
- Guard fail-safe activation (warn level)

### Rollback Plan

**If issues detected:**
1. Revert guard to synchronous version (keep using `getAllBudgets$`)
2. Keep backend endpoint (no harm)
3. Keep cache service (unused but harmless)
4. Remove pre-load call from auth-api

**Rollback is safe** - All changes are backward compatible

---

## Implementation Order

**Phase 1: Backend (Isolated)**
1. ✅ Add `/budgets/exists` endpoint
2. ✅ Add `countUserBudgets()` method
3. ✅ Test endpoint manually (Postman/curl)

**Phase 2: Frontend Cache (Isolated)**
4. ✅ Rename `has-budget-state.ts` → `has-budget-cache.ts`
5. ✅ Update class name and simplify API
6. ✅ Update tests (`has-budget-cache.spec.ts`)
7. ✅ Run tests to verify

**Phase 3: Frontend API (Depends on Phase 1 & 2)**
8. ✅ Add `checkBudgetExists$()` method to BudgetApi
9. ✅ Add auto-sync to `getAllBudgets$()` method
10. ✅ Write tests for both changes
11. ✅ Run tests to verify

**Phase 4: Auth Pre-load (Depends on Phase 3)**
12. ✅ Add pre-load call to `initializeAuthState()`
13. ✅ Implement `#preloadHasBudgetFlag()` with firstValueFrom
14. ✅ Write tests for pre-load
15. ✅ Manual test: verify pre-load happens at login

**Phase 5: Guard Refactor (Depends on Phase 3)**
16. ✅ Refactor guard to async with cache check + API fallback
17. ✅ Update guard tests
18. ✅ Run guard tests
19. ✅ Manual test: verify guard works with cache hit and cache miss

**Phase 6: UX Polish (Independent)**
20. ✅ Add debounce to `isNavigating` signal in main-layout
21. ✅ Manual test: verify no progress bar flicker on fast navigation
22. ✅ Manual test slow network: verify progress bar appears after 100ms delay

**Phase 7: Feature Updates (Depends on Phase 2)**
23. ✅ Update complete-profile-store imports and calls
24. ✅ Clean up budget-list-store (remove manual invalidation)
25. ✅ Run feature tests

**Phase 8: Integration Testing**
26. ✅ Run all unit tests (`pnpm test`)
27. ✅ Run all E2E tests (`pnpm test:e2e`)
28. ✅ Manual test all critical scenarios (see Testing Strategy)
29. ✅ Test with slow network throttling

**Phase 9: Quality Check**
30. ✅ Run `pnpm quality` (type-check + lint + format)
31. ✅ Review all git diffs for unintended changes
32. ✅ Verify no console errors in browser

---

## Summary

This plan implements a **zero-compromise solution** that combines:
- **Performance:** Instant navigation via cache (90% of cases)
- **Robustness:** Deterministic guard with API fallback (no race conditions)
- **Correctness:** Auto-sync eliminates stale cache (API is source of truth)
- **UX:** Debounced progress bar prevents flicker
- **Maintainability:** Clean separation of concerns, well-tested

**Key improvements over initial design:**
1. ✅ Renamed to `HasBudgetCache` (better semantic)
2. ✅ Used `firstValueFrom` instead of subscribe (cleaner)
3. ✅ Reused existing progress bar with debounce (no new component)
4. ✅ Auto-sync in BudgetApi (prevents stale cache completely)
5. ✅ Fail-safe at every layer (robust error handling)

**All technical concerns addressed:**
- ✅ No race conditions (guard is deterministic)
- ✅ No stale cache (auto-sync on every API call)
- ✅ No flicker (100ms debounce on progress bar)
- ✅ No over-engineering (KISS principle maintained)
- ✅ Production-ready (comprehensive testing + monitoring)
