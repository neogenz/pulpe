# Task: Fix Race Condition in Product Tour Service

## Problem

The `ProductTourService` has a race condition when generating storage keys:

```typescript
#getTourKey(tourId: string): StorageKey {
  const userId = this.#authApi.currentUser?.id;  // Can be null during auth init!
  if (!userId) {
    return `pulpe-tour-${tourId}` as StorageKey;  // Generic key
  }
  return `pulpe-tour-${tourId}-${userId}` as StorageKey;  // User-specific key
}
```

If a user navigates to `/current-month` while auth is still initializing:
1. `currentUser?.id` is null → tour uses generic key `pulpe-tour-current-month`
2. Tour shows, user completes it → stored with generic key
3. Auth completes → userId now available
4. Next visit checks `pulpe-tour-current-month-{userId}` → NOT FOUND
5. Tour shows again!

## Proposed Solution

Make the service "auth-aware" with graceful degradation:
1. Add `isReady()` method that checks if userId is available
2. Modify public methods to return safe defaults when not ready:
   - `hasSeenIntro()` / `hasSeenPageTour()` → return `true` (don't show tour if auth not ready)
   - `startPageTour()` → return early without starting
3. Remove the fallback generic key - always require user-specific keys

This ensures tours only run when auth is fully initialized, preventing key mismatch.

## Dependencies

- None (independent task, can run in parallel with Tasks 1 and 4)

## Context

- Current fallback key at `product-tour.service.ts:51-57` causes the race condition
- Other guards use `toObservable(authApi.authState).pipe(filter(!isLoading), take(1))` to wait for auth
- Tests at `product-tour.service.spec.ts:153-162` test fallback behavior (will need updating)
- Components trigger tours in `afterNextRender()` with delay (e.g., `current-month.ts:244-253`)

Key files:
- `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.ts:51-57`
- `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.spec.ts:153-162`

Pattern: Service checks auth readiness before performing user-specific operations.

## Success Criteria

- New `isReady()` method returns true only when `currentUser.id` is available
- `hasSeenIntro()` / `hasSeenPageTour()` return `true` when not ready (graceful degradation)
- `startPageTour()` does nothing when not ready
- No more fallback generic keys (`pulpe-tour-{tourId}` without userId)
- Tests updated to verify new behavior
- Manual test: Tour doesn't re-appear after completing it in one session
