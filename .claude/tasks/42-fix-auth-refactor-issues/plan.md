# Implementation Plan: Fix Auth Refactoring Issues

**Date**: 2026-01-16
**Context**: Resolve anti-patterns identified after auth module refactoring (post auth-api removal)

---

## Overview

This plan addresses 6 critical issues in the auth services discovered during code review:

1. **Memory Leak** - Supabase auth listener never unsubscribed
2. **Race Condition** - setTimeout not canceled when service destroyed
3. **Silent Failures** - Unexpected errors not logged (distinction: user errors vs system errors)
4. **Dead Code** - Vestigial mock observer method
5. **Cleanup Inconsistency** - Different cleanup flows for E2E vs production
6. **SSR Safety** - Unsafe window access without typeof guard

### Strategy

Fix issues using established Angular patterns from the codebase:
- **DestroyRef** for cleanup (modern Angular approach, used in components project-wide)
- **Logger.error()** for unexpected technical errors only (never log expected user errors like wrong passwords)
- **typeof window !== 'undefined'** for SSR safety (pattern from e2e-window.ts)
- **Explicit cleanup** in signOut regardless of mode (rely on existing race protection guard)

---

## Dependencies

### Angular APIs
- `DestroyRef` from `@angular/core` - Lifecycle management for services
- No external package additions required

### Service Dependencies
All services already have required dependencies injected:
- Logger (logging service)
- AuthCleanupService (cleanup orchestration)
- Supabase client (auth operations)

### Build Order
1. `auth-session.service.ts` - Core service, most changes
2. `auth-cleanup.service.ts` - Timeout cleanup
3. `auth-credentials.service.ts` - Error logging

---

## File Changes

### `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts`

#### Issue 1: Memory Leak - Listener Not Unsubscribed (Line 80)

**Problem**: `onAuthStateChange()` creates a subscription that's never cleaned up, causing memory leak in long-running apps.

**Actions**:
- Add `readonly #destroyRef = inject(DestroyRef)` to class properties
- Add private property `#authSubscription: (() => void) | null = null` to store unsubscribe function
- In `initializeAuthState()` after calling `onAuthStateChange()`:
  - Capture the return value: `const { data } = this.#supabaseClient.auth.onAuthStateChange(...)`
  - Store cleanup: `this.#authSubscription = () => data.subscription.unsubscribe()`
  - Register with DestroyRef: `this.#destroyRef.onDestroy(() => this.#authSubscription?.())`
- Pattern reference: Exploration document lines 287-309 (DestroyRef pattern for services)

**Edge Cases**:
- Only register cleanup if subscription was successfully created
- Handle case where `initializeAuthState()` might be called multiple times (guard already exists line 35-38)

---

#### Issue 6: Dead Code - Remove Vestigial Method (Lines 218-222)

**Problem**: `#setupMockStateObserver()` method exists only to log a message and is called once. No actual observer is set up. This is dead code from a previous implementation.

**Actions**:
- Delete the entire `#setupMockStateObserver()` method (lines 218-222)
- Remove the call to this method at line 58: delete `this.#setupMockStateObserver();`
- Verification: This method does not exist on main branch (confirmed via git history)

**Rationale**: Keeping methods that only log messages adds no value and creates confusion about what the code actually does.

---

#### Issue 5 (SSR): Unsafe Window Access (Line 229)

**Problem**: `#getE2EMockState()` directly casts `window` without checking if it exists, which will crash in SSR context.

**Actions**:
- Modify `#getE2EMockState()` method to check window existence first
- Add guard: `if (typeof window === 'undefined') return undefined;`
- Then access: `return (window as E2EWindow).__E2E_MOCK_AUTH_STATE__`
- Pattern reference: e2e-window.ts lines 163-168 (established SSR-safe pattern)

**Rationale**: Even though auth services typically run client-side only, defensive programming prevents SSR crashes if the service is accidentally instantiated server-side.

---

#### Issue 7: Cleanup Inconsistency (Lines 192-211)

**Problem**: E2E mode explicitly calls `performCleanup()` in signOut (line 199), but production relies on the `SIGNED_OUT` event listener (lines 91-95). This creates different execution paths and makes testing inconsistent with production.

**Actions**:
- Restructure `signOut()` method to ALWAYS explicitly call cleanup after sign out completes
- Use try-finally pattern to ensure cleanup runs regardless of success/failure:
  - Try block: Call `auth.signOut()` for non-E2E, skip for E2E
  - Finally block: Always execute `this.#updateAuthState(null)` followed by `this.#cleanup.performCleanup(userId)`
