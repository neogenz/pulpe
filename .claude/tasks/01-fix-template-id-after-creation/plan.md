# Implementation Plan: Fix template ID undefined after creation

## Overview

Fix a type mismatch bug where the API returns `{ data: { template, lines } }` but the code treats it as `{ data: template }`, causing undefined IDs when navigating to newly created templates.

## Dependencies

None - these are isolated changes with no external dependencies.

## File Changes

### `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-api.ts`

**Line 37-38:** Fix return type of `create$()` method
- Change return type from `Observable<BudgetTemplateResponse>` to `Observable<BudgetTemplateCreateResponse>`
- Change generic type in `http.post<>` call accordingly
- Note: `BudgetTemplateCreateResponse` is already imported at line 7

### `frontend/projects/webapp/src/app/feature/budget-templates/services/budget-templates-state.ts`

**Line 82:** Fix data access in optimistic update replacement
- Change `response.data` to `response.data.template`
- This accesses the actual template object instead of the wrapper

**Line 86:** Fix return value
- Change `return response.data` to `return response.data.template`
- Ensures `BudgetTemplate` is returned for navigation

## Testing Strategy

### Manual Verification
1. Start the application with `pnpm dev`
2. Navigate to budget templates page
3. Create a new template
4. Without refreshing, click on the newly created template card
5. Verify URL shows correct UUID (not "undefined")
6. Verify template details page loads correctly

### Automated Tests
- No new tests needed - existing tests should pass
- Run `pnpm quality` to ensure type-checking passes with the new types

## Documentation

No documentation changes required.

## Rollout Considerations

- No breaking changes
- No migration needed
- Safe to deploy immediately
