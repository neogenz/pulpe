# Implementation: Fix afterRenderEffect Continuous Triggering

## Completed

- Added `autoStartWhenReady()` method directly to `TutorialService`
- Method uses `afterRenderEffect` with injector option to work from service
- Effect destroys itself via `ref.destroy()` once data loads
- Refactored 4 feature components to use the new service method:
  - `current-month.ts` (dashboard-welcome tour)
  - `budget-details-page.ts` (budget-management tour)
  - `template-list-page.ts` (templates-intro tour)
  - `budget-list-page.ts` (budget-calendar tour)
- Removed debug `console.log` statements
- Deleted unused `tutorial.utils.ts` file (initially created, then removed)

## Deviations from Initial Plan

- **Moved from utility function to service method**: Instead of a standalone utility function, the logic was placed directly in `TutorialService.autoStartWhenReady()`. This is architecturally correct - tutorial logic belongs in the tutorial service.
- Components now inject `Injector` and pass it to the service method

## Test Results

- Typecheck: ✓
- Lint: ✓ All files pass linting
- Tests: ✓ 665 tests passed (including 37 tutorial.service.spec.ts tests)

## Files Changed

| File | Change |
|------|--------|
| `core/tutorial/tutorial.service.ts` | Added `autoStartWhenReady()` method |
| `feature/current-month/current-month.ts` | Use service method + inject Injector |
| `feature/budget/budget-details/budget-details-page.ts` | Use service method + inject Injector |
| `feature/budget-templates/list/template-list-page.ts` | Use service method + inject Injector |
| `feature/budget/budget-list/budget-list-page.ts` | Use service method + inject Injector |

## Final Pattern

```typescript
// Component
readonly #tutorialService = inject(TutorialService);
readonly #injector = inject(Injector);

constructor() {
  this.#tutorialService.autoStartWhenReady(
    'dashboard-welcome',
    () => this.store.dashboardStatus() !== 'loading',
    this.#injector,
  );
}
```

## Follow-up Tasks

None - implementation complete.
