# Implementation: Reset Detached Budget Line from Template

## Completed

### Backend
- Added `resetFromTemplate()` method in `budget-line.service.ts`:
  - Fetches budget line and validates `template_line_id` exists
  - Fetches template line data from `template_line` table
  - Updates budget line with template values (name, amount, kind, recurrence)
  - Sets `is_manually_adjusted = false` to re-enable propagation
  - Recalculates budget balances after update

- Added `POST /budget-lines/:id/reset-from-template` endpoint in `budget-line.controller.ts`:
  - Full OpenAPI documentation
  - Returns 400 if budget line has no template
  - Returns 404 if template line was deleted

### Frontend
- Added `resetFromTemplate$()` method in `budget-line-api.ts`:
  - Calls POST endpoint
  - Returns custom error message for deleted templates (404)

- Updated `budget-table-models.ts`:
  - Added `canResetFromTemplate` metadata field
  - Added `isLoading` metadata field

- Updated `budget-table-data-provider.ts`:
  - Computes `canResetFromTemplate = isPropagationLocked`

- Updated `budget-table.ts`:
  - Transformed lock icon to clickable button
  - Added confirmation dialog on click
  - Added `resetFromTemplate` output event
  - Updated tooltip text: "Montants verrouillés. Cliquer pour réinitialiser depuis le modèle."

- Added `resetBudgetLineFromTemplate()` method in `budget-details-store.ts`:
  - Calls API and updates local state with server response
  - Error handling with re-throw for UI feedback

- Updated `budget-details-page.ts`:
  - Added `handleResetFromTemplate()` method
  - Shows success snackbar on reset
  - Shows error snackbar with message on failure

## Deviations from Plan

- Skipped adding `template-api.ts` method - the backend endpoint handles all the logic in one call, which is cleaner than having the frontend fetch template line separately.

## Test Results

- Typecheck: ✓
- Backend lint: ✓
- Frontend lint: ✓
- Frontend tests: ✓ (645 tests pass)
- Backend tests: ✓ (13 tests pass)

## Files Modified

### Backend (2 files)
- `backend-nest/src/modules/budget-line/budget-line.service.ts`
- `backend-nest/src/modules/budget-line/budget-line.controller.ts`

### Frontend (6 files)
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line-api/budget-line-api.ts`
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-models.ts`
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-data-provider.ts`
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`
- `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts`

## Follow-up Tasks

- Consider adding unit tests specifically for the reset functionality
- Consider adding E2E test for the complete reset flow
