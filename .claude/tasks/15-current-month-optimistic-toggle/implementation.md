# Implementation: Current Month - Optimistic Toggle + Slide Toggle UI

## Completed

### 1. Optimistic Update for toggleCheck
- Modified `current-month-store.ts:toggleCheck()` to use optimistic update pattern
- Updates `checkedAt` locally immediately before API call
- Saves original state for rollback on error
- `realizedBalance` automatically recalculates via computed signal dependency

### 2. UI Component: mat-checkbox → mat-slide-toggle
- Replaced `MatCheckboxModule` with `MatSlideToggleModule` in `financial-entry.ts`
- Updated template from `<mat-checkbox>` to `<mat-slide-toggle>`
- All bindings preserved: `[checked]`, `(change)`, `(click)`, `[attr.data-testid]`

### 3. Layout Fix
- Changed from `matListItemIcon` to `matListItemAvatar` with proper container
- Added `.toggle-container` class for flex centering
- Fixed text truncation issue where names were cut off

## Files Changed

| File | Change |
|------|--------|
| `frontend/.../current-month-store.ts` | Rewrote `toggleCheck()` with optimistic update |
| `frontend/.../financial-entry.ts` | Replaced checkbox with slide-toggle, fixed layout |
| `frontend/.../current-month-store.spec.ts` | Added 4 tests for toggle behavior |

## Deviations from Plan

- Added layout fix after initial implementation (toggle was overlapping text)

## Test Results

- Typecheck: ✓
- Lint: ✓
- Format: ✓
- Unit Tests: ✓ (19 tests in current-month-store.spec.ts)
  - `should update checkedAt locally before API completes (optimistic update)`
  - `should toggle checkedAt from non-null to null`
  - `should rollback on API error`
  - `should update realizedBalance when toggling income line`

## Manual Verification

Tested in browser at localhost:4200:
1. Slide-toggle displays correctly in "Récurrentes" section
2. Toggle ON: UI updates instantly (no reload), realizedBalance updates
3. Toggle OFF: UI reverts instantly, realizedBalance recalculates
4. No full page reload on toggle action
5. Layout is properly aligned with no text truncation

## Known Issues

### 401 Error on toggle-check API (Demo Mode)
- **Symptom**: POST /budget-lines/{id}/toggle-check returns 401 Unauthorized
- **Other APIs work**: GET /budgets, GET /budgets/{id}/details return 200
- **Frontend behavior**: Rollback works correctly (UI reverts to original state)
- **Root cause**: Unknown - likely backend auth issue specific to demo mode
- **Impact**: Toggle doesn't persist to database, but UI handles it gracefully
- **Recommendation**: Investigate backend AuthGuard for POST requests in demo mode

## Follow-up Tasks

- [ ] Investigate 401 error on toggle-check endpoint in demo mode (backend issue)
