# Implementation Plan: Fix afterRenderEffect + Mutualize Tutorial Auto-Start

## Overview

1. **Fix**: Stop `afterRenderEffect` from continuously re-evaluating by calling `ref.destroy()` once data loads
2. **Mutualize**: Create a utility function to eliminate 4x code duplication

## Dependencies

Create utility function first, then refactor all 4 components to use it.

## File Changes

### 1. `frontend/projects/webapp/src/app/core/tutorial/tutorial.utils.ts` (NEW FILE)

- Action: Create new utility file with `autoStartTourWhenReady` function
- Function signature:
  ```
  autoStartTourWhenReady(
    tutorialService: TutorialService,
    tourId: TourId,
    isDataLoaded: () => boolean
  ): void
  ```
- Logic:
  1. Create `afterRenderEffect` and capture the ref
  2. When `isDataLoaded()` returns true:
     - Call `ref.destroy()` to stop the effect
     - Check `hasSeenTour(tourId)`
     - If not seen, call `startTour(tourId)`
- Export from module for use in feature components

### 2. `frontend/projects/webapp/src/app/core/tutorial/index.ts`

- Action: Re-export the new utility function
- Add: `export { autoStartTourWhenReady } from './tutorial.utils';`

### 3. `frontend/projects/webapp/src/app/feature/current-month/current-month.ts`

- Action: Replace inline `afterRenderEffect` with utility function call
- Remove: Lines 231-246 (entire afterRenderEffect block + console.logs)
- Add: Single line call to `autoStartTourWhenReady`
- Import: Add `autoStartTourWhenReady` from `@core/tutorial`
- Data condition: `() => this.store.dashboardStatus() !== 'loading' && this.store.dashboardStatus() !== 'error'`

### 4. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts`

- Action: Replace inline `afterRenderEffect` with utility function call
- Remove: Lines 204-213 (entire afterRenderEffect block)
- Add: Single line call to `autoStartTourWhenReady`
- Import: Add `autoStartTourWhenReady` from `@core/tutorial`
- Data condition: `() => !this.store.isLoading() && !this.store.hasError()`

### 5. `frontend/projects/webapp/src/app/feature/budget-templates/list/template-list-page.ts`

- Action: Replace inline `afterRenderEffect` with utility function call
- Remove: Lines 139-148 (entire afterRenderEffect block)
- Add: Single line call to `autoStartTourWhenReady`
- Import: Add `autoStartTourWhenReady` from `@core/tutorial`
- Data condition: `() => this.state.budgetTemplates.status() === 'resolved'`

### 6. `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`

- Action: Replace inline `afterRenderEffect` with utility function call
- Remove: Lines 121-132 (entire afterRenderEffect block)
- Add: Single line call to `autoStartTourWhenReady`
- Import: Add `autoStartTourWhenReady` from `@core/tutorial`
- Data condition: `() => this.state.budgets.status() === 'resolved' || this.state.budgets.status() === 'local'`

## Final Usage Pattern

Each component constructor will have a single clean line:

```typescript
constructor() {
  autoStartTourWhenReady(
    this.#tutorialService,
    'dashboard-welcome',
    () => this.store.dashboardStatus() !== 'loading'
  );
}
```

## Testing Strategy

- Manual verification: Navigate to each page
  - Should see NO repeated console activity
  - Tour should still start correctly on first visit
  - Tour should NOT start if already seen
- Run existing tutorial tests: `pnpm test -- tutorial.service.spec.ts`

## Documentation

None required - internal refactoring.

## Rollout Considerations

None - internal optimization with no user-facing changes.
