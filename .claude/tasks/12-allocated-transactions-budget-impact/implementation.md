# Implementation: Transactions Allouées - Impact sur le Budget Total

## Completed

### 1. Extended FinancialItem Interface (`shared/src/calculators/budget-formulas.ts:31-36`)
- Added `id?: string` for identifying budget lines
- Added `budgetLineId?: string | null` for identifying allocated transactions
- Both fields are optional for backward compatibility

### 2. Refactored calculateTotalExpenses (`shared/src/calculators/budget-formulas.ts:82-111`)
Implemented the corrected formula:
```
expenses_M = Σ(budget_lines) + Σ(free_transactions) + Σ(envelope_overruns)
```

- Separates transactions into free (no `budgetLineId`) and allocated (with `budgetLineId`)
- Free transactions are counted fully
- Allocated transactions only count their overrun beyond the envelope amount

### 3. Added calculateEnvelopeOverruns (`shared/src/calculators/budget-formulas.ts:123-158`)
- Groups allocated transactions by `budgetLineId`
- Calculates `MAX(0, allocated_total - envelope_amount)` for each envelope
- Falls back to treating transaction as free if envelope doesn't exist

### 4. Updated Backend Repository (`backend-nest/src/modules/budget/budget.repository.ts`)
- Extended `BudgetDataOptions` with `budgetLineFields` and `transactionFields` options
- Updated `buildFetchQueries` to use separate fields for each table
- Maintains backward compatibility with existing `selectFields` option

### 5. Updated Backend Calculator (`backend-nest/src/modules/budget/budget.calculator.ts:30-65`)
- Now fetches `id, kind, amount` for budget lines
- Now fetches `kind, amount, budget_line_id` for transactions
- Maps database fields (snake_case) to formula fields (camelCase)

### 6. Added Unit Tests

#### Shared Package (`shared/src/calculators/budget-formulas.spec.ts`)
9 new tests covering:
- Transaction within envelope limit (no impact)
- Transaction exceeding envelope (only overrun counted)
- Free transactions (fully counted)
- Mix of allocated and free transactions
- Backward compatibility
- Multiple envelopes with mixed overruns
- Transaction allocated to non-existent envelope
- Savings allocated to envelope
- Exactly matched allocation

#### Frontend (`frontend/projects/webapp/src/app/core/budget/budget-calculator.spec.ts`)
4 new tests covering:
- Allocated transaction within envelope
- Allocated transaction with overrun
- Free transactions
- Mix of allocated and free transactions

## Deviations from Plan

None - implementation followed the plan exactly.

## Test Results

- Typecheck: ✓
- Lint: ✓ (pre-existing warning in transaction.service.ts not related to changes)
- Shared tests: 35 passed (9 new)
- Frontend tests: 649 passed (4 new)

## Follow-up Tasks

None identified - the implementation is complete and all tests pass.

---

# Update 2: Frontend Display Fix

## Problem

Allocated transactions appeared twice in the UI:
1. Inside their envelope (correctly)
2. As standalone rows in the main table (incorrectly)

## Fix

Modified `BudgetTableDataProvider.#createDisplayItems()` to filter out allocated transactions:

```typescript
// Before: Added ALL transactions
transactions.forEach((transaction) => { ... });

// After: Only add free transactions
const freeTransactions = transactions.filter((t) => !t.budgetLineId);
freeTransactions.forEach((transaction) => { ... });
```

## Files Modified

| File | Changes |
|------|---------|
| `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-data-provider.ts` | Filter allocated transactions in `#createDisplayItems()` |
| `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-data-provider.spec.ts` | Added 3 tests for allocated transactions filtering |

## Test Results

- All 652 frontend tests pass
- Quality checks pass

## Key Files Modified

| File | Changes |
|------|---------|
| `shared/src/calculators/budget-formulas.ts` | Extended interface, refactored calculateTotalExpenses, added calculateEnvelopeOverruns |
| `shared/src/calculators/budget-formulas.spec.ts` | Added 9 tests for allocated transactions |
| `backend-nest/src/modules/budget/budget.repository.ts` | Extended options, separate fields per table |
| `backend-nest/src/modules/budget/budget.calculator.ts` | Updated field selection and mapping |
| `frontend/projects/webapp/src/app/core/budget/budget-calculator.spec.ts` | Added 4 tests for allocated transactions |
