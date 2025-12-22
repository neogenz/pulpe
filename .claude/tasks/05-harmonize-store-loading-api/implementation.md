# Implementation: Harmonize Store Loading/Error API

## Completed

All stores now expose a standardized API aligned with Angular's native `resource()` API:

| Signal | Type | Description |
|--------|------|-------------|
| `isLoading` | `Signal<boolean>` | true during async operations |
| `hasValue` | `Signal<boolean>` | TYPE GUARD - true when data is available |
| `error` | `Signal<Error \| null>` | error or null |

### Stores Updated

1. **TemplateDetailsStore** (`template-details-store.ts:42-47`)
   - Added `hasValue` computed signal

2. **BudgetDetailsStore** (`budget-details-store.ts:63-64`)
   - Renamed `hasError` → `hasValue` with inverted logic
   - Updated `budget-details-page.ts:63` to use `store.error()` instead of `store.hasError()`

3. **BudgetListStore** (`budget-list-store.ts:30-32`)
   - Added `isLoading`, `hasValue`, `error` computed signals
   - Updated `refreshData()` to use `this.isLoading()` instead of `this.budgets.status()`

4. **CurrentMonthStore** (`current-month-store.ts:109-111`)
   - Replaced `dashboardStatus` with `isLoading`, `hasValue`, `error`
   - Updated `refreshData()` to use `this.isLoading()`
   - Updated `current-month.ts` template to use new signals with `@if/@else if` pattern

5. **TemplateLineStore** (`template-line-store.ts:28-34`)
   - Refactored mutable public signals to private with computed public accessors
   - Added `hasValue` computed signal
   - Fixed anti-pattern where signals could be mutated externally

6. **OnboardingStore** (`onboarding-store.ts:77-79`)
   - Renamed `isSubmitting` → `isLoading` throughout (state, store, components)
   - Added `hasValue` computed signal
   - Updated `onboarding-state.ts`, `onboarding-step.ts` model

7. **TemplateStore** (`template-store.ts:55-57`)
   - Renamed `isLoadingTemplates` → `isLoading` throughout (state interface, state signal, computed)
   - Added `hasValue` computed signal

8. **AuthApi** (`auth-api.ts:43`)
   - Added `hasValue` computed signal (already had `isLoading`)

### Components Updated

- `budget-details-page.ts:63` - `hasError()` → `error()`
- `current-month.ts:95-122` - Replaced `dashboardStatus()` pattern with `isLoading()`, `error()`, `hasValue()`
- `registration.ts` - All `store.isSubmitting()` → `store.isLoading()`
- `budget-creation-dialog.ts:164` - `isLoadingTemplates()` → `isLoading()`

### Tests Updated

- `current-month-store.spec.ts:393` - `dashboardStatus()` → `isLoading()`
- `budget-creation-dialog.spec.ts:155,164` - `isLoadingTemplates` → `isLoading`
- `onboarding-store-unit.spec.ts:107` - `isSubmitting()` → `isLoading()`
- `onboarding-store-integration.spec.ts:271,276` - `isSubmitting()` → `isLoading()`
- `template-line-store.spec.ts:127-131,475-477` - Removed tests that relied on external signal mutation (anti-pattern)

## Deviations from Plan

None. All changes followed the plan exactly.

## Test Results

- **Typecheck**: ✓
- **Lint**: ✓ (no new warnings)
- **Format**: ✓
- **Tests**: ✓ (628 tests passing)

## Follow-up Tasks

None identified. The API is now consistent across all stores.

## Template Pattern for Components

Components should now use the idiomatic Angular pattern:

```typescript
@if (store.isLoading()) {
  <loading-spinner />
} @else if (store.error()) {
  <error-display [error]="store.error()" />
} @else if (store.hasValue()) {
  <!-- Main content -->
}
```
