# Task: Reset Detached Budget Line from Template

**Issue**: [#117](https://github.com/neogenz/pulpe/issues/117)

## Summary

When a budget line linked to a template is edited, it becomes "detached" (marked as `is_manually_adjusted = true`). This feature allows users to reset the line to its original template values and re-establish the association.

---

## Codebase Context

### Detachment Mechanism

The system uses a two-field approach:

1. **`template_line_id`** (FK, nullable) - Links budget line to its template origin
2. **`is_manually_adjusted`** (boolean) - Controls propagation protection

**Key insight**: Detachment is tracked via the `is_manually_adjusted` flag, NOT by removing the FK. The `template_line_id` remains intact, making reset possible.

### Where Detachment Happens

```typescript
// frontend/projects/webapp/src/app/feature/budget/budget-details/edit-budget-line/edit-budget-line-dialog.ts:191-204
handleSubmit() {
  const update: BudgetLineUpdate = {
    name: this.budgetLineForm.value.name ?? this.budgetLine.name,
    amount: this.budgetLineForm.value.amount ?? this.budgetLine.amount,
    kind: this.budgetLineForm.value.kind ?? this.budgetLine.kind,
    recurrence: this.budgetLineForm.value.recurrence ?? this.budgetLine.recurrence,
    templateLineId: this.budgetLine.templateLineId,  // Preserved!
    isManuallyAdjusted: true,  // ← ALWAYS set to true on edit
  };
  this.dialogRef.close(update);
}
```

### Template Propagation Protection

SQL functions explicitly skip manually adjusted lines:

```sql
-- backend-nest/supabase/migrations/20250928090000_apply_template_line_operations.sql:40-54
WHERE bl.is_manually_adjusted = false  -- Key protection
```

---

## Key Files

### Database Layer

| File | Line | Purpose |
|------|------|---------|
| `backend-nest/src/types/database.types.ts` | 48 | `template_line_id: string \| null` FK definition |
| `backend-nest/src/types/database.types.ts` | 43 | `is_manually_adjusted: boolean` flag |
| `shared/schemas.ts` | 177 | `templateLineId` in Zod schema |
| `shared/schemas.ts` | 184 | `isManuallyAdjusted` in Zod schema |

### Frontend - UI Components

| File | Line | Purpose |
|------|------|---------|
| `frontend/.../edit-budget-line/edit-budget-line-dialog.ts` | 202 | Where detachment happens |
| `frontend/.../budget-table/budget-table.ts` | 138-148 | Lock icon for detached lines |
| `frontend/.../store/budget-details-store.ts` | 155-190 | `updateBudgetLine()` method |

### Frontend - API

| File | Line | Purpose |
|------|------|---------|
| `frontend/.../budget-line-api/budget-line-api.ts` | 48-62 | `updateBudgetLine$()` PATCH endpoint |
| `frontend/projects/webapp/src/app/core/template/template-api.ts` | 46-50 | `getTemplateLines$()` for fetching original values |

### Backend

| File | Line | Purpose |
|------|------|---------|
| `backend-nest/src/modules/budget-line/budget-line.service.ts` | 341-382 | `update()` method |
| `backend-nest/src/modules/budget-line/budget-line.service.ts` | 283-308 | `prepareBudgetLineUpdateData()` |

### Business Rules

| File | Line | Purpose |
|------|------|---------|
| `memory-bank/SPECS.md` | 74-77 | RG-001: Template propagation rules |

---

## Patterns to Follow

### 1. Optimistic Updates with `resource()`

```typescript
// budget-details-store.ts pattern
updateBudgetLine(id, update) {
  // 1. Optimistic update
  this._budgetLines.update(lines =>
    lines.map(l => l.id === id ? { ...l, ...update } : l)
  );
  // 2. Persist to server
  // 3. Handle errors by reloading
}
```

### 2. Lock Icon for Detached Items

```html
<!-- budget-table.ts:138-148 -->
@if (budgetLine.isPropagationLocked) {
  <mat-icon matTooltip="Montants verrouillés = non affectés par la propagation">
    lock
  </mat-icon>
}
```

### 3. Dialog Confirmation Pattern

Existing dialogs use `MatDialog.open()` with component injection and `afterClosed()` observable.

---

## Reset Implementation Strategy

### Required Steps

1. **Check eligibility**: `templateLineId !== null`
2. **Fetch template line**: Call backend to get original `template_line` values
3. **Update budget line**:
   ```typescript
   {
     name: templateLine.name,
     amount: templateLine.amount,
     kind: templateLine.kind,
     recurrence: templateLine.recurrence,
     isManuallyAdjusted: false  // ← Re-enable propagation
   }
   ```
4. **Refresh UI**: Optimistic update + server persist

### Backend Endpoint Needed

New endpoint to fetch single template line:
```
GET /api/template-lines/:id
```

Or add to existing budget line API:
```
POST /api/budget-lines/:id/reset-from-template
```

---

## Dependencies

- `template_line_id` must exist on the budget line (nullable FK)
- Template line must still exist (ON DELETE SET NULL could make it null)
- User should have budget edit permissions

---

## Open Questions for Planning Phase

1. **UI Placement**: Reset button in table row actions, edit dialog, or both?
2. **Confirmation**: Dialog confirmation vs instant with undo snackbar?
3. **Edge Case**: What if `template_line_id` is null (template was deleted)?
4. **Batch Reset**: Should "reset all detached lines" be a feature?
5. **Analytics**: Track reset action in PostHog?

---

## Test Coverage

Existing test to extend:
- `frontend/e2e/tests/features/budget-line-editing.spec.ts:52-69` - Tests detachment behavior

New tests needed:
- Reset button only visible for detached lines with valid template link
- Reset updates values to match template
- Reset sets `isManuallyAdjusted = false`
- Reset fails gracefully if template line was deleted
