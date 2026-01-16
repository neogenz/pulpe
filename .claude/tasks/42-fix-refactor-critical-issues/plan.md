# Implementation Plan: Fix Critical Issues in Auth Refactor

## Overview

Fix 5 critical issues identified in the PR review comparing `refactor-e2e-window` vs `fix_webapp_nav_delay` branches:

1. **Breaking Change**: Missing `hasValue` signal breaks consumers
2. **Logic Error**: Duplicate `updateAuthState(null)` call in signOut
3. **E2E Bug**: Mock state not updated on signOut
4. **CRITICAL Data Integrity**: signOut can skip cleanup on errors
5. **Silent Failures**: Empty catch blocks lose error context

**Note**: Budget preload removal was INTENTIONAL (task 40 documentation) to eliminate auth→budget dependency. Not a regression.

**Strategy**: Implement in 3 phases - quick wins, signOut hardening, and test coverage.

## Dependencies

- Phase 1 (hasValue, silent failures) can be done first - independent
- Phase 2 (signOut fixes) should be done together - all related
- Phase 3 (tests) validates all changes

## File Changes

### Phase 1: Quick Wins

#### `frontend/projects/webapp/src/app/core/auth/auth-state.service.ts`

**Issue**: Missing `hasValue` computed signal that existed in original AuthApi

**Actions**:
- Add computed signal after line 26: `readonly hasValue = computed(() => !!this.#userSignal());`
- This provides backward compatibility for consumers using `authApi.hasValue()`
- Signal returns true if user exists, false otherwise

**Consider**: Check if auth-api.ts facade exists and needs to expose this signal

---

#### `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.ts`

**Issue**: Empty catch blocks at lines 45-49 and 80-84 suppress errors without logging

**Actions for `signInWithEmail` (lines 45-49)**:
- Change `} catch {` to `} catch (error) {`
- Add before return statement: `this.#logger.error('Unexpected error during email sign in:', error);`
- Preserve existing return value with generic error message

**Actions for `signUpWithEmail` (lines 80-84)**:
- Change `} catch {` to `} catch (error) {`
- Add before return statement: `this.#logger.error('Unexpected error during email sign up:', error);`
- Preserve existing return value with generic error message

**Why**: Network timeouts, JSON parsing errors, client failures are now visible in logs for debugging

---

### Phase 2: SignOut Flow Hardening

#### `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.ts`

**Issue**: If any cleanup operation throws, subsequent operations don't execute (lines 38-48)

**Actions**:
- Wrap `this.#state.setLoading(false)` in try-catch with error logging
- Wrap `this.#demoModeService.deactivateDemoMode()` in try-catch, log: `'Failed to deactivate demo mode during cleanup:'`
- Wrap `this.#hasBudgetCache.clear()` in try-catch, log: `'Failed to clear budget cache during cleanup:'`
- Wrap `this.#postHogService.reset()` in try-catch, log: `'Failed to reset PostHog during cleanup:'`
- Wrap `this.#storageService.clearAll(userId)` in try-catch, log: `'Failed to clear storage during cleanup:'`
- Keep existing finally block unchanged (ensures cleanupInProgress flag is always reset)

**Pattern**: Each operation in individual try-catch so one failure doesn't block others

