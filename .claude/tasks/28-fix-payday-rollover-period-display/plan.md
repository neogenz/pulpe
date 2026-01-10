# Implementation Plan: Fix PayDay Rollover Calculation & Add Period Display

## Overview

This task corrects the budget period calculation logic to use the "quinzaine" (fortnight) rule and adds explicit period display in the UI.

**Key Business Rule (Quinzaine Logic):**
- `payDay <= 15` (1ère quinzaine): Budget "Mars" starts on payDay of MARCH → covers 5 mars - 4 avril
- `payDay > 15` (2ème quinzaine): Budget "Mars" starts on payDay of FEBRUARY → covers 27 fév - 26 mars

The budget name corresponds to the month containing the **majority** of days in the period.

## Dependencies

**Execution Order:**
1. `shared/` - Update period calculation logic (foundation)
2. `backend-nest/supabase/migrations/` - Fix SQL function
3. `backend-nest/` - Update tests
4. `frontend/` - Add period display

**External Dependencies:**
- `UserSettingsApi.payDayOfMonth()` - Already available in frontend

---

## File Changes

### Phase 1: Shared Library (Foundation)

#### `shared/src/calculators/budget-period.ts`

- **Modify `getBudgetPeriodForDate()` function (lines 56-84):**
  - Add quinzaine logic: if `payDay > 15`, invert the month assignment
  - When `payDay > 15` and `dayOfMonth >= payDay` → return NEXT month
  - When `payDay > 15` and `dayOfMonth < payDay` → return CURRENT month
  - Keep existing logic for `payDay <= 15`
  - Update JSDoc examples to reflect new behavior

- **Add new function `getBudgetPeriodDates()`:**
  - Parameters: `month: number, year: number, payDayOfMonth: number | null`
  - Returns: `{ startDate: Date, endDate: Date }`
  - Calculate period start date using quinzaine logic
  - Calculate period end date as day before next period start
  - Handle month-end edge cases (Feb 28/29, months with 30 days)
  - Export from `index.ts`

- **Add new function `formatBudgetPeriod()`:**
  - Parameters: `month: number, year: number, payDayOfMonth: number | null, locale?: Locale`
  - Returns: `string` formatted as "27 jan - 26 fév"
  - Use `date-fns` format with provided locale (default `frCH`)
  - Export from `index.ts`

#### `shared/src/calculators/budget-period.spec.ts`

- **Update existing tests for `getBudgetPeriodForDate()`:**
  - Add tests for quinzaine logic with `payDay > 15`
  - Test boundary cases: payDay=15, payDay=16
  - Test year transitions (December → January)

- **Add tests for `getBudgetPeriodDates()`:**
  - Test payDay=1 (calendar month)
  - Test payDay=5 (1ère quinzaine)
  - Test payDay=15 (boundary)
  - Test payDay=20 (2ème quinzaine)
  - Test payDay=27 (2ème quinzaine)
  - Test payDay=30 with February (month-end edge case)
  - Test year transitions

- **Add tests for `formatBudgetPeriod()`:**
  - Test French locale formatting
  - Test various payDay values

#### `shared/src/calculators/index.ts`

- Export new functions: `getBudgetPeriodDates`, `formatBudgetPeriod`

---

### Phase 2: Backend SQL Migration

#### `backend-nest/supabase/migrations/` (New migration file)

**Create new migration: `YYYYMMDDHHMMSS_fix_payday_quinzaine_logic.sql`**

- **Replace `budget_start_date` calculation in `get_budget_with_rollover` function:**
  - Add quinzaine logic using CASE statement
  - If `pay_day <= 15`: use current month (existing logic)
  - If `pay_day > 15`: use PREVIOUS month
  - Handle month-end edge cases with LEAST()
  - Handle year transitions (January → December of previous year)

- **Update CTE structure:**
  - Add helper CTE for calculating previous month/year
  - Ensure proper handling of February edge case

- **Keep existing logic unchanged:**
  - `normalized_pay_day` CTE
  - LAG() for previous_budget_id
  - SUM() window function for rollover

---

### Phase 3: Backend Tests

#### `backend-nest/src/modules/budget/__tests__/rollover-payday.spec.ts`

- **Update test descriptions to match new quinzaine logic**

