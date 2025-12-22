# Implementation: Fix Tour Finish Button Not Closing Onboarding

## Completed

- Added `this.#currentDriver?.destroy()` call in the `onDestroyStarted` callback in `tour-engine.service.ts:114`

## Deviations from Plan

None - implemented exactly as planned.

## Test Results

- Typecheck: ✓
- Lint: ✓ (All files pass linting)

## Files Changed

- `frontend/projects/webapp/src/app/core/tour/tour-engine.service.ts:114` - Added destroy() call

## Follow-up Tasks

None - fix is complete.
