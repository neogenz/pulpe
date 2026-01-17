# Task: Unify Cleanup Flow in Sign Out

## Problem

The `signOut()` method in `auth-session.service.ts` has inconsistent cleanup behavior:

- **E2E mode** (lines 192-211): Explicitly calls `performCleanup()` in signOut
- **Production mode**: Relies on the `SIGNED_OUT` event listener (lines 91-95) to trigger cleanup

This creates different execution paths between testing and production, making the code harder to reason about and test. The cleanup timing is unpredictable (async event-driven vs synchronous).

## Proposed Solution

Restructure `signOut()` to **always** explicitly call cleanup after sign out completes, regardless of mode:

- Use try-finally pattern to ensure cleanup runs whether signOut succeeds or fails
- Try block: Call Supabase `auth.signOut()` for non-E2E mode (skip for E2E)
- Finally block: Always execute `#updateAuthState(null)` and `#cleanup.performCleanup(userId)`
- Keep the event listener's cleanup call - it will be safely ignored by the existing `#cleanupInProgress` guard in AuthCleanupService

This makes test and production code paths identical and ensures predictable, synchronous cleanup.

## Dependencies

- **Task 1**: Should be completed first (modifies same file)
- **Task 2**: Should be completed first (modifies same file)
- This is the highest-risk change and should be done last

## Context

- **File to modify**: `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts`
- **Test files**:
  - `frontend/projects/webapp/src/app/core/auth/auth-session.service.spec.ts`
  - E2E tests may need verification
- **Pattern reference**: Exploration document lines 628-641 (consistent cleanup pattern)
- **Safety mechanism**: `#cleanupInProgress` guard in AuthCleanupService (lines 29-34) prevents double cleanup

## Success Criteria

- [ ] `signOut()` explicitly calls cleanup for both E2E and production modes
- [ ] Try-finally pattern ensures cleanup runs even if signOut fails
- [ ] Event listener cleanup is still present (for safety/backwards compatibility)
- [ ] Double cleanup is prevented by existing guard (no side effects)
- [ ] Unit tests verify synchronous cleanup behavior
- [ ] E2E tests still pass with new cleanup flow
- [ ] `pnpm test` and `pnpm test:e2e` both pass
