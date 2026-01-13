# Task: Fix Backend Budget List Envelope Calculation

## Problem Statement

The frontend fix #29 corrected envelope-aware expense calculations in `CurrentMonthStore`, but the **backend** still uses the naive calculation for `/api/v1/budgets` endpoint.

**Symptom**: `/budgets` returns incorrect `remaining` and `endingBalance` values because allocated transactions within their envelope are being fully counted as expenses.

**Example** (Mars 2026):
- Backend returns: `remaining: 927.2`, `endingBalance: 927.2`
- Should be: Higher values because allocated transactions within envelope should NOT impact the budget

## Root Cause Analysis

### Frontend (FIXED in #29)
`frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts:175-200`

Uses envelope-aware logic:
```typescript
const consumptionMap = calculateAllConsumptions(budgetLines, transactions);
budgetLines.forEach((line) => {
  if (line.kind === 'expense' || line.kind === 'saving') {
    const consumption = consumptionMap.get(line.id);
    const effectiveAmount = consumption
      ? Math.max(line.amount, consumption.consumed)  // Only overage impacts budget
      : line.amount;
    total += effectiveAmount;
  }
});
// Also add free transactions (no budgetLineId)
```

### Backend (BUG - NOT FIXED)
`backend-nest/src/modules/budget/budget.calculator.ts:40-49`

Uses naive calculation:
```typescript
const totalExpenses = BudgetFormulas.calculateTotalExpenses(
  budgetLines,
  transactions,
);
```

Where `BudgetFormulas.calculateTotalExpenses` simply sums:
- All budget lines with kind `expense` or `saving`
- All transactions with kind `expense` or `saving`

**This double-counts allocated transactions!**

## Business Rule (from implementation.md)

```
Les transactions ALLOUEES sont "couvertes" par leur enveloppe
- Seul le DEPASSEMENT (consumed > envelope.amount) impacte le budget
- Les transactions LIBRES impactent directement le budget
```

## Key Files

### Backend (to modify)
| File | Purpose |
|------|---------|
| `backend-nest/src/modules/budget/budget.calculator.ts:30-50` | `calculateEndingBalance()` - **FIX HERE** |
| `backend-nest/src/modules/budget/budget.repository.ts` | Data fetching - needs `budgetLineId` in transaction select |

### Frontend (reference implementation)
| File | Purpose |
|------|---------|
| `frontend/projects/webapp/src/app/core/budget/budget-line-consumption.ts` | `calculateAllConsumptions()` function |
| `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts:175-200` | Envelope-aware totalExpenses |

### Shared (may need modification)
| File | Purpose |
|------|---------|
| `shared/src/calculators/budget-formulas.ts` | Contains naive `calculateTotalExpenses()` |
| `shared/src/calculators/budget-formulas.spec.ts` | Tests - need envelope test cases |

## Current Data Flow

```
GET /api/v1/budgets
  └── BudgetService.findAll()
      └── enrichBudgetsWithRemaining()
          └── calculateRemainingForBudget()
              └── BudgetCalculator.calculateEndingBalance()  <-- BUG HERE
                  └── BudgetFormulas.calculateTotalExpenses()  <-- Naive formula
```

## Proposed Solution

### Option A: Move `calculateAllConsumptions` to shared (Recommended)
1. Move `frontend/projects/webapp/src/app/core/budget/budget-line-consumption.ts` to `shared/src/calculators/`
2. Add `calculateTotalExpensesWithEnvelopes()` to `BudgetFormulas`
3. Update `BudgetCalculator.calculateEndingBalance()` to use new function
4. Add comprehensive tests

### Option B: Duplicate logic in backend
1. Create `calculateEnvelopeAwareExpenses()` in `BudgetCalculator`
2. Update `calculateEndingBalance()` to use it

**Option A is preferred** because it ensures frontend and backend use the same logic.

## Missing Tests

Backend has **zero tests** for envelope logic:
- `budget.calculator.spec.ts` - Does not exist
- `budget-formulas.spec.ts` - No envelope test cases

Frontend tests exist in:
- `current-month-store.spec.ts` - 32 tests including envelope scenarios

## Dependencies

The fix requires:
1. Transaction data must include `budgetLineId` field
2. Budget lines must be fetched with their IDs
3. Shared package rebuild after changes

## Patterns to Follow

From frontend implementation:
```typescript
// Calculate consumption map first
const consumptionMap = calculateAllConsumptions(budgetLines, transactions);

// For each expense/saving budget line
budgetLines.forEach((line) => {
  if (line.kind === 'expense' || line.kind === 'saving') {
    const consumption = consumptionMap.get(line.id);
    // Use MAX of envelope amount OR consumed amount
    const effectiveAmount = consumption
      ? Math.max(line.amount, consumption.consumed)
      : line.amount;
    total += effectiveAmount;
  }
});

// Add free transactions (those without budgetLineId)
const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
freeTransactions.forEach((tx) => {
  if (tx.kind === 'expense' || tx.kind === 'saving') {
    total += tx.amount;
  }
});
```

## Affected Endpoints

- `GET /api/v1/budgets` - Budget list with remaining/endingBalance
- `GET /api/v1/budgets/export` - Export all budgets
- `POST /api/v1/budgets` - Create budget (recalculates balance)
- `PATCH /api/v1/budgets/:id` - Update budget (recalculates balance)

## Test Scenarios (from frontend)

| Scenario | Expected Behavior |
|----------|-------------------|
| Allocated within envelope (100/500) | Only envelope amount (500) counts |
| Overage (150/100) | Envelope + overage (150) counts |
| Mixed free + allocated | Free txns + envelope-aware envelopes |
| Multiple envelopes | Each envelope calculated independently |
| Free income transaction | Does not affect expense calculation |
