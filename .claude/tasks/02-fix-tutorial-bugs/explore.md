# Task: Fix Tutorial/Onboarding Critical Bugs

## Executive Summary

The tutorial system uses Shepherd.js via `angular-shepherd`. After thorough analysis, **the PR review report identified issues that have already been fixed in the current code**. However, there is **one critical bug remaining**: duplicate event listener registration.

---

## Analysis of Reported Issues vs Actual Code

### Issue 1: 🔴 "Tours cannot be relaunched from help menu" → **ALREADY FIXED**

**Reported Problem:** `startTour()` silently returns if tour is completed.

**Actual Code (tutorial.service.ts:102-113):**
```typescript
startTour(tourId: TourId, options?: StartTourOptions): void {
  // ...
  // Check if already completed (skip check if force is true)
  if (!options?.force && this.hasCompletedTour(tourId)) {
    console.info(`[TutorialService] Tour already completed: ${tourId}`);
    return;
  }
```

**And in main-layout.ts:268-303**, all help menu buttons use `{ force: true }`:
```typescript
(click)="tutorialService.startTour('dashboard-welcome', { force: true })"
```

**Status:** ✅ **ALREADY IMPLEMENTED** - `force` option exists and is used in help menu.

---

### Issue 2: 🔴 "Events never registered because tourObject is null" → **ALREADY FIXED**

**Reported Problem:** Event listeners attached in constructor when `tourObject` is null.

**Actual Code (tutorial.service.ts:67-95):**
```typescript
#initializeShepherd(): void {
  this.#shepherdService.defaultStepOptions = defaultStepOptions;
  this.#shepherdService.modal = true;
  this.#shepherdService.confirmCancel = false;
  // Note: Event listeners are registered in startTour() after addSteps()
  // because tourObject is only available after a tour is created
}

#registerTourEventListeners(): void {
  const tourObject = this.#shepherdService.tourObject;
  if (!tourObject) {
    console.error('[TutorialService] Cannot register events: tourObject is null');
    return;
  }
  tourObject.on('complete', () => this.#handleTourComplete());
  tourObject.on('cancel', () => this.#handleTourCancel());
}
```

**And in startTour() (lines 123-131):**
```typescript
this.#shepherdService.addSteps(tour.steps);    // Creates tourObject
this.#registerTourEventListeners();             // Now tourObject exists
this.#shepherdService.start();
```

**Status:** ✅ **ALREADY IMPLEMENTED** - Events are registered AFTER `addSteps()`.

---

## REMAINING CRITICAL BUG

### 🔴 BUG: Duplicate Event Listener Registration

**Location:** `tutorial.service.ts:79-95` and `127-128`

**Problem:** Each call to `startTour()` registers NEW event listeners without removing old ones.

**Flow Analysis:**
1. User starts "dashboard-welcome" tour → `on('complete')` registered (1 listener)
2. User cancels tour → `cancel` event fires, but listeners remain on `tourObject`
3. User starts "dashboard-welcome" again → `on('complete')` registered again (2 listeners)
4. User completes → `#handleTourComplete()` fires TWICE
5. Tour ID added to `completedTours` TWICE

**Impact:**
- Memory leak (listener accumulation)
- Duplicate state updates
- Duplicate analytics events
- Potential race conditions

**Root Cause:** Shepherd.js `tourObject.on()` adds listeners but doesn't replace them. The service never calls `off()` to remove old listeners.

**Fix Required:** Either:
1. Remove old listeners before adding new ones with `tourObject.off()`
2. Use `tourObject.once()` instead of `tourObject.on()` for single-use listeners
3. Track if listeners are already registered and skip re-registration

---

## Other Issues Analysis

### Issue 3: 🟠 "beforeShowPromise rejection unhandled" → **PARTIALLY ADDRESSED**

**Location:** `tutorial-configs.ts:65-82`

**Current Implementation:**
```typescript
function createSafeBeforeShowPromise(selector: string, timeout = 10000) {
  return async function (this: { tour?: Tour }) {
    try {
      return await waitForElement(selector, timeout);
    } catch (error) {
      console.error('[Tutorial] Step skipped - element not found:', { selector, error });
      this.tour?.cancel();  // Cancels entire tour
      throw error;          // Re-throws error
    }
  };
}
```

**Issue:** When element not found, the tour is cancelled AND error is re-thrown. This is actually reasonable behavior - if a required UI element doesn't exist, the tour should stop.

**Status:** ⚠️ **WORKS BUT COULD BE IMPROVED** - Consider skipping step instead of cancelling entire tour.

---

### Issue 4: 🟠 "Use of `any` type forbidden" → **NOT AN ISSUE**

**Location:** `tutorial-configs.ts:122`

**Actual Code:**
```typescript
action(this: Tour) {
  return this.complete();
}
```

**Status:** ✅ **ALREADY CORRECT** - Uses `Tour` type from shepherd.js, not `any`.

---

### Issue 5: 🟠 "No unit tests" → **ALREADY EXISTS**

**Location:** `tutorial.service.spec.ts`

**Status:** ✅ **432 lines of tests exist** with comprehensive coverage:
- Initialization tests (5 tests)
- `startTour()` tests (11 tests including force option)
- `cancelTour()` tests (3 tests)
- `hasCompletedTour()` tests (2 tests)
- `hasCompletedAnyTour()` tests (2 tests)
- `resetAllTours()` tests (3 tests)
- `updatePreferences()` tests (2 tests)
- `getTour()` and `getAllTours()` tests (3 tests)

