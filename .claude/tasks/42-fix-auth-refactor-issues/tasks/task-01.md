# Task: Fix Resource Cleanup Using DestroyRef

## Problem

Two memory leaks exist in auth services due to improper resource cleanup:

1. **Auth Subscription Leak** (auth-session.service.ts:80): The Supabase `onAuthStateChange()` listener creates a subscription that is never unsubscribed, causing memory leaks in long-running applications.

2. **Timeout Leak** (auth-cleanup.service.ts:45-47): A `setTimeout()` is used to reset the cleanup flag, but if the service is destroyed before the timeout fires, it leaks and attempts to modify destroyed service state.

Both issues violate Angular best practices for resource management in services.

## Proposed Solution

Use Angular's `DestroyRef` API to ensure proper cleanup when services are destroyed:

**Auth Session Service**:
- Capture the subscription returned by `onAuthStateChange()`
- Store the unsubscribe function
- Register cleanup with `DestroyRef.onDestroy()`

**Auth Cleanup Service**:
- Track the timeout ID from `setTimeout()`
- Clear the timeout when service is destroyed using `DestroyRef.onDestroy()`

This follows the established pattern used in Angular components throughout the project.

## Dependencies

- None (can start immediately)

## Context

- **DestroyRef pattern reference**: Exploration document lines 287-309
- **Timeout cleanup pattern**: Exploration document lines 644-655
- **Files to modify**:
  - `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts`
  - `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.ts`
- **Tests to update**:
  - `frontend/projects/webapp/src/app/core/auth/auth-session.service.spec.ts`
  - `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.spec.ts`

## Success Criteria

- [ ] Auth subscription is unsubscribed when auth-session service is destroyed
- [ ] Timeout is cleared when auth-cleanup service is destroyed
- [ ] Unit tests verify cleanup behavior
- [ ] No console warnings about leaked subscriptions or timers
- [ ] `pnpm test` passes for both service spec files
