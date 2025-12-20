# Implementation Plan: Fix Tutorial Duplicate Event Listeners

## Overview

Fix the critical bug where Shepherd.js event listeners are registered multiple times when `startTour()` is called repeatedly. Each call to `startTour()` currently adds NEW `complete` and `cancel` listeners without removing existing ones, causing duplicate state updates and memory leaks.

**Approach:** Add `tourObject.off()` calls before `tourObject.on()` to ensure clean listener state.

## Dependencies

No external dependencies. Changes are isolated to the tutorial service and its tests.

**Order of implementation:**
1. Fix the service (tutorial.service.ts)
2. Update mock to support `off()` method (tutorial.service.spec.ts)
3. Add event handler execution tests (tutorial.service.spec.ts)
4. Verify with existing tests

---

## File Changes

### `frontend/projects/webapp/src/app/core/tutorial/tutorial.service.ts`

**Location:** `#registerTourEventListeners()` method (lines 79-95)

- **Action 1:** Add listener cleanup before registration
  - Call `tourObject.off('complete')` to remove any existing complete listeners
  - Call `tourObject.off('cancel')` to remove any existing cancel listeners
  - Place these calls immediately after the null check and before the `on()` calls

- **Why:** Shepherd.js `on()` method accumulates listeners. Without `off()`, restarting a tour stacks duplicate handlers that all fire on tour completion/cancellation.

- **Consider:** The `off()` method without a second argument removes ALL listeners for that event, which is exactly what we want since we're the only code registering these events.

---

### `frontend/projects/webapp/src/app/core/tutorial/tutorial.service.spec.ts`

**Location 1:** Mock ShepherdService factory (lines 26-38)

- **Action 1:** Add `off` method to mock tourObject
  - Add `off: vi.fn()` alongside existing `on: vi.fn()` in the tourObject mock
  - This allows the service's new `off()` calls to execute without errors

**Location 2:** New test section for event handling (after line 256)

- **Action 2:** Add `describe('event handling')` block with the following tests:

- **Test 1:** "should mark tour as completed when complete event fires"
  - Capture the `complete` handler when `on('complete', handler)` is called
  - Call `startTour('dashboard-welcome')`
  - Invoke the captured handler
  - Assert: `state().completedTours` contains `'dashboard-welcome'`
  - Assert: `state().isActive` is `false`
  - Assert: `state().currentTour` is `null`

- **Test 2:** "should mark tour as skipped when cancel event fires"
  - Capture the `cancel` handler when `on('cancel', handler)` is called
  - Call `startTour('dashboard-welcome')`
  - Invoke the captured handler
  - Assert: `state().skippedTours` contains `'dashboard-welcome'`
  - Assert: `state().isActive` is `false`
  - Assert: `state().currentTour` is `null`

- **Test 3:** "should remove existing listeners before adding new ones"
  - Call `startTour('dashboard-welcome')`
  - Assert: `tourObject.off` was called with `'complete'`
  - Assert: `tourObject.off` was called with `'cancel'`
  - Assert: `off` calls happen before `on` calls (check call order)

- **Test 4:** "should persist completion to localStorage when tour completes"
  - Capture the `complete` handler
  - Start tour and invoke complete handler
  - Assert: localStorage contains the tour ID in `completedTours`

- **Pattern:** Follow existing test patterns in the file:
  - Use `createMockShepherdService()` factory
  - Use `createService()` for fresh service instances
  - Use AAA pattern (Arrange-Act-Assert)
  - Clear localStorage in afterEach

---

## Testing Strategy

### Unit Tests to Add

| Test | Purpose | File |
|------|---------|------|
| Complete event fires handler | Verify state update on completion | tutorial.service.spec.ts |
| Cancel event fires handler | Verify state update on cancellation | tutorial.service.spec.ts |
| Listeners removed before adding | Verify `off()` called before `on()` | tutorial.service.spec.ts |
| Persistence on completion | Verify localStorage updated | tutorial.service.spec.ts |

### Manual Verification Steps

1. Start the app with `pnpm dev`
2. Complete a tour from the help menu
3. Reopen help menu and start the same tour again (using "Tour du tableau de bord")
4. Complete the tour again
5. Check browser console for duplicate log entries - there should be only ONE `[TutorialService] Event:` log per action
6. Verify localStorage `pulpe-tutorial-state` has the tour ID only ONCE in `completedTours`

### Run Existing Tests

```bash
cd frontend && pnpm test -- --filter tutorial.service
```

All 31 existing tests must pass after changes.

---

## Documentation

No documentation updates required. This is a bug fix with no API changes.

---

## Rollout Considerations

- **Breaking changes:** None
- **Migration:** None required
- **Feature flags:** Not needed
- **Risk:** Low - isolated change to internal event handling

---

## Summary Checklist

- [ ] Add `off()` calls in `#registerTourEventListeners()`
- [ ] Add `off: vi.fn()` to mock tourObject
- [ ] Add event handler execution tests (4 tests)
- [ ] Run full test suite
- [ ] Manual verification