**Missing Test:** Event handler execution (complete/cancel callbacks)

---

### Issue 6: 🟠 "JSON parse without Zod validation" → **ALREADY IMPLEMENTED**

**Location:** `tutorial.service.ts:287-326`

**Actual Code:**
```typescript
#loadState(): TutorialState {
  try {
    const stored = localStorage.getItem('pulpe-tutorial-state');
    if (!stored) return DEFAULT_TUTORIAL_STATE;

    const rawData = JSON.parse(stored);
    const validated = TutorialStateSchema.parse(rawData);  // ← Zod validation

    // Filter only valid tour IDs
    const validTourIds = new Set(TOUR_IDS);
    const completedTours = validated.completedTours.filter(id => validTourIds.has(id as TourId));
    // ...
  } catch (error) {
    localStorage.removeItem('pulpe-tutorial-state');  // Clean corrupted data
    return DEFAULT_TUTORIAL_STATE;
  }
}
```

**Status:** ✅ **ALREADY IMPLEMENTED** - Uses Zod with `.parse()` inside try-catch.

---

## Key Files

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `core/tutorial/tutorial.service.ts` | Main service | 79-95, 127-128 (event registration) |
| `core/tutorial/tutorial-configs.ts` | Tour definitions | 65-82 (beforeShowPromise) |
| `core/tutorial/tutorial.types.ts` | Type definitions | Complete, no issues |
| `core/tutorial/tutorial.service.spec.ts` | Unit tests | Complete coverage, add event tests |
| `layout/main-layout.ts` | Help menu | 265-319 (force: true usage) |

---

## Patterns to Follow

### Service State Pattern (from tutorial.service.ts)
```typescript
readonly #state = signal<TutorialState>(this.#loadState());
readonly state = this.#state.asReadonly();
```

### Test Pattern (from tutorial.service.spec.ts)
```typescript
function createMockShepherdService() {
  return {
    tourObject: { on: vi.fn() },
    addSteps: vi.fn(),
    start: vi.fn(),
    cancel: vi.fn(),
  };
}

function createService() {
  mockShepherdService = createMockShepherdService();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      TutorialService,
      { provide: ShepherdService, useValue: mockShepherdService },
    ],
  });
  return TestBed.inject(TutorialService);
}
```

---

## Dependencies

- `angular-shepherd` - Shepherd.js Angular wrapper
- `shepherd.js` - Tour library (types: `Tour`, `StepOptions`)
- `@floating-ui/dom` - Tooltip positioning
- `zod` - Runtime validation

---

## Shepherd.js Event Handling Best Practices

From documentation research:

1. **Event methods available:**
   - `tour.on(event, handler)` - Add listener
   - `tour.off(event, handler?)` - Remove listener(s)
   - `tour.once(event, handler)` - One-time listener

2. **tourObject lifecycle:**
   - Created when `addSteps()` is called
   - Destroyed when tour ends or `cancel()` is called
   - Same instance reused if starting same tour without destroy

3. **Recommended pattern for event cleanup:**
```typescript
// Option 1: Use once() for single-fire events
tourObject.once('complete', handler);

// Option 2: Remove before adding
tourObject.off('complete');
tourObject.on('complete', handler);
```

---

## Recommended Fixes (Priority Order)

### Priority 1: Fix Duplicate Event Listeners (CRITICAL)

**In `tutorial.service.ts`, modify `#registerTourEventListeners()`:**

```typescript
#registerTourEventListeners(): void {
  const tourObject = this.#shepherdService.tourObject;
  if (!tourObject) {
    console.error('[TutorialService] Cannot register events: tourObject is null');
    return;
  }

  // Remove existing listeners to prevent duplicates
  tourObject.off('complete');
  tourObject.off('cancel');

  // Register fresh listeners
  tourObject.on('complete', () => this.#handleTourComplete());
  tourObject.on('cancel', () => this.#handleTourCancel());
}
```

### Priority 2: Add Test for Event Handler Execution

**In `tutorial.service.spec.ts`, add:**

```typescript
describe('event handling', () => {
  it('should call handleTourComplete when tour completes', () => {
    // Arrange
    let completeHandler: () => void = () => {};
    mockShepherdService.tourObject = {
      on: vi.fn((event, handler) => {
        if (event === 'complete') completeHandler = handler;
      }),
      off: vi.fn(),
    };

    service.startTour('dashboard-welcome');

    // Act: Simulate tour completion
    completeHandler();

    // Assert
    expect(service.state().completedTours).toContain('dashboard-welcome');
    expect(service.state().isActive).toBe(false);
  });
});
```

### Priority 3 (Optional): Improve beforeShowPromise Error Handling

Current behavior (cancel tour on missing element) is acceptable for V1. Consider for V2: skip step and continue to next.

---

## Summary

| Issue from PR Review | Actual Status | Action Needed |
|---------------------|---------------|---------------|
| Tours can't be relaunched | ✅ Already fixed (`force` option) | None |
| Events never registered | ✅ Already fixed (registered after addSteps) | None |
| Duplicate event listeners | 🔴 **REAL BUG** | Add `off()` before `on()` |
| beforeShowPromise errors | ⚠️ Works, could improve | Optional for V2 |
| `any` type usage | ✅ Uses `Tour` type | None |
| No unit tests | ✅ 432 lines exist | Add event handler test |
| JSON without Zod | ✅ Already uses Zod | None |

**Only 1 critical fix required:** Prevent duplicate event listener registration.
