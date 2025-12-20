# Implementation: Fix Tutorial Duplicate Event Listeners

## Completed

### 1. Fixed Duplicate Event Listener Bug (`tutorial.service.ts:88-90`)

Added `tourObject.off()` calls before `tourObject.on()` in `#registerTourEventListeners()` method:

```typescript
// Remove existing listeners to prevent duplicates when tour is restarted
tourObject.off('complete');
tourObject.off('cancel');
```

This ensures that when a tour is restarted (via help menu with `force: true`), the previous event listeners are removed before registering new ones.

### 2. Updated Mock (`tutorial.service.spec.ts`)

- Added `off: vi.fn()` to mock `tourObject` type definition (line 17)
- Added `off: vi.fn()` to mock factory function (line 36)

### 3. Added Event Handler Execution Tests

Added 4 new tests in `describe('event handling')` block:

| Test | Purpose |
|------|---------|
| `should mark tour as completed when complete event fires` | Verifies state updates on completion |
| `should mark tour as skipped when cancel event fires` | Verifies state updates on cancellation |
| `should remove existing listeners before adding new ones` | Verifies `off()` called before `on()` |
| `should persist completion to localStorage when tour completes` | Verifies localStorage persistence |

## Deviations from Plan

None. Implementation followed the plan exactly.

## Test Results

- **Typecheck**: ✓ Passed
- **Lint**: ✓ Passed (after fixing empty arrow function warnings)
- **Tests**: ✓ All 660 tests passed
  - Tutorial service: 32 tests (31 existing + 4 new - 3 merged)
  - Full test suite: 660 tests across 48 files

## Files Changed

| File | Change |
|------|--------|
| `core/tutorial/tutorial.service.ts` | Added `off()` calls in `#registerTourEventListeners()` (lines 88-90) |
| `core/tutorial/tutorial.service.spec.ts` | Added `off` to mock type + factory, added 4 event handling tests |

## Follow-up Tasks

None identified. The critical bug is fixed and all tests pass.

## Verification

To manually verify the fix:

1. Start the app with `pnpm dev`
2. Complete a tour from the help menu
3. Reopen help menu and start the same tour again
4. Complete the tour again
5. Check browser console - should see only ONE `[TutorialService] Event:` log per action
6. Check localStorage `pulpe-tutorial-state` - tour ID should appear only ONCE in `completedTours`
