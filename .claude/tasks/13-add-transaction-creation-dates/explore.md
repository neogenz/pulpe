# Task: Add Creation Dates to Transactions

Display the creation date (in small text) below the transaction name on each financial entry in the current-month page.

## Codebase Context

### Target Component
- `frontend/projects/webapp/src/app/feature/current-month/components/financial-entry.ts:66-82` - Main template section showing transaction name with `matListItemTitle`

### Data Model
- `frontend/projects/webapp/src/app/feature/current-month/models/financial-entry.model.ts:11` - `createdAt: z.string().datetime()` field already exists in the model

### ViewModel
- `frontend/projects/webapp/src/app/feature/current-month/components/financial-entry.ts:24-27` - `FinancialEntryViewModel` extends `FinancialEntryModel`, so `createdAt` is already available in the component

## Typography Patterns

### Design System Location
- `frontend/projects/webapp/src/app/styles/vendors/_tailwind.css:124-130` - `text-body-small` utility (smaller secondary text)
- `frontend/projects/webapp/src/app/styles/vendors/_tailwind.css:203` - `text-on-surface-variant` color for muted text

### Secondary Text Pattern (established convention)
```html
<p class="text-body-small text-on-surface-variant mt-1">
  Secondary text here
</p>
```

**Examples in codebase:**
- `frontend/projects/webapp/src/app/feature/budget/budget-list/create-budget/ui/template-list-item.ts:67` - Description under template name
- `frontend/projects/webapp/src/app/feature/budget/budget-list/create-budget/ui/template-list-item.ts:98` - Loading state secondary text

## Date Formatting Patterns

### DatePipe Usage (preferred for templates)
- `frontend/projects/webapp/src/app/feature/current-month/current-month.ts:188` - `{{ date | date: 'MMMM yyyy' }}`
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-details-page.ts:164` - `{{ budget.createdAt | date: 'short' : '' : 'fr-CH' }}`

### Recommended Format for Short Dates
Use `'short'` format with French-Swiss locale: `{{ createdAt | date: 'short' : '' : 'fr-CH' }}`
- Produces: `24/12/2025 14:30` (compact, localized format)

### Alternative: Custom Format
`{{ createdAt | date: 'd MMM yyyy' : '' : 'fr-CH' }}` → `24 déc. 2025`

## Key Files to Modify

| File | Change |
|------|--------|
| `financial-entry.ts:66-82` | Add date display below transaction name |

## Implementation Pattern

### Current Template Structure (lines 66-82)
```html
<div matListItemTitle [class.rollover-text]="isRollover()">
  @if (isRollover() && rolloverSourceBudgetId()) {
    <a ...>{{ data().name | rolloverFormat }}</a>
  } @else {
    <span class="ph-no-capture">{{ data().name }}</span>
  }
</div>
```

### Required Change
Add a secondary line after the title div showing the creation date:
```html
<div matListItemTitle ...>...</div>
<span class="text-body-small text-on-surface-variant">
  {{ data().createdAt | date: 'short' : '' : 'fr-CH' }}
</span>
```

## Dependencies

### Already Imported
- `DatePipe` is already imported in the component (line 1: `import { DecimalPipe } from '@angular/common';`)
- **Note**: Need to add `DatePipe` to imports array (currently only `DecimalPipe` is imported)

### Imports to Add
```typescript
import { DatePipe, DecimalPipe } from '@angular/common';
```
And add `DatePipe` to the component's `imports` array.

## Visual Considerations

### List Item Height
- Current: `list-item-one-line-container-height: 71px` (line 159 in styles)
- May need to increase to `list-item-two-line-container-height` if single line height is insufficient

### Rollover Styling
- For rollover items, apply `text-on-surface-variant` (already muted, no change needed)
- The date should appear regardless of rollover status

## Patterns to Follow

1. Use `text-body-small` for small secondary text
2. Use `text-on-surface-variant` for muted/secondary color
3. Use Angular's `DatePipe` with `'short'` format and `'fr-CH'` locale
4. Add `DatePipe` to component imports
5. No `mt-1` spacing needed here since we're within a list item structure
