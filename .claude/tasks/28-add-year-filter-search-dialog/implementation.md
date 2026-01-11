# Implementation: Add Year Filter to Search Transactions Dialog

## Completed

### Backend Changes

1. **`backend-nest/src/modules/transaction/transaction.controller.ts`**
   - Added `@ApiQuery` decorator for `years` parameter (optional, array of numbers)
   - Added `years` query parameter to `search()` method
   - Added `#parseYearsParam()` private method to parse string/array to number array

2. **`backend-nest/src/modules/transaction/transaction.service.ts`**
   - Added optional `years?: number[]` parameter to `search()` method
   - Added year filtering to transactions query using `.in('budget.year', years)`
   - Added year filtering to budget_lines query using `.in('budget.year', years)`

### Frontend Changes

3. **`frontend/projects/webapp/src/app/core/transaction/transaction-api.ts`**
   - Updated `search$()` method signature to accept optional `years` parameter
   - Added conditional logic to include years in HTTP params when provided

4. **`frontend/projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.ts`**
   - Added `MatSelectModule` import
   - Added `BudgetApi` injection
   - Added `selectedYears` signal for tracking selected years
   - Added `availableYearsResource` using `rxResource` to fetch and extract unique years from budgets (sorted descending)
   - Updated `searchResource` params to include years filter
   - Added mat-select UI with multi-select for year filtering

## Deviations from Plan

None. All changes followed the plan exactly.

## Test Results

- TypeScript: ✓ (both frontend and backend)
- Lint: ✓
  - Backend: 2 pre-existing warnings (method line count limits)
  - Frontend: No issues
- Backend Tests: ✓ (21 tests passed)
- Frontend Tests: ✓ (705 tests passed)

## Follow-up Tasks

None identified. The feature is complete and ready for manual testing.

## Manual Testing Checklist

1. Open search dialog from budget list
2. Verify years dropdown shows budget years in descending order (most recent first)
3. Select one year → verify results are filtered to that year only
4. Select multiple years → verify results include all selected years
5. Clear year filter → verify all results return
6. Combine text search with year filter → verify both filters apply correctly

## Files Changed

| File | Lines Changed |
|------|--------------|
| `backend-nest/src/modules/transaction/transaction.controller.ts` | +23 |
| `backend-nest/src/modules/transaction/transaction.service.ts` | +12 |
| `frontend/projects/webapp/src/app/core/transaction/transaction-api.ts` | +6 |
| `frontend/projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.ts` | +42 |
