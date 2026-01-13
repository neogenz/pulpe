# Implementation Plan: Fix Envelope Allocated Expense Budget Regression

## Overview

The `CurrentMonthStore` dashboard calculates `totalExpenses` and `remaining` without considering envelope allocation logic. Transactions allocated to envelopes are double-counted: once through the envelope amount AND again as transactions.

**The correct behavior** (already implemented in `BudgetFinancialOverview`):
- Allocated transactions within envelope limits have **zero additional impact**
- Only **overages** (consumed > envelope amount) should reduce the remaining budget
- Free transactions (no `budgetLineId`) impact the budget normally

**Solution**: Align `CurrentMonthStore.totalExpenses` with `BudgetFinancialOverview.totals()` logic by using effective envelope amounts (`Math.max(line.amount, consumption.consumed)`).

## Dependencies

1. `calculateAllConsumptions` utility is already exported from `@core/budget`
2. No new dependencies required - all building blocks exist

## File Changes

### `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

- **Action 1**: Add import for `calculateAllConsumptions` from `@core/budget`
  - Location: Line ~3-6 (import section)
  - Add to existing `@core/budget` import or create new import line

- **Action 2**: Rewrite `totalExpenses` computed signal (lines 171-175)
  - Replace `BudgetFormulas.calculateTotalExpenses(budgetLines, transactions)` with envelope-aware logic
  - Follow pattern from `BudgetFinancialOverview.totals()` at lines 138-166:
    1. Calculate consumption map using `calculateAllConsumptions(budgetLines, transactions)`
    2. For each `expense`/`saving` budget line: use `effectiveAmount = Math.max(line.amount, consumption?.consumed ?? 0)`
    3. Add sum of free transaction amounts (transactions where `!tx.budgetLineId` and `kind` is `expense` or `saving`)
  - Rationale: This ensures allocated transactions within envelope limits don't double-count, but overages are properly accounted for

- **Consider**: The `remaining` signal (lines 189-193) does NOT need changes - it correctly uses `totalAvailable - totalExpenses`. Once `totalExpenses` is envelope-aware, `remaining` will be correct.

- **Consider**: The optimistic update methods (lines 269-399) use `BudgetFormulas.calculateAllMetrics()` for local calculations before backend sync. These are acceptable because:
  1. The backend recalculates the correct value
  2. The optimistic value is temporary (synced immediately after)
  3. Changing them would require modifying the shared `BudgetFormulas` class

## Testing Strategy

### Existing Tests to Validate (should pass WITHOUT modification)

**File**: `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.spec.ts`

**Section**: `describe('CurrentMonthStore - Envelope Allocation Logic')` (lines 723-1007)

| Test Case | Expected `remaining()` | Currently Failing |
|-----------|------------------------|-------------------|
| Allocated within envelope (100/500) | 4500 | Yes |
| Multiple allocated within (400/500) | 4500 | Yes |
| Overage only (150/100) | 4850 | Yes |
| User scenario (188/100 = 88 overage) | 812 | Yes |
| Mixed free + allocated | 4450 | Yes |
| Multiple envelopes (one overage) | 4150 | Yes |
| Free income transaction | 4600 | No (already passes) |

### Validation Command

```bash
cd frontend && pnpm test -- projects/webapp/src/app/feature/current-month/services/current-month-store.spec.ts
```

**Before fix**: 6 envelope allocation tests fail
**After fix**: All tests pass (no test modifications needed)

## Documentation

No documentation updates required - this is a bug fix that restores expected behavior.

## Rollout Considerations

- **No breaking changes**: The fix aligns dashboard behavior with the existing budget details page
- **No migration needed**: This is a calculation fix, not a data model change
- **No feature flags**: The correct behavior should apply immediately

## Architecture Notes

### Why This Pattern

The fix follows the established `BudgetFinancialOverview` pattern (lines 134-169) because:
1. It's already proven correct in the budget details view
2. Uses existing `calculateAllConsumptions` utility
3. Minimal code change - only the `totalExpenses` computed signal

### Why NOT Modify `BudgetFormulas`

The shared `BudgetFormulas` class is intentionally envelope-agnostic because:
1. It's used by the backend which may have different calculation needs
2. Envelope allocation is a frontend concern (consumption tracking)
3. The current shared formulas are correct for their purpose (raw sums)
