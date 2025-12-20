# Implementation: Tutorial System Cleanup

## Completed

### 1. Logger Integration in TutorialService
- Replaced 5 `console.error` calls with `this.#logger.error()`
- Replaced 1 `console.warn` call with `this.#logger.warn()`
- Replaced 3 `console.info` calls with `this.#logger.info()` or `this.#logger.debug()`

### 2. PostHog Analytics Integration
- Injected `AnalyticsService` in `TutorialService`
- Implemented `#trackEvent()` method to send events to PostHog:
  - `tutorial_started` - when a tour begins
  - `tutorial_completed` - when a tour is finished
  - `tutorial_cancelled` - when a tour is cancelled
- Removed TODO comment from `#trackEvent()`

### 3. Magic Number Extraction
- Extracted `setTimeout(800)` delay to named constant `TUTORIAL_START_DELAY_MS`
- Removed redundant inline comment (now self-documenting via constant name)

### 4. Test Updates
- Added `mockLogger` factory with `debug`, `info`, `warn`, `error` methods
- Added `mockAnalyticsService` factory with `captureEvent` method
- Added providers for `Logger` and `AnalyticsService` in test setup
- Added 3 new analytics tracking tests:
  - `should track tutorial_started event when tour starts`
  - `should track tutorial_completed event when tour completes`
  - `should track tutorial_cancelled event when tour is cancelled`

## Files Modified

| File | Changes |
|------|---------|
| `core/tutorial/tutorial.service.ts` | Logger + Analytics injection, replaced 9 console.* calls |
| `core/tutorial/tutorial.service.spec.ts` | Added mocks and 3 analytics tests |
| `feature/current-month/current-month.ts` | Extracted `TUTORIAL_START_DELAY_MS` constant |

## Deviations from Plan

- **tutorial-configs.ts**: As decided in the plan, `console.error` calls in this file were NOT modified. These are low-level DOM errors in utility functions (`waitForElement`, `createSafeBeforeShowPromise`) where injecting a service would break the pattern.

## Test Results

- Typecheck: ✓
- Lint: ✓ (no new warnings)
- Format: ✓
- Tests: ✓ (663 tests passed, including 35 tutorial.service tests)

## Follow-up Tasks

None identified. All planned items completed.

## Verification Checklist

- [x] Logger replaces all console.* calls in TutorialService
- [x] AnalyticsService integrated with PostHog event tracking
- [x] TODO comment removed from #trackEvent()
- [x] Magic number extracted to named constant
- [x] Tests updated with proper mocks
- [x] New tests cover analytics tracking behavior
- [x] All existing tests still pass
