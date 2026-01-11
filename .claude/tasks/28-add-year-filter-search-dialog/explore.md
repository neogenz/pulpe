# Task: Add Year Filter to Search Transactions Dialog

## Summary

Add a multi-select year filter to the `SearchTransactionsDialogComponent` to allow users to filter search results by years that have budgets. The filter should be empty by default (showing all years) and support multiple year selection.

---

## Codebase Context

### Current Search Implementation

**Frontend Dialog** (`frontend/projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.ts`)
- Uses `@angular/forms/signals` with `form()` API and `debounce()` for the search query
- Uses `rxResource` pattern for reactive API calls with loading states
- Uses `linkedSignal` to preserve previous results during loading
- Template shows results with year/month in period column (lines 88-96)

**Frontend API** (`frontend/projects/webapp/src/app/core/transaction/transaction-api.ts:69-73`)
```typescript
search$(query: string): Observable<TransactionSearchResponse> {
  return this.#http
    .get<unknown>(`${this.#config.apiUrl}/transactions/search`, {
      params: { q: query },
    })
    .pipe(map((response) => transactionSearchResponseSchema.parse(response)));
}
```
- **Currently only accepts a text query parameter**
- Needs modification to accept optional year filter(s)

**Backend Controller** (`backend-nest/src/modules/transaction/transaction.controller.ts:106-137`)
- GET `/transactions/search` endpoint
- Only defines `q` query parameter (required, min 2 chars)
- Needs optional `years` query parameter added

**Backend Service** (`backend-nest/src/modules/transaction/transaction.service.ts:771-929`)
- `search()` method searches transactions and budget_lines
- Joins with budget table to get `budget.year`, `budget.month`
- Sorts results by year/month descending
- Returns top 50 results
- **No year filtering currently implemented**

### Available Years Source

**Budget List Store** (`frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-store.ts:34-38`)
```typescript
readonly plannedYears = computed(() => {
  const budgets = this.budgets()?.data;
  if (!budgets) return [];
  return [...new Set(budgets.map((b) => b.year))].sort((a, b) => a - b);
});
```
- Pattern for extracting unique years from budgets, sorted ascending
- Can be reused or referenced in search dialog

**Budget API** (`frontend/projects/webapp/src/app/core/budget/budget-api.ts:83-92`)
- `getAllBudgets$()` returns all user budgets
- Each budget has `year`, `month`, `id`, `description` fields

### Existing Mat-Select Examples

**Add Budget Line Dialog** (`frontend/projects/webapp/src/app/feature/budget/budget-details/create-budget-line/add-budget-line-dialog.ts:70-92`)
- mat-select with single selection using formControlName
- mat-option with value attributes and icons

**Transaction Chip Filter** (`frontend/projects/webapp/src/app/feature/current-month/components/transaction-chip-filter.ts:1-76`)
- Multi-select filter using mat-chips with `[multiple]="true"`
- Uses `model()` API for two-way binding
- Immutable array updates pattern

---

## Documentation Insights

### Angular Material v20+ mat-select

**Multiple Selection:**
```html
<mat-form-field appearance="outline">
  <mat-label>Select Years</mat-label>
  <mat-select [value]="selectedYears()" (selectionChange)="selectedYears.set($event.value)" multiple>
    @for (year of availableYears(); track year) {
      <mat-option [value]="year">{{ year }}</mat-option>
    }
  </mat-select>
</mat-form-field>
```

**Key Points:**
- Add `multiple` attribute for multi-select
- Value becomes a sorted array (not single value)
- Use `[value]="signal()"` and `(selectionChange)="signal.set($event.value)"` with signals
- Import `MatSelectModule`

### Signals with mat-select

```typescript
selectedYears = signal<number[]>([]);

// Update via selectionChange event
onYearsChanged(years: number[]): void {
  this.selectedYears.set(years);
}
```

### rxResource with Multiple Filters

```typescript
filterParams = computed(() => ({
  query: this.searchQuery(),
  years: this.selectedYears(),
}));

searchResource = rxResource({
  params: this.filterParams,
  stream: ({ params }) => this.api.search$(params.query, params.years),
});
```

---

## Research Findings

### Best Practices for Year Filter Implementation

1. **Empty by default**: Filter should not pre-select any years (show all results)
2. **Reactive with computed**: Combine multiple filters in a `computed()` signal
3. **Debounce considerations**: Text query uses debounce, year filter can trigger immediately
4. **Loading state**: rxResource handles loading automatically
5. **Backend filtering**: More efficient to filter on backend than frontend

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/.../search-transactions-dialog.ts` | Main component to modify |
| `frontend/.../transaction-api.ts:69-73` | API service - add years param |
| `backend-nest/.../transaction.controller.ts:106-137` | Controller - add years query param |
| `backend-nest/.../transaction.service.ts:771-929` | Service - implement year filtering |
| `frontend/.../budget-list-store.ts:34-38` | Pattern for extracting years |
| `shared/schemas.ts:282-314` | Schemas (no changes needed) |

---

## Patterns to Follow

### Signal-based forms
```typescript
readonly #searchModel = signal({ query: '', years: [] as number[] });
readonly searchForm = form(this.#searchModel, (path) => {
  debounce(path.query, 300);
  // No debounce on years - immediate filter
});
```

### rxResource with params
```typescript
readonly searchResource = rxResource({
  params: () => ({
    query: this.#validQuery(),
    years: this.searchForm.years().value()
  }),
  stream: ({ params }) => this.#api.search$(params.query, params.years),
});
```

### HttpClient params with arrays
```typescript
search$(query: string, years?: number[]): Observable<TransactionSearchResponse> {
  let params: Record<string, string | string[]> = { q: query };
  if (years?.length) {
    params['years'] = years.map(String); // HttpClient handles arrays
  }
  return this.#http.get<unknown>(`${this.#config.apiUrl}/transactions/search`, { params });
}
```

---

## Dependencies

### Frontend
- `MatSelectModule` (already imported via MatFormFieldModule pattern)
- `BudgetApi` or `BudgetListStore` for available years

### Backend
- No new dependencies
- Modify existing Supabase query to filter by `budget.year`

---

## Implementation Approach

### Phase 1: Backend
1. Add optional `years` query parameter to controller (array of numbers)
2. Modify service to filter by years when provided:
   ```typescript
   if (years?.length) {
     query = query.in('budget.year', years);
   }
   ```

### Phase 2: Frontend API
1. Update `TransactionApi.search$()` to accept optional `years` parameter
2. Pass years as query params

### Phase 3: Frontend Dialog
1. Add signal for available years (fetch from BudgetApi)
2. Add mat-select with `multiple` for year filter
3. Update searchResource params to include years
4. No changes to result display (already shows year/month)

---

## Open Questions

1. **Loading available years**: Should we fetch budgets just to get years, or create a dedicated endpoint?
   - Recommendation: Use existing `BudgetApi.getAllBudgets$()` and extract years

2. **Years sort order**: Ascending (2020, 2021...) or descending (2024, 2023...)?
   - Current pattern: ascending in budget-list-store.ts
   - Recommendation: Descending (most recent first) for better UX

3. **Empty filter behavior**: When no years selected, search all years?
   - Recommendation: Yes, empty = all years (default behavior)

4. **Year format in API**: Pass as array `years[]=2024&years[]=2023` or comma-separated?
   - Recommendation: Array format (HttpClient handles this natively)
