# Task: Display Period in Month Tile Component

## Problem

The `MonthTile` component displays the month name and balance but doesn't show the budget period dates. Users with custom payDay settings need to see when their budget period actually starts and ends.

## Proposed Solution

Update `MonthTile` to display the period string below the month name:

1. **Add computed signal** to extract period from `month().period`
2. **Add HTML element** to display period in smaller, muted text
3. **Conditional rendering**: Only show if `period` is defined
4. **Style consistently** with existing secondary information

Target UI mockup:
```
┌─────────────────────────────────┐
│  Février                        │
│  📅 27 jan - 26 fév             │  ← NEW: Period display
│                                 │
│  Disponible CHF                 │
│  +150.00                        │
└─────────────────────────────────┘
```

## Dependencies

- Task 6: Budget Mapper (must populate `period` field)

## Context

- Component file: `frontend/projects/webapp/src/app/ui/calendar/month-tile.ts`
- Month name extraction: Lines 114-118 (`monthName` computed)
- Display location: Line 37 (template area)
- Style pattern: `text-label-small`, `text-on-surface` classes
- Similar pattern: "Disponible CHF" label styling

## Success Criteria

- Period displayed below month name when available
- Period hidden for empty/placeholder months
- Styling: smaller font, muted color, appropriate spacing
- Responsive: Works on mobile and desktop
- No visual regression for months without custom payDay
