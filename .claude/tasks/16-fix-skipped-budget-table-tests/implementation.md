# Implementation: Fix Skipped Budget Table Tests

## Completed

Implemented **Option A: Remove Skipped Tests** as selected by user.

### Changes Made

1. **Removed `MockBudgetTableMobileCard` mock component** (was lines 59-112)
   - 54-line component definition removed
   - Was only used by skipped tests

2. **Removed `MockBudgetTableMobileCard` from TestBed imports**
   - Removed from `TestBed.overrideComponent()` imports array

3. **Removed `describe.skip('Mobile View')` block** (was lines 298-470)
   - 7 skipped tests removed
   - All functionality covered by E2E tests in `budget-table-mobile-menu.spec.ts`

4. **Removed `describe.skip('Responsive Behavior')` block** (was lines 472-531)
   - 2 skipped tests removed
   - Functionality covered by E2E responsive viewport tests

5. **Cleaned up unused imports**
   - Removed: `input`, `output` from `@angular/core`
   - Removed: `BudgetLine` from `@pulpe/shared`
   - Removed: `BudgetLineTableItem` from `./budget-table-models`
   - Removed: `EditBudgetLineDialog` from `../edit-budget-line/edit-budget-line-dialog`

## Deviations from Plan

None - implemented exactly as planned.

## Test Results

- **Typecheck**: ✓ (passes via lint)
- **Lint**: ✓ All files pass linting
- **Tests**: ✓ 658 tests passed, 0 skipped
  - `budget-table.spec.ts`: 14 tests (was 23 with 9 skipped)

## File Changed

- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.spec.ts`

## E2E Coverage Verification

The removed unit tests are fully covered by E2E tests:

| Removed Test | E2E Coverage |
|--------------|--------------|
| Mobile menu button | `budget-table-mobile-menu.spec.ts:51-55` |
| Menu items edit/delete | `budget-table-mobile-menu.spec.ts:57-64` |
| French menu text | `budget-table-mobile-menu.spec.ts:81-92` |
| Edit action → dialog | `budget-table-mobile-menu.spec.ts:94-109` |
| Delete action | `budget-table-mobile-menu.spec.ts:111-129` |
| Responsive switching | `budget-table-mobile-menu.spec.ts:193-210` |

## Follow-up: Rollover E2E Test Added

Added E2E test to cover the rollover business case that was partially missing:

**File:** `e2e/tests/features/budget-table-mobile-menu.spec.ts`

**Test:** `should not show menu button for rollover budget lines`

This test verifies:
- Regular budget lines have a menu button (`card-menu-*`)
- Rollover lines (`isRollover: true`) do NOT have a menu button
- Uses mock data with both a regular line and a rollover line

## Follow-up Tasks

None required.