- Keep the event listener's cleanup call (lines 92-94) - it will be safely ignored by the `#cleanupInProgress` guard in AuthCleanupService
- Pattern reference: Exploration document lines 628-641 (consistent cleanup pattern)

**Edge Cases**:
- Double cleanup (explicit + event listener) is safe due to existing `#cleanupInProgress` guard in AuthCleanupService (lines 29-34)
- userId might be undefined if user was never logged in - performCleanup already handles this

**Benefits**:
- Predictable, synchronous cleanup behavior
- Test and production code paths are identical
- Easier to reason about state transitions

---

### `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.ts`

#### Issue 3: Race Condition - setTimeout Not Canceled (Lines 45-47)

**Problem**: `setTimeout()` is used to reset `#cleanupInProgress` flag after a delay, but if the service is destroyed before the timeout fires, the timeout leaks and tries to modify destroyed state.

**Actions**:
- Add `readonly #destroyRef = inject(DestroyRef)` to class properties
- Add private property `#resetTimeoutId: ReturnType<typeof setTimeout> | null = null` to track timeout
- In `#handleSignOut()` finally block:
  - Store timeout ID: `this.#resetTimeoutId = setTimeout(() => { this.#cleanupInProgress = false; }, CLEANUP_RESET_DELAY_MS)`
  - Register cleanup with DestroyRef: `this.#destroyRef.onDestroy(() => { if (this.#resetTimeoutId !== null) clearTimeout(this.#resetTimeoutId); })`
- Pattern reference: Exploration document lines 644-655 (setTimeout cleanup pattern)

**Edge Cases**:
- Multiple cleanups in quick succession - each creates a new timeout, need to clear previous
- Service destruction before timeout - DestroyRef callback handles this

**Benefits**:
- No leaked timers
- Safe service destruction
- No state mutations on destroyed services

---

### `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.ts`

#### Issue 4: Silent Catch Blocks (Lines 45, 80)

**Problem**: Catch blocks return generic error messages without logging, losing critical diagnostic information about UNEXPECTED failures (not user errors like wrong passwords).

**Critical Distinction** (per user requirement):
- **DO NOT LOG**: Expected user errors like wrong password, email already exists, account not found - these are handled by AuthErrorLocalizer and shown to users
- **DO LOG**: Unexpected technical errors like network failures, Supabase API crashes, JSON parsing errors - these indicate system problems we can act on

**Actions**:

**In `signInWithEmail()` catch block (line 45)**:
- Change `catch {` to `catch (error) {`
- Add logging: `this.#logger.error('Unexpected error during sign-in', { error })`
- Keep existing return statement unchanged
- This catches: Network failures, Supabase client crashes, unexpected exceptions
- This does NOT log: Wrong credentials (handled at line 36-40 via error response, not exception)

**In `signUpWithEmail()` catch block (line 80)**:
- Change `catch {` to `catch (error) {`
- Add logging: `this.#logger.error('Unexpected error during sign-up', { error })`
- Keep existing return statement unchanged
- This catches: Network failures, Supabase client crashes, unexpected exceptions
- This does NOT log: Email already exists (handled at line 71-75 via error response, not exception)

**Pattern reference**: Exploration document lines 72-92 (logger error pattern), but with critical caveat that we only log UNEXPECTED errors, not user-facing validation failures.

**Why Only Unexpected Errors**:
- User errors (wrong password, duplicate email) are expected application flow, not actionable bugs
- Logging them creates noise and provides no debugging value
- Technical errors (network, API crashes) indicate infrastructure issues that need investigation

**Edge Cases**:
- Error object might not be an Error instance - logger should handle this
- Error object contains sensitive data - logger responsibility to sanitize, not auth service's concern

---

## Testing Strategy

### Tests to Update

#### `auth-session.service.spec.ts`
**Issue 1 - Subscription Cleanup**:
- Add test: "should unsubscribe from auth state changes on destroy"
- Setup: Mock `onAuthStateChange` to return subscription with unsubscribe spy
- Action: Call `initializeAuthState()`, then manually invoke cleanup (test DestroyRef callback behavior)
- Assert: Verify unsubscribe was called
- Challenge: DestroyRef doesn't auto-trigger in TestBed for root services - need to test the callback directly

**Issue 6 - Dead Code Removal**:
- Remove any tests that reference `#setupMockStateObserver`
- Verify no tests break after method deletion

**Issue 5 - SSR Safety**:
- Add test: "should handle SSR context for E2E mock state"
- Setup: Mock `typeof window === 'undefined'` scenario (use jsdom or similar)
- Action: Call `#getE2EMockState()` (may need to make it public for testing or test via public method)
- Assert: Returns undefined without throwing

