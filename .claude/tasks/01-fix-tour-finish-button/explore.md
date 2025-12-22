# Task: Fix Tour Finish Button Not Closing Onboarding

## Problem Description
When clicking the "Terminer" (Finish) button on the last step of each tour in the onboarding, the tour does not close.

## Root Cause Analysis

### The Bug
In `frontend/projects/webapp/src/app/core/tour/tour-engine.service.ts:104-117`, the `onDestroyStarted` callback is implemented but **never calls `destroy()`**.

According to Driver.js documentation:
> When you define `onDestroyStarted`, you **MUST** explicitly call `driverObj.destroy()` - otherwise the tour will never close.

### Current Code (Buggy)
```typescript
onDestroyStarted: () => {
  if (this.#isDestroying) {
    return;
  }
  this.#isDestroying = true;

  this.#tourState.markTourCompleted(config.tourId);
  config.onComplete?.();
  this.#logger.info('Tour completed', { tourId: config.tourId });

  // Clean up reference - BUT NEVER CALLS destroy()!
  this.#currentDriver = null;
  this.#isDestroying = false;
},
```

### Why It Fails
1. User clicks "Terminer" button
2. Driver.js calls `onDestroyStarted` callback
3. The callback updates state but doesn't call `destroy()`
4. Driver.js waits for `destroy()` to be called (it never is)
5. Tour stays open indefinitely

## Documentation Insights

### Driver.js Callback Lifecycle
| Callback | When Called | Must Call destroy()? |
|----------|-------------|---------------------|
| `onDestroyStarted` | Before destruction begins | YES - mandatory |
| `onDestroyed` | After tour is fully closed | No (already destroyed) |
| `onComplete` | When user finishes all steps | No |

### Correct Pattern from Docs
```typescript
onDestroyStarted: () => {
  // Do cleanup work
  this.#tourState.markTourCompleted(config.tourId);

  // MUST call destroy() to actually close the tour
  this.#currentDriver?.destroy();
},
```

## Key Files

- `frontend/projects/webapp/src/app/core/tour/tour-engine.service.ts:104-117` - Bug location (onDestroyStarted callback)
- `frontend/projects/webapp/src/app/core/tour/tour-state.service.ts` - Tour state management (works correctly)
- `frontend/projects/webapp/src/app/feature/budget/tour/budget-tour.config.ts` - Budget tour config
- `frontend/projects/webapp/src/app/feature/current-month/tour/current-month-tour.config.ts` - Current month tour config
- `frontend/projects/webapp/src/app/feature/budget-templates/tour/templates-tour.config.ts` - Templates tour config

## Patterns to Follow

The fix should:
1. Store reference to driver before setting up callbacks
2. Call `destroy()` at the end of `onDestroyStarted`
3. Handle the `#isDestroying` flag to prevent infinite loops (since `destroy()` triggers `onDestroyStarted`)

## Fix Strategy

```typescript
onDestroyStarted: () => {
  if (this.#isDestroying) {
    return;
  }
  this.#isDestroying = true;

  this.#tourState.markTourCompleted(config.tourId);
  config.onComplete?.();
  this.#logger.info('Tour completed', { tourId: config.tourId });

  // CRITICAL FIX: Must call destroy() to close the tour
  this.#currentDriver?.destroy();

  // Clean up reference AFTER destroy
  this.#currentDriver = null;
  this.#isDestroying = false;
},
```

## Dependencies

- Driver.js library (already installed)
- No additional dependencies required

## Risk Assessment

- **Low risk** - Single line addition
- **No breaking changes** - Just adds missing required call
- **No side effects** - The `#isDestroying` flag prevents infinite recursion
