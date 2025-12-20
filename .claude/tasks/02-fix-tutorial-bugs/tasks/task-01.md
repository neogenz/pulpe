# Task: Add Event Listener Cleanup in Tutorial Service

## Problem

The tutorial service registers Shepherd.js event listeners (`complete`, `cancel`) each time `startTour()` is called, but never removes existing listeners first. This causes:
- Duplicate handlers firing on tour completion/cancellation
- Memory leaks from accumulated listeners
- Duplicate state updates and localStorage writes

## Proposed Solution

Add `tourObject.off()` calls before `tourObject.on()` calls in the `#registerTourEventListeners()` method to ensure clean listener state before registering new handlers.

## Dependencies

- None (can start immediately)

## Context

- **Target file:** `frontend/projects/webapp/src/app/core/tutorial/tutorial.service.ts`
- **Target method:** `#registerTourEventListeners()` (lines 79-95)
- **Shepherd API:** `off(eventName)` without second argument removes ALL listeners for that event
- **Events to clean:** `complete` and `cancel`

## Success Criteria

- `off('complete')` called before `on('complete', ...)`
- `off('cancel')` called before `on('cancel', ...)`
- Existing tests still pass
- Manual test: completing same tour twice produces only ONE log entry per action
