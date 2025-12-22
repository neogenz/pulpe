# Implementation Plan: Code Review Fixes

## Overview

Fix 4 issues identified in code review:
- 2 Critical (security): Replace raw console usage with Logger service
- 2 Improvements: Replace @HostListener with host property in decorators

All changes are isolated to individual files with no cross-dependencies.

## Dependencies

None - each fix is independent.

## File Changes

### `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.ts`

- **Action**: Remove debug `console.log` statement at line 87-90
- **Reason**: Debug logging should not be in production code; if needed, use Logger service
- **Change**: Delete the entire `console.log(...)` call inside `currentStep` computed
- **Note**: This appears to be leftover debug code - remove entirely rather than converting to Logger

### `frontend/projects/webapp/src/app/core/routing/breadcrumb-state.ts`

- **Action 1**: Add Logger service injection
  - Import `Logger` from `@core/logging/logger`
  - Add `readonly #logger = inject(Logger);` after existing injections

- **Action 2**: Replace `console.warn` at line 89 with Logger
  - Change `console.warn("Erreur lors de la construction du fil d'Ariane:", error);`
  - To `this.#logger.warn("Erreur lors de la construction du fil d'Ariane", { error });`

### `frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.ts`

- **Action 1**: Remove `@HostListener` decorator and import
  - Remove `HostListener` from imports on line 6
  - Remove `@HostListener('keydown.enter')` decorator at line 214

- **Action 2**: Add `host` property to `@Component` decorator
  - Add `host: { '(keydown.enter)': 'onEnter()' }` inside `@Component({ ... })`
  - Place after `changeDetection` property

### `frontend/projects/webapp/src/app/feature/onboarding/steps/registration.ts`

- **Action 1**: Remove `@HostListener` decorator and import
  - Remove `HostListener` from imports on line 8 (within the `@angular/core` import)
  - Remove `@HostListener('keydown.enter')` decorator at line 198

- **Action 2**: Add `host` property to `@Component` decorator
  - Add `host: { '(keydown.enter)': 'onEnter()' }` inside `@Component({ ... })`
  - Place after `changeDetection` property

## Testing Strategy

- **Manual verification**:
  1. Run `pnpm quality` to ensure no type errors or lint issues
  2. Test onboarding flow: Enter key navigation should still work on welcome and registration pages
  3. Verify breadcrumb builds correctly (no console warnings in browser)

- **No new tests needed**: These are refactoring changes that don't alter behavior

## Documentation

No documentation changes needed.

## Rollout Considerations

- **No breaking changes**: All changes maintain existing behavior
- **No migration needed**: Direct code changes
- **Risk level**: Low - isolated fixes with no side effects
