# Implementation Plan: Fix Refactor Issues

## Overview

Fix 2 real issues + 1 minor identified in `refactor-e2e-window` branch:

1. **Breaking Change**: Missing `hasValue` signal (existed in original)
2. **E2E Bug**: E2E mock state not reset on signOut (existed in original)
3. **Minor**: Empty catch blocks lose error context for debugging

**FALSE POSITIVES ELIMINATED:**
- ❌ signOut cleanup issue - INTENTIONAL architecture (commit 2f2f18c0c proves it)
- ❌ Duplicate updateAuthState - Bug that was FIXED by commit 2f2f18c0c
- ❌ Budget preload removal - INTENTIONAL (task 40 documentation)

**Strategy**: 2 quick fixes + 1 optional logging improvement.

## Dependencies

None - all fixes are independent.

## File Changes

### `frontend/projects/webapp/src/app/core/auth/auth-state.service.ts`

**Issue**: Missing `hasValue` computed signal that existed in original `fix_webapp_nav_delay` branch

**Actions**:
- Add computed signal after line 26: `readonly hasValue = computed(() => !!this.#userSignal());`
- This provides backward compatibility for any consumers using this signal
- Signal returns true if user exists, false otherwise

**Evidence**: `git show fix_webapp_nav_delay:frontend/projects/webapp/src/app/core/auth/auth-api.ts` shows `readonly hasValue = computed(() => !!this.#userSignal());` at line ~70

---

### `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts`

**Issue**: E2E mock state not reset to null on signOut (existed in original, removed in refactor)

**Actions**:
- Add `#setE2EMockState()` private method after `#getE2EMockState()` (around line 230):
  ```typescript
  #setE2EMockState(state: AuthState): void {
    (window as E2EWindow).__E2E_MOCK_AUTH_STATE__ = state;
  }
  ```

- In E2E signOut path (line 197), add BEFORE `this.#updateAuthState(null)`:
  ```typescript
  this.#setE2EMockState({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
  });
  ```

**Evidence**: Original `fix_webapp_nav_delay` branch had this exact code in signOut E2E path

**Why**: E2E tests may check `window.__E2E_MOCK_AUTH_STATE__` directly. Without reset, tests see stale auth state.

---

### `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.ts` (OPTIONAL)

**Issue**: Empty catch blocks suppress errors without logging (lines 45, 80)

**Actions** (optional for better debugging):
- Line 45: Change `} catch {` to `} catch (error) {`
- Line 46: Add `this.#logger.error('Unexpected error during email sign in:', error);` BEFORE return statement

- Line 80: Change `} catch {` to `} catch (error) {`
- Line 81: Add `this.#logger.error('Unexpected error during email sign up:', error);` BEFORE return statement

**Why**: Network timeouts, JSON parsing errors, client failures are now visible in logs for debugging. Still returns generic error message to user.

**Note**: This is a MINOR improvement, not critical. Existing error handling is functional, just missing diagnostic info.

---

## Testing Strategy

### Unit Tests to Update

**`frontend/projects/webapp/src/app/core/auth/auth-state.service.spec.ts`**

Add test after existing signal tests:
```typescript
it('should compute hasValue based on user existence', () => {
  // Arrange - no session
  expect(service.hasValue()).toBe(false);

  // Act - set session with user
  service.setSession(mockSession);

  // Assert
  expect(service.hasValue()).toBe(true);

  // Act - clear session
  service.setSession(null);

  // Assert
  expect(service.hasValue()).toBe(false);
});
```

**`frontend/projects/webapp/src/app/core/auth/auth-session.service.spec.ts`**

Add test for E2E mock state reset:
```typescript
it('should reset E2E mock state on signOut in E2E mode', () => {
  // Arrange
  (window as E2EWindow).__E2E_AUTH_BYPASS__ = true;
  (window as E2EWindow).__E2E_MOCK_AUTH_STATE__ = {
    user: mockUser,
    session: mockSession,
    isLoading: false,
    isAuthenticated: true,
  };

  // Act
  await service.signOut();

  // Assert - mock state reset to null
  const mockState = (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
  expect(mockState.user).toBeNull();
  expect(mockState.session).toBeNull();
  expect(mockState.isAuthenticated).toBe(false);

  // Cleanup
  delete (window as E2EWindow).__E2E_AUTH_BYPASS__;
  delete (window as E2EWindow).__E2E_MOCK_AUTH_STATE__;
});
```