**Consider**: The debounce mechanism (#cleanupInProgress + setTimeout) already prevents duplicate calls, so multiple cleanup attempts are safe

---

#### `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts`

**Issue**: Multiple problems in signOut method (lines 192-211)
- Cleanup doesn't happen if exception thrown
- E2E mock state not reset
- Duplicate updateAuthState call (line 207)

**Actions**:
- In E2E bypass path (lines 196-200), add BEFORE `this.#updateAuthState(null)`:
  ```typescript
  this.#setE2EMockState({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
  });
  ```

- Refactor non-E2E path (lines 202-207) to use finally block:
  - Remove line 207 `this.#updateAuthState(null);`
  - Add finally block after catch block:
    ```typescript
    } finally {
      this.#updateAuthState(null);
      this.#cleanup.performCleanup(userId);
    }
    ```

**Result**:
- Cleanup ALWAYS happens (success, error, Supabase error)
- E2E mock state properly reset
- No duplicate updateAuthState (event handler may also call it, but that's safe - idempotent)
- CleanupService debounce prevents duplicate cleanup execution

**Why**: finally block guarantees cleanup runs regardless of success/failure path

---

### Phase 3: Test Coverage

#### `frontend/projects/webapp/src/app/core/auth/auth-state.service.spec.ts`

**Issue**: No test for new hasValue computed signal

**Actions**:
- Add test after existing signal tests: `it('should compute hasValue based on user existence', () => {})`
- Arrange: Start with no session (hasValue should be false)
- Act: Set session with user
- Assert: hasValue() returns true
- Act: Set session to null
- Assert: hasValue() returns false

**Pattern**: Follow existing test structure in file (uses Vitest, TestBed, AAA pattern)

---

#### `frontend/projects/webapp/src/app/core/auth/auth-session.service.spec.ts`

**Issue**: Missing test for PRIMARY BUG FIX (commit c61e203e6) - multiple initialization prevention

**Actions**:
- Add test: `it('should prevent duplicate auth subscriptions when initialized multiple times', async () => {})`
- Arrange: Mock getSession to return valid session
- Capture onAuthStateChange callback via spy
- Act: Call initializeAuthState() three times in parallel using Promise.all()
- Assert: onAuthStateChange called exactly once
- Act: Trigger SIGNED_OUT event via captured callback
- Assert: cleanup.performCleanup called exactly once (not three times)

**Why**: Verifies the initialization guard prevents multiple subscriptions that cause duplicate cleanup calls

---

**Issue**: Missing tests for signOut cleanup in all paths

**Actions**:
- Add test: `it('should cleanup on successful signOut', async () => {})`
  - Mock signOut to succeed
  - Verify updateAuthState(null) called
  - Verify cleanup.performCleanup called with userId

- Add test: `it('should cleanup even when signOut throws exception', async () => {})`
  - Mock signOut to throw error
  - Verify updateAuthState(null) still called
  - Verify cleanup.performCleanup still called
  - Verify error logged

- Add test: `it('should update E2E mock state on signOut in E2E mode', () => {})`
  - Set E2E bypass mode
  - Call signOut
  - Verify window.__E2E_MOCK_AUTH_STATE__ set to null state
  - Verify cleanup called

**Pattern**: Use vi.fn() mocks, follow AAA structure, verify finally block behavior

---

#### `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.spec.ts`

**Issue**: Nice to have - verify errors are logged (not critical)

**Actions** (optional):
- Add test for signInWithEmail: verify logger.error called when exception thrown
- Add test for signUpWithEmail: verify logger.error called when exception thrown

**Why**: Ensures error visibility is maintained

---

## Testing Strategy

**Unit Tests**:
- All service changes have corresponding spec updates
- Focus on behavioral changes, not implementation details
- Use AAA pattern consistently

**E2E Tests**:
- Run existing Playwright suite: `pnpm test:e2e`
- Verify auth flow still works in E2E mode
- Verify signOut properly resets mock state

**Manual Verification**:
1. Logout → verify PostHog reset, storage cleared
2. Login with network error → verify cleanup still happens
3. Check browser console for new error logs (silent failures now visible)

**Quality Check**:
- Run `pnpm quality` before commit (catches formatting/lint)
- Run `pnpm test` to verify all unit tests pass

---

## Rollout Considerations

**Breaking Changes**:
- hasValue signal addition is backward compatible (adds feature, doesn't break)
- Check if any code imports auth-api.ts directly - verify hasValue is exposed

**Performance Impact**:
- Cleanup hardening adds minimal overhead (try-catch is cheap)
- Budget preload removal is intentional architectural improvement (see task 40 docs)

**Error Visibility**:
- Developers will now see previously silent errors in logs
- This is GOOD - makes debugging easier
- May reveal existing issues that were hidden

**Data Integrity**:
- signOut cleanup now guaranteed - reduces risk of auth state corruption
- Multiple cleanup calls are safe (debounced)

**Migration Steps**:
1. Apply Phase 1 fixes (low risk)
2. Apply Phase 2 fixes (test thoroughly - critical path)
3. Apply Phase 3 tests
4. Run full test suite
5. Manual testing of auth flows
6. Deploy to staging first

**Monitoring**:
- Watch for new error logs from previously silent failures
- Check PostHog for successful resets on logout
- Verify signOut cleanup reliability

---

## Risk Assessment

**Low Risk**:
- hasValue signal addition
- Error logging in catch blocks
- Cleanup service hardening (existing code works, making it more resilient)

**High Risk**:
- signOut finally block refactor (critical path, touches auth flow)
- **MITIGATION**: Thorough testing, multiple test cases, E2E verification

**Overall Risk**: Medium - Most changes are additive or hardening. signOut refactor is the only structural change to critical path.

---

## Budget Preload Clarification

The PR review flagged budget preload removal as a "performance regression." However, task 40 documentation shows this was **intentional**:

**From `.claude/tasks/40-refactor-auth-api-service-split/implementation.md`:**
> **Decision**: Removed `#preloadHasBudgetFlag()` and BudgetApi injection entirely from auth services.
> **Rationale**: Per exploration recommendation, guards already handle cache miss gracefully. This eliminates the auth → budget dependency and simplifies the architecture.
> **Impact**: None. Fast path uses cache (instant), slow path fetches only on first navigation.

**Why this is correct:**
- Eliminates circular dependency risk (auth → budget)
- Guard handles cache miss gracefully (has-budget.guard.ts:43-52)
- Cache fills on first navigation (one-time minimal delay)
- Improves separation of concerns
- Follows clean architecture principles

**Conclusion**: Not a bug to fix. This is an architectural improvement.

---

## Next Steps

After plan approval:
1. Run `/epct:tasks 42-fix-refactor-critical-issues` to break into granular tasks
2. OR run `/epct:code 42-fix-refactor-critical-issues` to execute plan directly
3. Consider doing Phase 1 + Phase 2 first, then Phase 3 separately (smaller PRs)

---

## Notes

- All line numbers reference current `refactor-e2e-window` branch state
- SignOut finally block approach ensures cleanup always happens (idempotent operations safe)
- Cleanup service try-catch per operation ensures partial failures don't cascade
- Tests focus on behavioral outcomes, not implementation details
- Budget preload removal was intentional per task 40 documentation (not a regression)
