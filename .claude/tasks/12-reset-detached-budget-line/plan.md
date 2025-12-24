# Implementation Plan: Reset Detached Budget Line from Template

## Overview

Transform the lock icon for manually adjusted budget lines into a clickable button that opens a confirmation dialog. When confirmed, reset the budget line values to match the original template line and set `isManuallyAdjusted = false`.

**User flow:**
1. User sees lock icon button on detached lines (lines with `isPropagationLocked = true`)
2. Click opens confirmation dialog asking to reset to template values
3. If template line was deleted (`templateLineId` exists but template line is gone), show error snackbar
4. On confirmation, fetch template line and update budget line with template values

## Dependencies

- **Backend endpoint exists**: `GET /budget-templates/:templateId/lines/:lineId` (findTemplateLine)
- **ConfirmationDialog** already exists at `@ui/dialogs/confirmation-dialog`
- **MatSnackBar** pattern already used in `budget-details-page.ts`

## File Changes

### 1. `frontend/projects/webapp/src/app/core/template/template-api.ts`

- **Add method** `getTemplateLine$(templateId: string, lineId: string): Observable<TemplateLine>`
  - Call `GET ${apiUrl}/${templateId}/lines/${lineId}`
  - Map response to extract `data` field
  - Pattern: Follow existing `getById$()` method structure

### 2. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-models.ts`

- **Add metadata field** `canResetFromTemplate: boolean` to the `TableItemMetadata` interface
  - True when: `itemType === 'budget_line' && isPropagationLocked && templateLineId !== null`
  - This determines if the reset button should be shown

### 3. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-data-provider.ts`

- **Add field** `templateLineId` to metadata (needed to call API)
- **Add computed** `canResetFromTemplate` to metadata
  - True when: `isPropagationLocked && budgetLine?.templateLineId !== null`

### 4. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`

- **Add output** `resetFromTemplate = output<{ budgetLineId: string; templateLineId: string; templateId: string }>()`

- **Replace lock icon** (lines 138-148) with an icon button:
  - Change from `<mat-icon>` to `<button matIconButton>`
  - Keep same icon and tooltip
  - Add `(click)` handler that opens confirmation dialog
  - Emit `resetFromTemplate` event with required IDs if confirmed

- **Add method** `onResetFromTemplateClick(line: BudgetLineTableItem)`:
  - Open ConfirmationDialog with:
    - title: "Réinitialiser depuis le modèle"
    - message: "Cette action va remplacer les valeurs actuelles par celles du modèle. Cette action est irréversible."
    - confirmText: "Réinitialiser"
    - confirmColor: "primary"
  - On confirmation, emit `resetFromTemplate` output with IDs

- **Note**: Template ID must be available - check if it's in BudgetLine type or needs to be fetched via template line

### 5. `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`

- **Add method** `async resetBudgetLineFromTemplate(budgetLineId: string, templateLineId: string): Promise<void>`:
  - Inject `TemplateApi` (needs to be added to constructor)
  - Fetch template line data: `templateApi.getTemplateLine$(templateId, templateLineId)`
  - If fetch fails (404 = template deleted), throw specific error
  - Prepare update: `{ name, amount, kind, recurrence, isManuallyAdjusted: false }`
  - Call existing `updateBudgetLine()` with the update data
  - Handle errors appropriately

- **Challenge**: We need `templateId` to call `getTemplateLine$()` but budget line only has `templateLineId`
  - **Solution 1**: Add new backend endpoint `GET /budget-lines/:id/reset-from-template` (cleaner but more work)
  - **Solution 2**: Store templateId in budget line metadata from budget response
  - **Solution 3**: Have backend return templateId with template_line_id in budget line response
  - **Recommended**: Add a simpler endpoint in budget-line module that handles the reset logic server-side

### 6. `backend-nest/src/modules/budget-line/budget-line.controller.ts`

- **Add endpoint** `POST /budget-lines/:id/reset-from-template`:
  - Fetch budget line by ID
  - Validate it has `template_line_id` set
  - Fetch template line by `template_line_id`
  - If template line not found, return 404 with clear message
  - Update budget line with template values + `is_manually_adjusted = false`
  - Return updated budget line

### 7. `backend-nest/src/modules/budget-line/budget-line.service.ts`

- **Add method** `async resetFromTemplate(budgetLineId: string, user: AuthenticatedUser, supabase: SupabaseClient)`:
  - Fetch budget line
  - Validate `template_line_id` is not null (throw BadRequest if null)
  - Fetch template line from `template_line` table
  - If template line not found, throw NotFoundException with message: "Le modèle a été supprimé"
  - Update budget line: `{ name, amount, kind, recurrence, is_manually_adjusted: false }`
  - Return updated budget line

### 8. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line-api/budget-line-api.ts`

- **Add method** `resetFromTemplate$(budgetLineId: string): Observable<BudgetLineResponse>`:
  - Call `POST ${apiUrl}/${budgetLineId}/reset-from-template`
  - Return response

### 9. `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts`

- **Add handler** `async handleResetFromTemplate(event: { budgetLineId: string }): Promise<void>`:
  - Call store method `resetBudgetLineFromTemplate()`
  - On success: show snackbar "Prévision réinitialisée depuis le modèle"
  - On error (template deleted): show error snackbar "Impossible de réinitialiser : le modèle a été supprimé"

- **Bind to template**: Add `(resetFromTemplate)="handleResetFromTemplate($event)"` on `<pulpe-budget-table>`

## Testing Strategy

### Unit Tests

**`budget-table.spec.ts`:**
- Reset button visible only when `canResetFromTemplate = true`
- Reset button hidden for non-detached lines
- Click opens confirmation dialog
- Emits event on confirmation

**`budget-details-store.spec.ts`:**
- `resetBudgetLineFromTemplate()` calls API correctly
- Optimistic update sets `isManuallyAdjusted = false`
- Error handling for template not found

**`budget-line.service.spec.ts` (backend):**
- `resetFromTemplate()` fetches template line correctly
- Updates budget line with template values
- Throws 404 when template line deleted
- Throws 400 when `template_line_id` is null

### E2E Tests

**`frontend/e2e/tests/features/budget-line-reset.spec.ts`** (new):
- Reset button appears for detached lines with valid template
- Reset button NOT shown for lines without template
- Clicking reset opens confirmation dialog
- Confirming reset updates values and removes lock icon
- Canceling reset keeps original values
- Error snackbar when template deleted

## Rollout Considerations

- **No migration needed**: Uses existing database schema
- **No breaking changes**: Adds new functionality without modifying existing behavior
- **Feature flag**: Not needed - purely additive feature
- **Error handling**: Gracefully handles deleted templates with user-friendly message

## Summary of Changes

| File | Type | Change |
|------|------|--------|
| `template-api.ts` | Frontend API | Add `getTemplateLine$()` |
| `budget-table-models.ts` | Frontend Model | Add `canResetFromTemplate` metadata |
| `budget-table-data-provider.ts` | Frontend Service | Compute reset eligibility |
| `budget-table.ts` | Frontend Component | Lock icon → button + dialog |
| `budget-details-store.ts` | Frontend Store | Add `resetBudgetLineFromTemplate()` |
| `budget-line-api.ts` | Frontend API | Add `resetFromTemplate$()` |
| `budget-details-page.ts` | Frontend Page | Handle reset event |
| `budget-line.controller.ts` | Backend Controller | Add reset endpoint |
| `budget-line.service.ts` | Backend Service | Add reset logic |
