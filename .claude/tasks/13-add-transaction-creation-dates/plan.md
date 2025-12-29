# Implementation Plan: Add Transaction Creation Dates

## Overview

Add the creation date (Swiss format: dd.MM.yyyy) below each transaction name in the `FinancialEntry` component. The date will use the established typography pattern (`text-body-small text-on-surface-variant`).

## Dependencies

- None - `createdAt` field already exists in `FinancialEntryModel`

## File Changes

### `frontend/projects/webapp/src/app/feature/current-month/components/financial-entry.ts`

**Imports (line 1)**
- Add `DatePipe` to the import from `@angular/common` alongside `DecimalPipe`

**Component imports array (line 32-43)**
- Add `DatePipe` to the component's `imports` array

**Template (after line 82, after closing `</div>` of `matListItemTitle`)**
- Add a `<span>` element displaying the creation date
- Use classes: `text-body-small text-on-surface-variant`
- Use DatePipe with format `'dd.MM.yyyy'` and locale `'fr-CH'`
- Pattern: `{{ data().createdAt | date: 'dd.MM.yyyy' : '' : 'fr-CH' }}`

## Testing Strategy

### Update existing test: `frontend/projects/webapp/src/app/feature/current-month/components/financial-entry.spec.ts`
- Ensure test fixture includes a valid `createdAt` ISO date string
- Add test case: verify creation date is displayed in Swiss format (dd.MM.yyyy)
- Verify date appears after transaction name

### Manual verification
- Check date displays correctly on income, expense, and saving transactions
- Verify rollover items also show the date
- Confirm typography matches design system (small, muted text)

## Rollout Considerations

- No breaking changes
- No migration needed
- Feature is purely additive (display only)
