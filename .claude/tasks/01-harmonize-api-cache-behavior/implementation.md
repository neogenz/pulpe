# Implementation: Harmonize API Cache Behavior (Stale-While-Revalidate)

## Completed

### Services Made Global (`providedIn: 'root'`)
- `BudgetListStore` - `budget-list-store.ts:18`
- `CurrentMonthStore` - `current-month-store.ts:38`
- `BudgetTemplatesApi` - `budget-templates-api.ts:20`
- `BudgetTemplatesStore` - `budget-templates-store.ts:12`
- `TransactionFormService` - `transaction-form.ts:33`

### Route Providers Removed
- `budget.routes.ts` - Removed `BudgetListStore` from providers
- `current-month.routes.ts` - Removed `CurrentMonthStore` from providers
- `budget-templates.routes.ts` - Removed all 3 providers (`BudgetTemplatesApi`, `BudgetTemplatesStore`, `TransactionFormService`)

### Components Updated with Stale-While-Revalidate Pattern
- `CurrentMonth` - `current-month.ts`
  - Added `effect` import
  - Added `LoadingIndicator` import
  - Added `#loadingIndicator` field
  - Added `this.store.refreshData()` call in constructor
  - Added effect to show loading indicator when status === 'reloading'
  - Added `DestroyRef.onDestroy` cleanup

- `CurrentMonthStore` - `current-month-store.ts`
  - Added `status` computed signal to expose resource status (line 144)

- `TemplateListPage` - `template-list-page.ts`
  - Added `effect`, `DestroyRef` imports
  - Added `LoadingIndicator` import
  - Added `#destroyRef`, `#loadingIndicator` fields
  - Added `this.store.refreshData()` call in constructor
  - Added effect to show loading indicator when status === 'reloading'
  - Added `DestroyRef.onDestroy` cleanup

Note: `BudgetListPage` already had the stale-while-revalidate pattern implemented.

### Naming Consistency Refactoring

Renamed `BudgetTemplatesState` to `BudgetTemplatesStore` for consistency with other stores:

| Before | After |
|--------|-------|
| `BudgetListStore` | `BudgetListStore` |
| `CurrentMonthStore` | `CurrentMonthStore` |
| `BudgetTemplatesState` ❌ | `BudgetTemplatesStore` ✓ |

**Files updated:**
- `budget-templates-state.ts` → `budget-templates-store.ts` (renamed file + class)
- `template-list-page.ts` - Updated import, renamed `state` → `store`
- `create-template-page.ts` - Updated import, renamed `#state` → `#store`
- `budget-templates-store.spec.ts` - Updated import, renamed `state` → `store`

## Deviations from Plan

Additional refactoring was done to ensure naming consistency across all stores.

## Test Results

- **Typecheck**: ✓ Passed
- **Lint**: ✓ Passed (All files pass linting)
- **Unit Tests**: ✓ Passed (23 tests for BudgetTemplatesStore)

## Behavior Summary

All three main pages now implement the **stale-while-revalidate pattern**:

1. **Budget List (Mes budgets)**: Already had the pattern ✓
2. **Current Month (Mois en cours)**: Now has the pattern ✓
3. **Budget Templates (Modèles)**: Now has the pattern ✓

**Expected UX**:
- Navigate to a page → see cached data immediately (if already visited)
- Loading bar appears in the header during background refresh
- Data updates automatically when new data arrives from API
- No full-page loading spinner on revisit

## Files Changed

| File | Change |
|------|--------|
| `budget-list-store.ts` | `@Injectable()` → `@Injectable({ providedIn: 'root' })` |
| `budget.routes.ts` | Removed `providers: [BudgetListStore]` |
| `current-month-store.ts` | `@Injectable()` → `@Injectable({ providedIn: 'root' })`, added `status` computed |
| `current-month.routes.ts` | Removed `providers: [CurrentMonthStore]` |
| `current-month.ts` | Added refreshData(), LoadingIndicator effect, and cleanup |
| `budget-templates-api.ts` | `@Injectable()` → `@Injectable({ providedIn: 'root' })` |
| `budget-templates-state.ts` → `budget-templates-store.ts` | Renamed file + class to `BudgetTemplatesStore` |
| `transaction-form.ts` | `@Injectable()` → `@Injectable({ providedIn: 'root' })` |
| `budget-templates.routes.ts` | Removed all providers |
| `template-list-page.ts` | Added refreshData(), LoadingIndicator, renamed `state` → `store` |
| `create-template-page.ts` | Updated import, renamed `#state` → `#store` |
| `budget-templates-store.spec.ts` | Updated import/class refs, renamed `state` → `store` |

## Architecture Summary

All feature stores now follow a consistent pattern:

```
frontend/
├── feature/
│   ├── budget/
│   │   └── budget-list/
│   │       └── budget-list-store.ts     ← BudgetListStore (providedIn: 'root')
│   ├── current-month/
│   │   └── services/
│   │       └── current-month-store.ts   ← CurrentMonthStore (providedIn: 'root')
│   └── budget-templates/
│       └── services/
│           └── budget-templates-store.ts ← BudgetTemplatesStore (providedIn: 'root')
```

## Follow-up Tasks

None identified. The implementation is complete with consistent naming and all pages now have consistent cache behavior.