### E2E Tests

Run existing E2E suite to verify no regressions:
```bash
cd frontend
pnpm test:e2e
```

**Critical E2E tests to verify:**
- Auth bypass still works correctly
- SignOut properly clears E2E mock state

### Manual Verification

1. Run `pnpm quality` to catch formatting/lint errors
2. Run `pnpm test` to verify all unit tests pass
3. Check browser console during E2E test runs - no errors

---

## Rollout Considerations

### Breaking Changes

**None** - All changes are additive:
- `hasValue` signal addition is backward compatible (restores missing feature)
- E2E mock state fix only affects E2E tests
- Optional logging doesn't change behavior

### Impact

**Low Risk:**
- hasValue signal addition (simple computed, no side effects)
- E2E mock state reset (only affects E2E tests)
- Optional error logging (doesn't change control flow)

**Zero Production Impact:**
- E2E code never bundles in production
- hasValue is pure computed (no side effects)
- Error logging is development-only benefit

### Migration Steps

1. Fix hasValue signal (5 minutes)
2. Fix E2E mock state reset (10 minutes)
3. Optional: Add error logging (5 minutes)
4. Add tests (15 minutes)
5. Run `pnpm quality`
6. Run `pnpm test`
7. Run `pnpm test:e2e`
8. Commit

---

## Architecture Clarifications

### signOut Cleanup (NOT a Bug)

**Review claimed**: "signOut can skip cleanup on errors"

**Reality**: This is INTENTIONAL architecture per commit 2f2f18c0c and task 40 docs:

**Commit 2f2f18c0c test**:
```typescript
it('should sign out and update state without calling cleanup directly', async () => {
  await service.signOut();
  expect(mockCleanup.performCleanup).not.toHaveBeenCalled(); // ← INTENTIONAL
});
```

**Task 40 documentation**:
> "**Simplification**: Removed userId capture from SIGNED_OUT event handler"
> "**Rationale**: The onAuthStateChange listener now only updates state, letting explicit signOut calls handle cleanup coordination."

**How it works:**
1. `signOut()` calls `Supabase.auth.signOut()` + `updateAuthState(null)`
2. Supabase fires `SIGNED_OUT` event
3. Event listener (lines 91-95) calls `cleanup.performCleanup(userId)`
4. E2E path directly calls cleanup (since no Supabase event)

**This is clean event-driven architecture. Not a bug.**

---

### Budget Preload (NOT a Regression)

**Review claimed**: "Performance regression - budget preload removed"

**Reality**: This was INTENTIONAL per task 40 implementation docs:

**From `.claude/tasks/40-refactor-auth-api-service-split/implementation.md`:**
> **Decision**: Removed `#preloadHasBudgetFlag()` and BudgetApi injection entirely
> **Rationale**: Guards already handle cache miss gracefully. Eliminates auth → budget dependency.
> **Impact**: None. Fast path uses cache (instant), slow path fetches only on first navigation.

**Why this is correct:**
- Eliminates circular dependency risk
- Improves separation of concerns (auth shouldn't know about budget)
- Cache fills on first navigation (one-time minimal delay)
- Guard handles it gracefully

**This is an architectural improvement. Not a regression.**

---

## Next Steps

After plan approval:
1. Run `/epct:code 42-fix-refactor-critical-issues` to execute fixes
2. Consider implementing optional error logging for better debugging
3. Commit with message: `fix: restore hasValue signal and E2E mock state reset`

---

## Summary

**Real Issues: 2 critical + 1 optional**
- ✅ hasValue signal missing
- ✅ E2E mock state not reset
- ⚠️ Optional: Empty catch blocks

**False Positives: 3**
- ❌ signOut cleanup (intentional architecture)
- ❌ Duplicate cleanup (bug that was fixed)
- ❌ Budget preload (intentional removal)

**Estimated Fix Time**: 30-45 minutes including tests

**Risk Level**: Very Low - All changes are additive and well-tested