- **Add new test cases:**
  - Test payDay=5 (1ère quinzaine) - verify no decalage
  - Test payDay=15 (boundary) - verify no decalage
  - Test payDay=16 (2ème quinzaine) - verify decalage
  - Test payDay=27 with year transition (January budget → December start)

- **Verify RPC call parameters match expected logic**

---

### Phase 4: Frontend Types

#### `frontend/projects/webapp/src/app/ui/calendar/calendar-types.ts`

- **Add `period` field to `CalendarMonth` interface (lines 6-27):**
  - Add `period?: string` - formatted period string like "27 jan - 26 fév"
  - Keep existing fields unchanged

---

### Phase 5: Frontend Budget List

#### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-mapper/budget-list.mapper.ts`

- **Modify function signature to accept `payDayOfMonth`:**
  - Update `mapToCalendarMonth()` to take `payDayOfMonth` parameter
  - Update `mapToCalendarMonths()` to pass payDayOfMonth

- **Calculate and format period:**
  - Import `formatBudgetPeriod` from `pulpe-shared`
  - Call `formatBudgetPeriod(month, year, payDayOfMonth)` for each budget
  - Set `period` field on `CalendarMonth` object

#### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`

- **Inject `UserSettingsApi` to access `payDayOfMonth`:**
  - Add private readonly field for UserSettingsApi
  - Pass `payDayOfMonth()` to mapper functions

- **Update `calendarYears` computed signal:**
  - Access `this.#userSettingsApi.payDayOfMonth()` as dependency
  - Pass to mapping functions

---

### Phase 6: Frontend UI Display

#### `frontend/projects/webapp/src/app/ui/calendar/month-tile.ts`

- **Add period display below month name (around line 37):**
  - Add computed signal `period` that extracts from `month().period`
  - Add HTML element to display period in smaller text
  - Style: smaller font, muted color, below month name
  - Only show if `period` is defined

#### `frontend/projects/webapp/src/app/feature/budget/ui/month-card-item.ts`

- **Add period input and display:**
  - Add `period = input<string>()` optional input
  - Display period below displayName if provided

#### `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts`

- **Inject `UserSettingsApi`:**
  - Add private readonly field

- **Add `period` computed signal (near lines 296-301):**
  - Import `formatBudgetPeriod` from `pulpe-shared`
  - Calculate period using budget month/year and payDayOfMonth
  - Return formatted string

- **Update header display (around line 116):**
  - Display period below or next to displayName
  - Style consistently with month-tile

---

## Testing Strategy

### Unit Tests to Update/Create

| File | Tests |
|------|-------|
| `shared/src/calculators/budget-period.spec.ts` | Quinzaine logic, period dates, formatting |
| `backend-nest/src/modules/budget/__tests__/rollover-payday.spec.ts` | SQL function with quinzaine logic |

### Manual Verification Steps

1. **Backend verification:**
   - Create budgets with different payDay values (1, 5, 15, 20, 27)
   - Verify rollover calculation is correct
   - Check previous_budget_id links correctly

2. **Frontend verification:**
   - Set payDayOfMonth to 27 in settings
   - Navigate to budget list
   - Verify period displays correctly (e.g., "27 jan - 26 fév" for February)
   - Check budget details page shows period
   - Test with payDayOfMonth = 1, 5, 15, 20

---

## Test Scenarios Reference

| PayDay | Budget "Mars 2026" | Period Start | Period End | Period Display |
|--------|-------------------|--------------|------------|----------------|
| 1 | 1 mars 2026 | 1 mars | 31 mars | "1 mars - 31 mars" |
| 5 | 5 mars 2026 | 5 mars | 4 avril | "5 mars - 4 avr" |
| 15 | 15 mars 2026 | 15 mars | 14 avril | "15 mars - 14 avr" |
| 20 | 20 fév 2026 | 20 fév | 19 mars | "20 fév - 19 mars" |
| 27 | 27 fév 2026 | 27 fév | 26 mars | "27 fév - 26 mars" |
| 30 | 28 fév 2026 | 28 fév | 29 mars | "28 fév - 29 mars" |

---

## Rollout Considerations

- **No breaking changes:** Period display is additive
- **SQL migration:** Run before deploying new frontend
- **No feature flags needed:** Changes are backward compatible
- **Cache invalidation:** Not required (data model unchanged)

---

## Next Step

Run `/epct:code 28-fix-payday-rollover-period-display` to execute this plan.
