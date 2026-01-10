# Task: Fix PayDay Rollover Calculation & Add Period Display

## Problem Summary

The current SQL function `get_budget_with_rollover` calculates `budget_start_date` incorrectly:
- **Current**: `make_date(year, month, payDay)` - always uses the budget's month
- **Expected**: Conditional logic based on payDay quinzaine (fortnight)

### Correct Business Rule

| PayDay | Décalage | Example (Budget "Mars 2026") |
|--------|----------|------------------------------|
| **1-15** (1ère quinzaine) | Aucun | Starts 5 mars → covers 5 mars - 4 avril |
| **16-31** (2ème quinzaine) | -1 mois | Starts 27 fév → covers 27 fév - 26 mars |

The budget name should correspond to the month containing the **majority** of days in the period.

### Additional Requirement

Display the period explicitly in the UI (Option C from discussion):
```
┌─────────────────────────────────┐
│  Février 2026                   │
│  📅 27 jan - 26 fév             │
│  Solde : +150€                  │
└─────────────────────────────────┘
```

---

## Codebase Context

### SQL Migration (Critical Bug Location)

**File:** `backend-nest/supabase/migrations/20260110150309_add_payday_to_rollover_function.sql`

**Lines 37-49 - Current (incorrect) calculation:**
```sql
make_date(
  mb.year,
  mb.month,
  LEAST(
    (SELECT pay_day FROM normalized_pay_day),
    EXTRACT(DAY FROM (
      date_trunc('month', make_date(mb.year, mb.month, 1))
      + INTERVAL '1 month'
      - INTERVAL '1 day'
    ))::INT
  )
) as budget_start_date
```

**Lines 19-22 - PayDay normalization (keep as is):**
```sql
normalized_pay_day AS (
  SELECT GREATEST(1, LEAST(31, COALESCE(p_pay_day_of_month, 1))) as pay_day
)
```

**Lines 59-62 - Previous budget selection (uses ORDER BY budget_start_date):**
```sql
LAG(bsd.id) OVER (
  PARTITION BY bsd.user_id
  ORDER BY bsd.budget_start_date
) as previous_budget_id
```

**Lines 65-70 - Rollover calculation (sums previous ending_balance):**
```sql
SUM(bsd.ending_balance) OVER (
  PARTITION BY bsd.user_id
  ORDER BY bsd.budget_start_date
  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
) as rollover
```

### Backend Service

**File:** `backend-nest/src/modules/budget/budget.service.ts`
- **Lines 51-62**: Retrieves `payDayOfMonth` from user metadata
- Passes `payDayOfMonth` to `BudgetCalculator.getRollover()`

**File:** `backend-nest/src/modules/budget/budget.calculator.ts`
- **Lines 72-103**: Calls `get_budget_with_rollover` RPC with `p_pay_day_of_month`

### Frontend Budget Display Components

**File:** `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-mapper/budget-list.mapper.ts`
- **Lines 21-23**: `formatCalendarMonthDisplayName(month, year)` - formats as "MMMM yyyy"
```typescript
function formatCalendarMonthDisplayName(month: number, year: number): string {
  return format(new Date(year, month - 1), 'MMMM yyyy', { locale: frCH });
}
```

**File:** `frontend/projects/webapp/src/app/ui/calendar/calendar-types.ts`
- **Lines 6-27**: `CalendarMonth` interface
```typescript
interface CalendarMonth {
  id: string;
  month: number;
  year: number;
  displayName: string;     // Currently "Janvier 2025"
  hasContent: boolean;
  value?: number;
  status?: 'positive' | 'negative' | 'neutral' | 'warning';
}
```

**File:** `frontend/projects/webapp/src/app/ui/calendar/month-tile.ts`
- **Line 108**: `month = input.required<CalendarMonth>()`
- **Lines 114-118**: Extracts month name from displayName
- **Line 37**: Displays `{{ monthName() }}`

**File:** `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts`
- **Lines 296-301**: `displayName` computed signal
```typescript
displayName = computed(() => {
  const budget = this.store.budgetDetails();
  if (!budget) return '';
  const date = new Date(budget.year, budget.month - 1, 1);
  return formatDate(date, 'MMMM yyyy', { locale: frCH });
});
```

### Date Formatting Patterns

**File:** `frontend/projects/webapp/src/app/core/locale.ts`
- **Lines 1-41**: Global locale configuration (`fr-CH`, `de-CH`)
- Uses `date-fns` with `frCH` locale

**Date Range Pattern (existing example):**
**File:** `frontend/projects/webapp/src/app/feature/current-month/components/edit-transaction-form.ts`
- **Lines 196-206**: Error message with date range
```typescript
// Pattern: "du {{ min }} au {{ max }}"
min: min.toLocaleDateString('fr-CH'),
max: max.toLocaleDateString('fr-CH'),
```

### Shared Types

**File:** `shared/schemas.ts`
- **Lines 63-85**: Budget schema
```typescript
export const budgetSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  // ... rollover, previousBudgetId, etc.
});
```

---

## Key Files to Modify

### Backend (SQL Fix)

| File | Lines | Change |
|------|-------|--------|
| `backend-nest/supabase/migrations/` | New migration | Fix `budget_start_date` calculation with quinzaine logic |

### Frontend (Period Display)

| File | Lines | Change |
|------|-------|--------|
| `shared/schemas.ts` | ~85 | Add `periodStart?` and `periodEnd?` fields to budget schema |
| `calendar-types.ts` | 6-27 | Add `period?: string` to CalendarMonth |
| `budget-list.mapper.ts` | 21-23 | Calculate and format period based on payDay |
| `month-tile.ts` | ~37 | Display period subtitle |
| `budget-details-page.ts` | 296-301 | Include period in header/display |

---

## Patterns to Follow

### SQL Date Calculation Pattern
```sql
-- Handle month-end edge cases (e.g., Feb 28/29)
LEAST(pay_day, EXTRACT(DAY FROM (last_day_of_month))::INT)
```

### Date Range Formatting Pattern
```typescript
// French format: "27 jan - 26 fév"
const periodStart = format(startDate, 'd MMM', { locale: frCH });
const periodEnd = format(endDate, 'd MMM', { locale: frCH });
return `${periodStart} - ${periodEnd}`;
```

### Quinzaine Logic
```typescript
function calculateBudgetPeriodStart(year: number, month: number, payDay: number): Date {
  if (payDay <= 15) {
    // 1ère quinzaine: same month
    return new Date(year, month - 1, payDay);
  } else {
    // 2ème quinzaine: previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return new Date(prevYear, prevMonth - 1, payDay);
  }
}
```

---

## Dependencies

1. **User Settings**: `payDayOfMonth` must be available to frontend for period calculation
   - Currently stored in user metadata
   - Need to pass to budget list/display components

2. **Backend API**: May need to return period dates or payDay in budget response

3. **Existing Tests**: `rollover-payday.spec.ts` needs update for new logic

---

## Test Scenarios to Cover

| PayDay | Budget "Mars 2026" | Period Start | Period End |
|--------|-------------------|--------------|------------|
| 1 | 1 mars 2026 | 1 mars | 31 mars |
| 5 | 5 mars 2026 | 5 mars | 4 avril |
| 15 | 15 mars 2026 | 15 mars | 14 avril |
| 20 | 20 fév 2026 | 20 fév | 19 mars |
| 27 | 27 fév 2026 | 27 fév | 26 mars |
| 30 | 28 fév 2026 (Feb) | 28 fév | 29 mars |

---

## Next Step

Run `/epct:plan 28-fix-payday-rollover-period-display` to create implementation plan.
