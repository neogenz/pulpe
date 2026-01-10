# Task: Display Period in Budget Details Page

## Problem

The budget details page header shows the month name (e.g., "Février 2026") but doesn't display the actual budget period dates. Users need to see the period boundaries when viewing budget details.

## Proposed Solution

Update `BudgetDetailsPage` to show the period:

1. **Inject `UserSettingsApi`** to access `payDayOfMonth()`
2. **Add `period` computed signal** using `formatBudgetPeriod()` from shared
3. **Update header display** to show period below or next to `displayName`
4. **Style consistently** with month-tile period display

Target UI:
```
┌─────────────────────────────────┐
│ ← Février 2026                  │
│   📅 27 jan - 26 fév            │  ← NEW: Period display
└─────────────────────────────────┘
```

## Dependencies

- Task 1: Shared Library Functions (`formatBudgetPeriod`)

## Context

- Page file: `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts`
- displayName computed: Lines 296-301
- Header template: Around line 116
- Import: `import { formatBudgetPeriod } from 'pulpe-shared';`
- UserSettingsApi pattern: Same as other pages (inject, use signal)

## Success Criteria

- Period displayed in budget details header
- Period calculated using budget's month/year + user's payDayOfMonth
- Period hidden if no custom payDay (standard calendar month)
- Styling consistent with month-tile
- Breadcrumb unchanged (still shows month name only)
