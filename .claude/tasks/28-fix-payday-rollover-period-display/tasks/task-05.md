# Task: Add Period Field to CalendarMonth Interface

## Problem

The `CalendarMonth` interface used for budget display doesn't have a field to store the formatted budget period string. This field is needed to display "27 fév - 26 mars" below the month name in the UI.

## Proposed Solution

Add an optional `period` field to the `CalendarMonth` interface:

```typescript
interface CalendarMonth {
  // ... existing fields
  period?: string; // Formatted period string, e.g., "27 fév - 26 mars"
}
```

This is a minimal, non-breaking change that enables the mapper to populate period data.

## Dependencies

- Task 1: Shared Library Functions (must be ready for imports)

## Context

- File: `frontend/projects/webapp/src/app/ui/calendar/calendar-types.ts:6-27`
- Interface is used by: `MonthTile`, `BudgetListPage`, mapper functions
- Similar optional field: `value?: number`, `status?: string`

## Success Criteria

- `period?: string` field added to `CalendarMonth` interface
- No breaking changes to existing code
- TypeScript build passes: `pnpm build` or `cd frontend && pnpm type-check`
