# Task: Fix Envelope Allocated Expense Budget Regression

## Regression Origin

**Date:** 30 décembre 2025
**Commit:** `f0b5fb6fe` - "feat: add support for allocating transactions to budget lines (#142)"

### What happened

Quand la feature d'allocation des transactions aux enveloppes a été ajoutée, la logique correcte a été implémentée dans:
- ✅ `budget-financial-overview.ts` (page budget details)
- ✅ `budget-calculator.ts` (nouvelle méthode avec paramètre `budgetLines`)
- ✅ Tests unitaires définissant le comportement attendu

**MAIS** le `current-month-store.ts` (dashboard) a été **oublié** et n'a jamais été mis à jour pour utiliser cette logique.

### Conséquence

Il y a une **incohérence** entre les deux vues:
- **Dashboard** (`current-month-store.ts`): Le `remaining` diminue quand on ajoute une transaction allouée → **BUG**
- **Page Budget Details** (`budget-financial-overview.ts`): Le `remaining` ne diminue PAS tant qu'on ne dépasse pas l'enveloppe → **CORRECT**

---

## Problem Description

When adding an allocated expense (transaction linked to an envelope), it incorrectly affects the monthly remaining budget. The expected behavior is:
- Allocated transactions within envelope limits should NOT affect the remaining budget
- Only when total allocated expenses EXCEED the envelope amount should the OVERAGE impact the remaining budget
- Free transactions (not linked to any envelope) should impact normally

## Root Cause Analysis

### BUG LOCATION #1: `current-month-store.ts:171-175`

```typescript
readonly totalExpenses = computed<number>(() => {
  const budgetLines = this.budgetLines();
  const transactions = this.transactions();
  return BudgetFormulas.calculateTotalExpenses(budgetLines, transactions);
});
```

**Problem:** Uses `BudgetFormulas.calculateTotalExpenses()` which counts ALL transactions regardless of their `budgetLineId` allocation. It has NO envelope awareness.

### Why BudgetFinancialOverview works correctly

Looking at `budget-financial-overview.ts:160-166`:
```typescript
const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
const initialLivingAllowance = income - expenses - savings;
const transactionImpact =
  this.#budgetCalculator.calculateActualTransactionsAmount(
    freeTransactions,  // <-- Only passes free transactions!
  );
const remaining = initialLivingAllowance + transactionImpact;
```

**This is almost correct but has a subtle issue:** It filters to only free transactions, but doesn't pass `budgetLines` to `calculateActualTransactionsAmount()`. This means:
1. The overage calculation is not performed
2. If you have an envelope with allocated transactions exceeding its limit, the overage won't be counted

However, the envelope effective amount handling at lines 144-158 does account for overages via `Math.max(line.amount, consumption.consumed)`, which increases the expenses when there's an overage. So BudgetFinancialOverview actually works correctly through a different mechanism.

### The real bug is in CurrentMonthStore

The `current-month-store.ts` dashboard calculations don't implement any envelope logic at all. All transactions are counted directly via `BudgetFormulas.calculateTotalExpenses()`.

## Codebase Context

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `frontend/.../current-month-store.ts` | **BUG** - Dashboard store without envelope logic | 171-193 |
| `frontend/.../budget-financial-overview.ts` | Correct implementation (different approach) | 134-169 |
| `frontend/.../budget-calculator.ts` | Has correct envelope logic | 31-60, 66-98 |
| `shared/.../budget-formulas.ts` | Shared formulas - NO envelope awareness | 75-88 |
| `frontend/.../budget-calculator.spec.ts` | Tests defining expected behavior | 239-370 |

### Correct Envelope Logic (from `budget-calculator.ts:24-30`)

```typescript
/**
 * Règle métier importante:
 * - Les transactions LIBRES (budgetLineId = null) impactent directement le budget
 * - Les transactions ALLOUÉES (budgetLineId != null) sont déjà "couvertes" par leur enveloppe
 *   → Elles n'impactent le budget que si elles causent un DÉPASSEMENT
 *   → Dans ce cas, seul le dépassement est compté
 */
```

### Test Cases Confirming Expected Behavior

From `budget-calculator.spec.ts:240-346`:

1. **Allocated within envelope = 0 impact** (lines 240-258)
   - 500 CHF envelope, 100 CHF transaction → impact = 0

2. **Overage only** (lines 260-279)
   - 500 CHF envelope, 600 CHF transactions → impact = -100 (only overage)

