# Task: Implémenter le calcul du solde réalisé

## Problem
Il n'existe pas de calcul tenant compte uniquement des lignes cochées. L'utilisateur veut connaître son solde réel basé sur ce qui est effectivement réalisé.

## Proposed Solution
Créer des fonctions de calcul du "solde réalisé" dans `BudgetFormulas`:
```
solde_réalisé = Σ(revenus cochés) - Σ(dépenses cochées) - Σ(épargnes cochées)
```

## Dependencies
- Task #1: Le champ `checked_at` doit exister pour filtrer

## Context

### Fichier principal
- `shared/src/calculators/budget-formulas.ts`
- Classe `BudgetFormulas` avec méthodes statiques pures

### Interface FinancialItem actuelle (lignes 31-34)
```typescript
interface FinancialItem {
  kind: TransactionKind;  // 'income' | 'expense' | 'saving'
  amount: number;
}
```

### Extension nécessaire
```typescript
interface FinancialItem {
  kind: TransactionKind;
  amount: number;
  checkedAt?: string | null;  // NOUVEAU
}
```

### Pattern de calcul existant
```typescript
// calculateTotalIncome (lignes 49-62)
static calculateTotalIncome(
  budgetLines: FinancialItem[],
  transactions: FinancialItem[] = [],
): number {
  const budgetIncome = budgetLines
    .filter((line) => line.kind === 'income')
    .reduce((sum, line) => sum + line.amount, 0);

  const transactionIncome = transactions
    .filter((t) => t.kind === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  return budgetIncome + transactionIncome;
}
```

### Nouvelles fonctions à créer

```typescript
// Après calculateTotalIncome
static calculateRealizedIncome(
  budgetLines: FinancialItem[],
  transactions: FinancialItem[] = [],
): number {
  const checkedBudgetIncome = budgetLines
    .filter((line) => line.checkedAt != null && line.kind === 'income')
    .reduce((sum, line) => sum + line.amount, 0);

  const checkedTransactionIncome = transactions
    .filter((t) => t.checkedAt != null && t.kind === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  return checkedBudgetIncome + checkedTransactionIncome;
}

// Après calculateTotalExpenses
static calculateRealizedExpenses(
  budgetLines: FinancialItem[],
  transactions: FinancialItem[] = [],
): number {
  const checkedBudgetExpenses = budgetLines
    .filter((line) => line.checkedAt != null &&
            (line.kind === 'expense' || line.kind === 'saving'))
    .reduce((sum, line) => sum + line.amount, 0);

  const checkedTransactionExpenses = transactions
    .filter((t) => t.checkedAt != null &&
            (t.kind === 'expense' || t.kind === 'saving'))
    .reduce((sum, t) => sum + t.amount, 0);

  return checkedBudgetExpenses + checkedTransactionExpenses;
}

// Fonction principale
static calculateRealizedBalance(
  budgetLines: FinancialItem[],
  transactions: FinancialItem[] = [],
): number {
  const realizedIncome = this.calculateRealizedIncome(budgetLines, transactions);
  const realizedExpenses = this.calculateRealizedExpenses(budgetLines, transactions);
  return realizedIncome - realizedExpenses;
}
```

### Tests à ajouter
- `shared/src/calculators/budget-formulas.spec.ts`

```typescript
describe('calculateRealizedIncome', () => {
  it('should only count checked income items', () => {
    const budgetLines = [
      { kind: 'income', amount: 5000, checkedAt: '2025-01-15T10:00:00Z' },
      { kind: 'income', amount: 1000, checkedAt: null },
    ];
    expect(BudgetFormulas.calculateRealizedIncome(budgetLines)).toBe(5000);
  });

  it('should return 0 when no items are checked', () => {
    const budgetLines = [
      { kind: 'income', amount: 5000, checkedAt: null },
    ];
    expect(BudgetFormulas.calculateRealizedIncome(budgetLines)).toBe(0);
  });
});

describe('calculateRealizedBalance', () => {
  it('should calculate balance from checked items only', () => {
    const budgetLines = [
      { kind: 'income', amount: 5000, checkedAt: '2025-01-15' },
      { kind: 'expense', amount: 2000, checkedAt: '2025-01-16' },
      { kind: 'expense', amount: 1000, checkedAt: null },
    ];
    expect(BudgetFormulas.calculateRealizedBalance(budgetLines)).toBe(3000);
  });
});
```

### Fichiers à modifier
1. `shared/src/calculators/budget-formulas.ts` - Ajouter les 3 nouvelles fonctions
2. `shared/src/calculators/budget-formulas.spec.ts` - Ajouter les tests

## Success Criteria
- [ ] `calculateRealizedIncome()` filtre sur `checkedAt !== null`
- [ ] `calculateRealizedExpenses()` filtre sur `checkedAt !== null`
- [ ] `calculateRealizedBalance()` retourne revenus - dépenses - épargnes (tous cochés)
- [ ] Tests unitaires couvrent: aucun coché, tous cochés, mixte
- [ ] `pnpm test` passe dans le package `shared`
