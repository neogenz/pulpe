# Task: Afficher le solde réalisé dans budget-table

## Problem
L'utilisateur veut voir le solde réalisé dans la vue budget-table pour suivre sa situation financière réelle.

## Proposed Solution
Ajouter un indicateur "Solde réalisé" dans le financial overview (grille de 4 cards existante → 5 cards).

## Dependencies
- Task #5: La fonction `calculateRealizedBalance()` doit exister
- Task #3: L'état coché doit être accessible dans le store

## Context

### Financial Overview existant
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-financial-overview.ts`
- Grille 4 cards: Revenus, Dépenses, Épargne, Disponible

```html
<!-- Lignes 20-28 -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <pulpe-financial-summary [data]="incomeData()" />
  <pulpe-financial-summary [data]="expenseData()" />
  <pulpe-financial-summary [data]="savingsData()" />
  <pulpe-financial-summary [data]="remainingData()" />
</div>
```

### Interface FinancialSummaryData
```typescript
export interface FinancialSummaryData {
  readonly title: string;
  readonly amount: number | string;
  readonly icon: string;
  readonly type: 'income' | 'expense' | 'savings' | 'negative';
  readonly isClickable?: boolean;
}
```

### Pattern de computed signal existant
```typescript
// Lignes 103-111
remainingData = computed<FinancialSummaryData>(() => {
  const remaining = this.totals().remaining;
  return {
    title: remaining >= 0 ? 'Disponible à dépenser' : 'Déficit',
    amount: Math.abs(remaining),
    icon: remaining >= 0 ? 'account_balance_wallet' : 'warning',
    type: remaining >= 0 ? 'savings' : 'negative',
  };
});
```

### Nouveau computed signal à créer
```typescript
realizedBalanceData = computed<FinancialSummaryData>(() => {
  const balance = this.realizedBalance();
  return {
    title: 'Solde réalisé',
    amount: balance,
    icon: 'check_circle',
    type: balance >= 0 ? 'income' : 'negative',
  };
});
```

### Store budget-details
- `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
- Ajouter computed signal `realizedBalance` utilisant `BudgetFormulas.calculateRealizedBalance()`

### Fichiers à modifier

1. **budget-details-store.ts**:
   - Ajouter `readonly realizedBalance = computed(() => ...)`

2. **budget-financial-overview.ts**:
   - Ajouter input `realizedBalance`
   - Créer `realizedBalanceData` computed
   - Modifier template: `lg:grid-cols-4` → `lg:grid-cols-5`
   - Ajouter 5ème card

3. **budget-details-page.ts**:
   - Passer `realizedBalance` au composant overview

## Success Criteria
- [ ] Nouvelle card "Solde réalisé" affichée dans la grille
- [ ] Calcul utilise `BudgetFormulas.calculateRealizedBalance()`
- [ ] Mise à jour réactive au toggle des checkboxes
- [ ] Icône `check_circle` pour positif, `warning` pour négatif
- [ ] Couleur `income` (bleu) pour positif, `negative` (rouge) pour négatif
- [ ] Formatage monétaire CHF cohérent
