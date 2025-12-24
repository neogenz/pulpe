# Implementation Plan: Transactions Allouées - Impact sur le Budget Total

## Overview

Modifier `BudgetFormulas.calculateTotalExpenses()` pour ne compter les transactions allouées à une enveloppe (budget line) que si elles dépassent le montant de l'enveloppe. Actuellement, toutes les transactions sont comptées intégralement, causant un double comptage.

### Formule corrigée

```
expenses_M = Σ(budget_lines) + Σ(free_transactions) + Σ(envelope_overruns)

où:
- free_transactions = transactions SANS budgetLineId
- envelope_overruns = MAX(0, allocated_transactions_total - budget_line_amount) pour chaque enveloppe
```

## Dependencies

1. Migration DB `budget_line_id` sur transactions - **DÉJÀ FAIT** ✓
2. Schémas Zod avec `budgetLineId` - **DÉJÀ FAIT** ✓
3. Build du shared package avant tests

## File Changes

### 1. `shared/src/calculators/budget-formulas.ts`

**Étendre l'interface FinancialItem** (lignes 31-34):
- Ajouter `id?: string` pour identifier les budget lines
- Ajouter `budgetLineId?: string | null` pour identifier les transactions allouées
- Ces champs sont optionnels pour maintenir la rétrocompatibilité

**Refactoriser calculateTotalExpenses** (lignes 74-87):
- Extraire le calcul des budget lines expenses (inchangé)
- Séparer les transactions en deux catégories :
  - `freeTransactions` : transactions sans `budgetLineId`
  - `allocatedTransactions` : transactions avec `budgetLineId`
- Pour les transactions libres : compter intégralement
- Pour les transactions allouées :
  - Grouper par `budgetLineId`
  - Pour chaque groupe, calculer le dépassement : `MAX(0, total_allocated - budget_line_amount)`
  - Nécessite de trouver le budget line correspondant dans la liste

**Logique de dépassement**:
- Créer une Map `budgetLineId → amount` depuis les budget lines
- Créer une Map `budgetLineId → total_transactions` depuis les transactions allouées
- Calculer le dépassement pour chaque enveloppe

### 2. `shared/src/calculators/budget-formulas.spec.ts`

**Ajouter un nouveau bloc describe** `'calculateTotalExpenses with allocated transactions'` après la ligne 116:

**Test 1 - Transaction allouée dans limite de l'enveloppe**:
- Budget line: 500 CHF (id: 'bl-1')
- Transaction allouée: 100 CHF (budgetLineId: 'bl-1')
- Attendu: 500 (enveloppe seule, transaction couverte)

**Test 2 - Transaction allouée avec dépassement**:
- Budget line: 500 CHF (id: 'bl-1')
- Transaction allouée: 600 CHF (budgetLineId: 'bl-1')
- Attendu: 600 (500 + 100 dépassement)

**Test 3 - Transaction libre (non allouée)**:
- Budget line: 500 CHF (id: 'bl-1')
- Transaction libre: 100 CHF (budgetLineId: null)
- Attendu: 600 (500 + 100)

**Test 4 - Mix de transactions allouées et libres**:
- Budget line: 500 CHF
- Transactions allouées: 300 + 400 = 700 CHF → dépassement 200
- Transaction libre: 150 CHF
- Attendu: 850 (500 + 200 + 150)

**Test 5 - Backward compatibility**:
- Items sans `id` ni `budgetLineId`
- Comportement original: somme simple
- Attendu: 600 (500 + 100)

**Test 6 - Plusieurs enveloppes avec dépassements mixtes**:
- Budget line 1: 500 CHF, transactions: 400 (pas de dépassement)
- Budget line 2: 300 CHF, transactions: 500 (dépassement 200)
- Attendu: 1000 (500 + 300 + 200)

**Mettre à jour createFinancialItem helper** (ligne 15):
- Ajouter paramètres optionnels `id` et `budgetLineId`

### 3. `backend-nest/src/modules/budget/budget.repository.ts`

**Modifier fetchBudgetData selectFields** (ligne 126):
- Changer le default de `'kind, amount'` à `'id, kind, amount'` pour budget lines
- Pour les transactions, le default doit inclure `'kind, amount, budget_line_id'`

**Note**: La méthode `calculateEndingBalance` dans `budget.calculator.ts` (ligne 37) passe `selectFields: 'kind, amount'`. Ce select doit être mis à jour.

### 4. `backend-nest/src/modules/budget/budget.calculator.ts`

**Modifier calculateEndingBalance** (lignes 30-50):
- Mettre à jour l'appel à `fetchBudgetData` pour récupérer les champs nécessaires
- Changer le `selectFields` en un format qui inclut `id` pour budget lines et `budget_line_id` pour transactions

**Option A (préférée)**: Modifier `BudgetDataOptions` pour avoir des select séparés:
- `budgetLineFields: 'id, kind, amount'`
- `transactionFields: 'kind, amount, budget_line_id'`

**Option B**: Utiliser `selectFields: '*'` (plus simple mais moins optimal)

### 5. `frontend/projects/webapp/src/app/core/budget/budget-calculator.spec.ts`

**Ajouter tests pour les transactions allouées** après ligne 395:
- Mêmes scénarios que dans le shared, en utilisant les types `BudgetLine` et `Transaction`
- Modifier `createTransaction` helper pour supporter `budgetLineId` non-null
- Modifier `createBudgetLine` helper - l'`id` existe déjà

**Tests à ajouter**:
- Transaction allouée couverte par enveloppe
- Transaction allouée avec dépassement
- Mix de transactions allouées et libres

## Testing Strategy

### Unit Tests
- `shared/src/calculators/budget-formulas.spec.ts` - Tests des nouvelles règles
- `frontend/projects/webapp/src/app/core/budget/budget-calculator.spec.ts` - Tests frontend

### Exécution
```bash
cd shared && pnpm test
cd frontend && pnpm test -- budget-calculator.spec.ts
```

### Validation manuelle
1. Créer une enveloppe de 500 CHF
2. Ajouter une transaction de 100 CHF allouée → budget total inchangé
3. Ajouter une transaction de 500 CHF allouée → budget total +100 (dépassement)
4. Ajouter une transaction de 50 CHF libre → budget total +50

## Rollout Considerations

### Backward Compatibility
- L'interface `FinancialItem` reste compatible (nouveaux champs optionnels)
- Les calculs sans `id`/`budgetLineId` fonctionnent comme avant
- Aucune migration de données nécessaire

### Impact
- Le recalcul des balances existantes sera corrigé automatiquement
- Les budgets avec transactions allouées verront leur `ending_balance` potentiellement augmenter

### Risques
- Performance: le groupement des transactions par `budgetLineId` est O(n)
- Si une transaction référence un `budgetLineId` inexistant, elle sera traitée comme libre (fallback sécurisé)