3. **Mixed scenario** (lines 348-370)
   - Allocated without overage + free transactions → only free transactions count

## Patterns to Follow

### Envelope Allocation Pattern
Budget lines act as "envelopes". Transactions with `budgetLineId` are allocated to that envelope. The budget impact rule:
- **Free transactions** (`budgetLineId = null`): Full impact on remaining budget
- **Allocated transactions** (`budgetLineId != null`):
  - If `consumed <= envelope.amount` → 0 impact (covered by envelope)
  - If `consumed > envelope.amount` → `overage = consumed - envelope.amount` impacts budget

### Two Valid Implementation Approaches

**Approach A (BudgetFinancialOverview style):**
1. Calculate envelope effective amounts using `Math.max(line.amount, consumed)`
2. Filter only free transactions for transaction impact

**Approach B (BudgetCalculator style):**
1. Use `calculateActualTransactionsAmount(transactions, budgetLines)` with budgetLines parameter
2. This method internally handles: free transaction impact + overage calculation

## Dependencies

- `BudgetCalculator` service (frontend core)
- `calculateAllConsumptions()` utility for consumption mapping
- `BudgetFormulas` (shared) - note: does NOT handle envelope logic

## Fix Strategy

### Option 1: Align CurrentMonthStore with BudgetFinancialOverview approach

Modify `current-month-store.ts` to:
1. Import `calculateAllConsumptions` and `BudgetCalculator`
2. Calculate `totalExpenses` using envelope-aware logic (effective amounts with `Math.max`)
3. Adjust `remaining` to only count free transactions or use `calculateActualTransactionsAmount`

### Option 2: Use BudgetCalculator in CurrentMonthStore

Inject `BudgetCalculator` and use its methods for envelope-aware calculations.

## Related Components to Verify

After fixing, ensure these places still calculate correctly:
- `current-month-store.ts` - Dashboard remaining display
- `budget-financial-overview.ts` - Budget details overview (already correct)
- `envelopes-view-builder.ts` - Cumulative balance (already correct)

## Tests Created (TDD Approach)

**File:** `current-month-store.spec.ts`
**Section:** `describe('CurrentMonthStore - Envelope Allocation Logic')`

### Test Status

Ces tests sont conçus pour **ÉCHOUER** tant que le bug n'est pas corrigé. Après correction du bug, ils doivent **PASSER SANS AUCUNE MODIFICATION**.

| Test | Expected | Actual (Bug) | Status |
|------|----------|--------------|--------|
| Allocated within envelope (100/500) | 4500 | 4400 | ❌ FAIL |
| Multiple allocated within (400/500) | 4500 | 4100 | ❌ FAIL |
| Overage only (150/100) | 4850 | 4750 | ❌ FAIL |
| User scenario (188/100 = 88 overage) | 812 | 712 | ❌ FAIL |
| Mixed free + allocated | 4450 | 4250 | ❌ FAIL |
| Multiple envelopes (one overage) | 4150 | 3650 | ❌ FAIL |
| Free income transaction | 4600 | 4600 | ✅ PASS |

### Tests Details

```typescript
describe('Allocated transactions within envelope limits', () => {
  it('should NOT impact remaining when allocated transaction is within envelope budget')
  it('should NOT impact remaining when multiple allocated transactions stay within envelope')
})

describe('Allocated transactions exceeding envelope limits', () => {
  it('should impact remaining ONLY by the overage amount')
  it('should correctly calculate 88 CHF overage (real user scenario)')
})

describe('Mixed free and allocated transactions', () => {
  it('should count free transactions normally while ignoring allocated within envelope')
  it('should count free income transactions as positive impact')
})

describe('Multiple envelopes with different states', () => {
  it('should handle multiple envelopes: one within limit, one with overage')
})
```

### Mock Cleanup Done

Lors de la création des tests, des mocks **inutiles** ont été identifiés et supprimés des tests existants :

| Mock supprimé | Raison |
|---------------|--------|
| `mockBudgetCalculator` | Le store utilise `BudgetFormulas` directement (import statique), pas `BudgetCalculator` par injection |
| `mockLogger` | Le store n'injecte pas `Logger` |

**Mock ajouté :** `toggleCheck$` dans `mockTransactionApi` (manquait)

### Validation Command

```bash
cd frontend && pnpm test -- projects/webapp/src/app/feature/current-month/services/current-month-store.spec.ts
```

**Résultat attendu avant fix :** 6 tests échouent
**Résultat attendu après fix :** Tous les tests passent (sans modification des tests)