**Issue 7 - Cleanup Consistency**:
- Add test: "should perform explicit cleanup in signOut for production mode"
- Setup: Mock Supabase client, AuthCleanupService
- Action: Call `signOut()` with non-E2E mode
- Assert: Verify `performCleanup` was called synchronously (not just via event)
- Update existing E2E test to verify cleanup is still called

---

#### `auth-cleanup.service.spec.ts`
**Issue 3 - Timeout Cleanup**:
- Add test: "should clear reset timeout on service destroy"
- Setup: Call `performCleanup()` to start timeout
- Action: Manually invoke DestroyRef callback
- Assert: Verify timeout was cleared (spy on clearTimeout or verify flag doesn't reset after destroy)
- Mock setTimeout/clearTimeout if needed for deterministic testing

---

#### `auth-credentials.service.spec.ts`
**Issue 4 - Error Logging**:
- Add test: "should log unexpected error during sign-in"
- Setup: Spy on `logger.error`, mock Supabase to throw unexpected error (not AuthError)
- Action: Call `signInWithEmail()`
- Assert: Verify logger.error was called with 'Unexpected error during sign-in'

- Add test: "should log unexpected error during sign-up"
- Setup: Spy on `logger.error`, mock Supabase to throw unexpected error
- Action: Call `signUpWithEmail()`
- Assert: Verify logger.error was called with 'Unexpected error during sign-up'

- Add test: "should NOT log expected auth errors"
- Setup: Mock Supabase to return error response (not throw)
- Action: Call `signInWithEmail()` with wrong password scenario
- Assert: Verify logger.error was NOT called (error handled via return value)

---

### Manual Verification Steps

After all fixes:
1. Run `pnpm test` - all unit tests must pass
2. Run `pnpm test:e2e` - E2E tests should still work with new cleanup flow
3. Test sign-in with wrong credentials - verify NO error logs appear in console (expected user error)
4. Test sign-in with network failure (disconnect) - verify error IS logged to console
5. Verify no console errors or warnings about unsubscribed observables or leaked timers

---

## Documentation

No documentation updates required. Changes are internal implementation improvements that don't affect public API or usage patterns.

---

## Rollout Considerations

### Breaking Changes
**None**. All changes are internal implementation fixes that maintain existing public API contracts.

### Risks

**Medium Risk - Cleanup Timing Change**:
- Issue 7 changes signOut cleanup from async (event-driven) to sync (explicit)
- Impact: E2E tests might need timing adjustments if they rely on async cleanup
- Mitigation: Existing `#cleanupInProgress` guard prevents double-cleanup issues

**Low Risk - DestroyRef in Root Services**:
- DestroyRef rarely triggers for root services (they persist for app lifetime)
- Impact: Cleanup mainly matters in tests or dynamic service injection scenarios
- Mitigation: DestroyRef callbacks are defensive programming, no negative impact if never called

**Low Risk - Logging Changes**:
- Adding logs for unexpected errors could surface previously-hidden issues
- Impact: Might reveal existing infrastructure problems (good thing!)
- Mitigation: Logs are clearly marked as "unexpected" to distinguish from normal user errors

### Feature Flags
Not applicable - these are bug fixes, not features.

### Migration Steps
Not applicable - no migration needed for internal implementation fixes.

### Monitoring
After deployment:
- Monitor error logs for "Unexpected error during sign-in/sign-up" - these indicate system issues
- Verify NO increase in error logs for wrong credentials (should remain zero)
- Check for any memory leak indicators (auth subscriptions piling up)

---

## Future Improvements (Out of Scope)

While reviewing the codebase, additional SSR safety and error handling issues were identified but are NOT included in this plan to maintain focus:

1. **auth-oauth.service.ts:57** - Unsafe `window.location.origin` access
2. **auth-oauth.service.ts:69** - Silent catch block (similar to Issue 4)
3. **auth-interceptor.ts:76, 90** - Unsafe `window.location.href` access

These should be addressed in a separate task if SSR is enabled for the application.

---

## Success Criteria

- [ ] All 6 issues resolved according to actions above
- [ ] Unit tests updated and passing
- [ ] E2E tests still passing
- [ ] No console errors/warnings about subscriptions or timers
- [ ] Expected user errors (wrong password) NOT logged
- [ ] Unexpected system errors (network failure) ARE logged
- [ ] Code follows established patterns from codebase (DestroyRef, logger usage, SSR safety)

---

## Next Steps

After plan approval:
1. Run `/epct:tasks 42-fix-auth-refactor-issues` to divide plan into atomic tasks
2. OR run `/epct:code 42-fix-auth-refactor-issues` to execute plan directly
3. After implementation, run `pnpm quality` before committing
