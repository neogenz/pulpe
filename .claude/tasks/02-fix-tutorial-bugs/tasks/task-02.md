# Task: Add Event Handler Tests for Tutorial Service

## Problem

The tutorial service now cleans up event listeners before registering new ones, but there are no tests verifying:
- Event handlers actually execute and update state correctly
- Listeners are removed before being added
- Completion persists to localStorage

## Proposed Solution

Update the mock to support `off()` and add tests covering event handler execution, listener cleanup order, and persistence behavior.

## Dependencies

- **Task 1:** Add Event Listener Cleanup in Tutorial Service (must be completed first)

## Context

- **Target file:** `frontend/projects/webapp/src/app/core/tutorial/tutorial.service.spec.ts`
- **Mock location:** `createMockShepherdService()` factory (lines 26-38)
- **Test patterns:** AAA pattern, `vi.fn()` mocks, `createService()` helper
- **Handler capture:** Mock `on()` captures handlers, tests invoke them directly

## Success Criteria

- Mock tourObject has `off: vi.fn()` method
- Test: complete event fires → `completedTours` updated, `isActive` false
- Test: cancel event fires → `skippedTours` updated, `isActive` false
- Test: `off()` called for both events before `on()` calls
- Test: localStorage contains tour ID after completion
- All 31+ tests pass
