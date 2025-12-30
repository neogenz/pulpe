# Task: Afficher le solde réalisé dans current-month

## Problem
L'utilisateur veut voir le solde réalisé dans la vue current-month pour avoir une vision rapide de sa situation.

## Proposed Solution
Ajouter l'indicateur "Solde réalisé" dans la page current-month, en utilisant le composant `FinancialSummary` existant.

## Dependencies
- Task #5: La fonction `calculateRealizedBalance()` doit exister
- Task #3: L'état coché doit être accessible dans le store

## Context

### Composant principal
- `frontend/projects/webapp/src/app/feature/current-month/current-month.ts`

### Store current-month existant
- `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

**Signals existants (lignes 127-161)**:
```typescript
readonly totalIncome = computed<number>(() => {
  const budgetLines = this.budgetLines();
  const transactions = this.transactions();
  return BudgetFormulas.calculateTotalIncome(budgetLines, transactions);
});

readonly totalExpenses = computed<number>(() => {
  const budgetLines = this.budgetLines();
  const transactions = this.transactions();
  return BudgetFormulas.calculateTotalExpenses(budgetLines, transactions);
});

readonly remaining = computed<number>(() => {
  const available = this.totalAvailable();
  const expenses = this.totalExpenses();
  return BudgetFormulas.calculateRemaining(available, expenses);
});
```

### Pattern à suivre
```typescript
// Ajouter dans current-month-store.ts
readonly realizedBalance = computed<number>(() => {
  const budgetLines = this.budgetLines();
  const transactions = this.transactions();
  return BudgetFormulas.calculateRealizedBalance(budgetLines, transactions);
});
```

### Composant FinancialSummary
- `frontend/projects/webapp/src/app/ui/financial-summary/financial-summary.ts`
- Déjà utilisé dans budget-financial-overview

### Budget Progress Bar existant
- `frontend/projects/webapp/src/app/feature/current-month/components/budget-progress-bar.ts`
- Affiche: Dépenses + Disponible
- **Option**: Ajouter le solde réalisé ici ou dans une card séparée

### Option recommandée: Card séparée
```html
<!-- Dans current-month.ts template, après budget-progress-bar -->
<pulpe-financial-summary
  [data]="realizedBalanceData()"
  class="mt-4"
/>
```

```typescript
// Dans current-month.ts
readonly realizedBalanceData = computed<FinancialSummaryData>(() => {
  const balance = this.store.realizedBalance();
  return {
    title: 'Solde réalisé',
    amount: balance,
    icon: 'check_circle',
    type: balance >= 0 ? 'income' : 'negative',
  };
});
```

### Fichiers à modifier

1. **current-month-store.ts**:
   - Ajouter `readonly realizedBalance = computed(() => ...)`

2. **current-month.ts**:
   - Importer `FinancialSummary` component
   - Créer `realizedBalanceData` computed signal
   - Ajouter card dans le template

## Success Criteria
- [ ] Solde réalisé affiché dans current-month
- [ ] Même valeur que dans budget-table (même formule)
- [ ] Mise à jour réactive au toggle
- [ ] Design cohérent avec les indicateurs existants
- [ ] Position logique dans la page (après le progress bar)
