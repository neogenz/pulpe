# Implementation Plan: Add Year Filter to Search Transactions Dialog

## Overview

Add a multi-select year filter to the `SearchTransactionsDialogComponent`. The filter will:
- Display years that have budgets
- Default to empty (showing all results)
- Support multiple year selection
- Filter results on the backend for performance

**Implementation order**: Backend → Frontend API → Frontend UI

---

## Dependencies

Execute in this order:
1. Backend changes (controller + service)
2. Frontend API (`TransactionApi`)
3. Frontend UI (`SearchTransactionsDialogComponent`)

---

## File Changes

### `backend-nest/src/modules/transaction/transaction.controller.ts`

- **Add `years` query parameter** to the `/search` endpoint:
  - Type: array of numbers (optional)
  - Swagger: Add `@ApiQuery` decorator for `years` with `isArray: true`, `required: false`, `type: Number`
  - Controller method: Add `@Query('years', new ParseArrayPipe({ items: Number, optional: true })) years?: number[]`
  - Pass `years` to `transactionService.search(query, supabase, years)`

- **Pattern to follow**: See existing `@Query` usage at line 128

### `backend-nest/src/modules/transaction/transaction.service.ts`

- **Modify `search()` method signature** (around line 771):
  - Add optional `years?: number[]` parameter

- **Add year filtering to transactions query** (around lines 782-815):
  - Before the `.or()` clause, add: if `years` has values, filter with `.in('budget.year', years)`
  - Apply to the transactions query that joins with budget table

- **Add year filtering to budget_lines query** (around lines 818-850):
  - Same pattern: if `years` has values, filter with `.in('budget.year', years)`
  - Apply to the budget_lines query that joins with budget table

- **Consider**: Filter should be applied BEFORE the text search, not after

### `frontend/projects/webapp/src/app/core/transaction/transaction-api.ts`

- **Modify `search$()` method** (lines 69-73):
  - Change signature: `search$(query: string, years?: number[]): Observable<TransactionSearchResponse>`
  - Build params object: start with `{ q: query }`
  - Add `years` to params only if array has values: `params['years'] = years.map(String)`
  - Pattern: HttpClient handles array params as `years=2024&years=2023`

### `frontend/projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.ts`

**Imports to add:**
- `MatSelectModule` from `@angular/material/select`
- `BudgetApi` from `@core/budget/budget-api`
- `rxResource` already imported

**Component class changes:**

- **Inject BudgetApi**: Add `readonly #budgetApi = inject(BudgetApi);`

- **Add available years resource**: Create `rxResource` to fetch budgets and extract years:
  ```
  readonly availableYearsResource = rxResource({
    stream: () => this.#budgetApi.getAllBudgets$().pipe(
      map to extract unique years, sort descending (most recent first)
    )
  });
  ```
  - Pattern: Follow `budget-list-store.ts:34-38` for year extraction logic
  - Sort: Descending order (2024, 2023, 2022...) for better UX

- **Add selected years signal**: `readonly selectedYears = signal<number[]>([]);`

- **Modify searchResource params** (lines 198-208):
  - Update params to include years: `{ query: this.#validQuery(), years: this.selectedYears() }`
  - Update stream to pass years: `this.#transactionApi.search$(query, years)`
  - Add condition: only include years if array is not empty

**Template changes:**

- **Add mat-select after search input** (after line 75, before results):
  - Wrap in mat-form-field with `appearance="outline"` and `subscriptSizing="dynamic"`
  - Add mat-label: "Filtrer par année"
  - Add mat-select with `multiple` attribute
  - Bind `[value]="selectedYears()"` and `(selectionChange)="selectedYears.set($event.value)"`
  - Add mat-option for each year using `@for (year of availableYearsResource.value(); track year)`
  - Show loading spinner if `availableYearsResource.isLoading()`

- **Layout consideration**: Place year filter next to search input in a flex row, or below it

- **Add imports array**: Add `MatSelectModule` to component imports

**Methods to add:**

- **clearFilters()**: Reset both search query and selected years

---

## Testing Strategy

### Backend Tests

**File**: `backend-nest/src/modules/transaction/transaction.service.spec.ts` (if exists, otherwise create)
- Test `search()` with no years filter (existing behavior)
- Test `search()` with single year filter
- Test `search()` with multiple years filter
- Test `search()` with empty years array (should not filter)

### Frontend Tests

**File**: `frontend/projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.spec.ts`
- Test component initialization with available years loading
- Test year selection updates searchResource params
- Test multi-year selection works correctly
- Test clearing years filter shows all results
- Test year filter combined with text search

### Manual Verification

1. Open search dialog from budget list
2. Verify years dropdown shows budgets years in descending order
3. Select one year → verify results are filtered
4. Select multiple years → verify results include all selected years
5. Clear filter → verify all results return
6. Combine text search with year filter → verify both filters apply

---

## Documentation

No documentation changes required. This is a UI enhancement within existing functionality.

---

## Rollout Considerations

- **No breaking changes**: Backend accepts years as optional parameter
- **No migrations needed**: No database changes
- **Backward compatible**: Existing search without years filter continues to work
- **Feature flag**: Not needed, simple enhancement
