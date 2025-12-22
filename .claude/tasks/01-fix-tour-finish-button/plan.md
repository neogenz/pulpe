# Implementation Plan: Fix Tour Finish Button Not Closing Onboarding

## Overview

The tour system uses Driver.js with an `onDestroyStarted` callback. According to Driver.js documentation, when this callback is defined, `destroy()` must be called explicitly to close the tour. The current implementation never calls `destroy()`, causing tours to remain open indefinitely.

The fix is a single line addition: call `this.#currentDriver?.destroy()` before cleaning up the reference.

## Dependencies

None - this is a standalone bug fix with no dependencies on other changes.

## File Changes

### `frontend/projects/webapp/src/app/core/tour/tour-engine.service.ts`

**Location**: Lines 104-117 (the `onDestroyStarted` callback)

- **Action**: Add `this.#currentDriver?.destroy()` call before cleaning up the `#currentDriver` reference
- **Rationale**: Driver.js requires explicit `destroy()` call when `onDestroyStarted` is defined
- **Order matters**: The `destroy()` call must happen BEFORE setting `#currentDriver = null`
- **Recursion protection**: The existing `#isDestroying` flag already prevents infinite loops when `destroy()` triggers `onDestroyStarted` again

**Current flow** (buggy):
1. Check `#isDestroying` guard → OK
2. Mark tour completed → OK
3. Call `onComplete` callback → OK
4. Log completion → OK
5. Set `#currentDriver = null` → ❌ Missing destroy() before this
6. Set `#isDestroying = false` → OK

**Fixed flow**:
1. Check `#isDestroying` guard
2. Mark tour completed
3. Call `onComplete` callback
4. Log completion
5. **Call `this.#currentDriver?.destroy()`** ← NEW
6. Set `#currentDriver = null`
7. Set `#isDestroying = false`

## Testing Strategy

### Manual Verification

1. Navigate to the Templates page (first visit to trigger tour)
2. Click through tour steps using "Suivant"
3. On last step, click "Terminer"
4. **Expected**: Tour closes, overlay disappears
5. Verify same behavior on Budget and Current Month tours

### E2E Tests (if needed)

No existing tour-specific tests found. The fix is trivial enough that manual verification is sufficient.

## Documentation

No documentation changes required - this is a bug fix.

## Rollout Considerations

- **Risk**: Low - single line addition
- **Breaking changes**: None
- **Rollback**: Simple revert if needed
- **Feature flags**: Not needed
