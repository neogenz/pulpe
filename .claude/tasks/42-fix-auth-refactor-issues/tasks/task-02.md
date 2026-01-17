# Task: Add SSR Safety and Remove Dead Code

## Problem

Two code quality issues exist in `auth-session.service.ts`:

1. **Unsafe Window Access** (line 229): The `#getE2EMockState()` method directly casts `window` without checking if it exists, which will crash in server-side rendering (SSR) contexts.

2. **Dead Code** (lines 218-222, line 58): The `#setupMockStateObserver()` method only logs a message and serves no functional purpose. It's a vestigial method from a previous implementation that was never properly removed.

These issues create unnecessary risk and confusion in the codebase.

## Proposed Solution

**SSR Safety**:
- Add a guard to check window existence before accessing it
- Return `undefined` if running in SSR context
- Follow the established pattern from `e2e-window.ts`

**Dead Code Removal**:
- Delete the `#setupMockStateObserver()` method entirely
- Remove the call to this method in the constructor

Both changes are low-risk and improve code quality without affecting functionality.

## Dependencies

- None (can start immediately)
- Note: This task modifies the same file as Task 1, so should be done after Task 1 completes to avoid merge conflicts

## Context

- **File to modify**: `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts`
- **SSR pattern reference**: `e2e-window.ts` lines 163-168 (exploration document)
- **Dead code verification**: Method doesn't exist on main branch (confirmed via git history)
- **Test file**: `frontend/projects/webapp/src/app/core/auth/auth-session.service.spec.ts`

## Success Criteria

- [ ] `#getE2EMockState()` safely handles SSR context (returns undefined when window is unavailable)
- [ ] `#setupMockStateObserver()` method is completely removed
- [ ] Call to `#setupMockStateObserver()` is removed from code
- [ ] Unit test verifies SSR safety (handles `typeof window === 'undefined'`)
- [ ] No existing tests break after removing dead code
- [ ] `pnpm test` passes for auth-session.service.spec.ts
