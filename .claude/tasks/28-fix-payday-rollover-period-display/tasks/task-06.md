# Task: Update Budget Mapper to Calculate Period

## Problem

The budget list mapper creates `CalendarMonth` objects but doesn't calculate or include the budget period dates. The mapper needs to use the user's `payDayOfMonth` setting to compute and format the period string.

## Proposed Solution

Update the budget mapper to:

1. **Accept `payDayOfMonth` parameter** in mapping functions
2. **Import `formatBudgetPeriod`** from `pulpe-shared`
3. **Calculate period** for each budget and set on `CalendarMonth.period`
4. **Update `BudgetListPage`** to inject `UserSettingsApi` and pass `payDayOfMonth()` to mapper

Changes needed:
- `mapToCalendarMonth()`: Add `payDayOfMonth` param, call `formatBudgetPeriod()`
- `mapToCalendarYear()`: Pass through payDayOfMonth
- `BudgetListPage`: Get payDayOfMonth from UserSettingsApi, pass to mapper

## Dependencies

- Task 1: Shared Library Functions (`formatBudgetPeriod`)
- Task 5: CalendarMonth Interface (`period` field)

## Context

- Mapper file: `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-mapper/budget-list.mapper.ts`
- Page file: `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`
- UserSettingsApi: `frontend/projects/webapp/src/app/core/user-settings/user-settings-api.ts`
- Import pattern: `import { formatBudgetPeriod } from 'pulpe-shared';`

## Success Criteria

- Mapper functions accept and use `payDayOfMonth` parameter
- `CalendarMonth.period` is populated with formatted string (e.g., "27 fév - 26 mars")
- `BudgetListPage` injects `UserSettingsApi` and passes `payDayOfMonth()`
- Period is `undefined` for placeholder months (no budget)
- Build passes: `pnpm build`
