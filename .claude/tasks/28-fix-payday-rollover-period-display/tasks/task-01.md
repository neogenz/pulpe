# Task: Add Period Calculation Functions to Shared Library

## Problem

The frontend needs to display budget period dates (e.g., "27 fév - 26 mars") based on the user's payDay setting. Currently, no shared function exists to calculate and format these period boundaries with the quinzaine logic.

The **quinzaine rule** states:
- `payDay <= 15` (1ère quinzaine): Budget period starts in the same month as the budget name
- `payDay > 15` (2ème quinzaine): Budget period starts in the **previous month**

Example: Budget "Mars 2026" with payDay=27 → Period: 27 fév - 26 mars

## Proposed Solution

Add two new functions to the shared library's `budget-period.ts` module:

1. **`getBudgetPeriodDates(month, year, payDayOfMonth)`**
   - Returns `{ startDate: Date, endDate: Date }`
   - Implements quinzaine logic for start date calculation
   - End date is always the day before the next period starts
   - Handles month-end edge cases (Feb 28/29, months with 30 days)
   - Handles year transitions (January → December of previous year)

2. **`formatBudgetPeriod(month, year, payDayOfMonth, locale?)`**
   - Returns formatted string like "27 fév - 26 mars"
   - Uses `date-fns` format with provided locale (default `frCH`)
   - If no custom payDay, returns standard month format or null

Export both functions from `shared/src/calculators/index.ts`.

## Dependencies

- None (this is a foundation task)

## Context

- Key file: `shared/src/calculators/budget-period.ts:56-84` (existing `getBudgetPeriodForDate`)
- Export pattern: `shared/src/calculators/index.ts` uses `.js` extensions for ESM
- Date formatting: Use `date-fns` with `frCH` locale (same as existing code)
- Similar pattern: `formatCalendarMonthDisplayName` in frontend mapper

## Success Criteria

- `getBudgetPeriodDates()` returns correct start/end dates for all payDay values (1-31)
- `formatBudgetPeriod()` returns properly formatted French date ranges
- Edge cases handled: February, year transitions, payDay > days in month
- Functions exported from `shared/index.ts`
- Build passes: `pnpm build:shared`
