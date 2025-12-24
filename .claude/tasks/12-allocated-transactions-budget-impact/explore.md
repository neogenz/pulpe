# Task: Transactions allouées - Impact sur le budget total

## Règle Métier à Implémenter

**Principe fondamental :** Une transaction allouée à une enveloppe (budget line) ne doit PAS être déduite du budget total, sauf en cas de dépassement.

### Exemples concrets :
| Enveloppe | Transactions allouées | Impact sur budget total |
|-----------|----------------------|------------------------|
| 500 CHF   | 100 CHF              | **0 CHF** (couvert par l'enveloppe) |
| 500 CHF   | 500 CHF              | **0 CHF** (exactement couvert) |
| 500 CHF   | 600 CHF              | **100 CHF** (dépassement uniquement) |
| 500 CHF   | 200 + 100 + 300 CHF  | **100 CHF** (total 600 - 500 = 100 de dépassement) |

### Formule actuelle (problème) :
```
expenses_M = Σ(budget_lines) + Σ(transactions)
```
→ **Toutes** les transactions sont comptées, même celles allouées à une enveloppe = double comptage.

### Formule corrigée :
```
expenses_M = Σ(budget_lines) + Σ(free_transactions) + Σ(envelope_overruns)

où:
- free_transactions = transactions SANS budget_line_id
- envelope_overruns = MAX(0, allocated_transactions_total - budget_line_amount) pour chaque enveloppe
```

---

## Codebase Context

### Fichier principal à modifier

**`shared/src/calculators/budget-formulas.ts`** (lignes 74-87)

```typescript
static calculateTotalExpenses(
  budgetLines: FinancialItem[],
  transactions: FinancialItem[] = [],
): number {
  const budgetExpenses = budgetLines
    .filter((line) => line.kind === 'expense' || line.kind === 'saving')
    .reduce((sum, line) => sum + line.amount, 0);

  const transactionExpenses = transactions
    .filter((t) => t.kind === 'expense' || t.kind === 'saving')
    .reduce((sum, t) => sum + t.amount, 0);

  return budgetExpenses + transactionExpenses;  // ❌ Problème ici
}
```

**Problème actuel :** La méthode ne connaît pas le lien `budgetLineId` des transactions, donc elle les compte toutes.

### Tests existants

**`shared/src/calculators/budget-formulas.spec.ts`**
- 435 lignes de tests
- Tests SPECS compliance (Janvier→Avril)
- Aucun test pour les transactions allouées

**`frontend/projects/webapp/src/app/core/budget/budget-calculator.spec.ts`**
- 527 lignes de tests
- Helper `createTransaction` avec `budgetLineId: null` (ligne 23)
- Aucun test pour les transactions allouées

---

## Interface FinancialItem à étendre

**Actuel :**
```typescript
interface FinancialItem {
  kind: TransactionKind;
  amount: number;
}
```

**Nécessaire :**
```typescript
interface FinancialItem {
  kind: TransactionKind;
  amount: number;
  id?: string;          // Pour identifier les budget lines
  budgetLineId?: string | null;  // Pour identifier les transactions allouées
}
```

---

## Flux de données

```
Transaction créée/modifiée
        ↓
TransactionService.create/update() (backend-nest)
        ↓
budgetService.recalculateBalances(budgetId)
        ↓
BudgetCalculator.recalculateAndPersist(budgetId)
        ↓
repository.fetchBudgetData() ← Doit inclure budget_line_id
        ↓
BudgetFormulas.calculateTotalExpenses() ← Modifier ici
        ↓
Persister ending_balance dans monthly_budget
```

---

## Key Files

| Fichier | Lignes clés | Rôle |
|---------|-------------|------|
| `shared/src/calculators/budget-formulas.ts` | 74-87, 138-160 | **Single source of truth** - À modifier |
| `shared/src/calculators/budget-formulas.spec.ts` | 77-116 | Tests calculateTotalExpenses - À enrichir |
| `backend-nest/src/modules/budget/budget.calculator.ts` | 30-63 | Appelle BudgetFormulas |
| `frontend/projects/webapp/src/app/core/budget/budget-calculator.ts` | 25-31 | Wrapper frontend |
| `frontend/projects/webapp/src/app/core/budget/budget-calculator.spec.ts` | 142-234 | Tests frontend |

---

## Patterns to Follow

### Test-Driven Development
1. **Écrire d'abord le test** dans `budget-formulas.spec.ts`
2. Le test doit échouer (comportement actuel)
3. Modifier `calculateTotalExpenses` pour le faire passer
4. Vérifier que les autres tests passent toujours

### Signature compatible
- La nouvelle interface doit être backward-compatible
- `budgetLineId` et `id` optionnels pour ne pas casser les appels existants

---

## Tests à écrire

### Test 1: Transaction allouée dans limite de l'enveloppe
```typescript
it('should NOT count allocated transaction when within envelope limit', () => {
  const budgetLines = [
    { id: 'bl-1', kind: 'expense', amount: 500 },  // Enveloppe 500 CHF
  ];
  const transactions = [
    { kind: 'expense', amount: 100, budgetLineId: 'bl-1' },  // Allouée
  ];

  // Attendu: 500 (enveloppe) + 0 (transaction couverte) = 500
  expect(BudgetFormulas.calculateTotalExpenses(budgetLines, transactions)).toBe(500);
});
```

### Test 2: Transaction allouée avec dépassement
```typescript
it('should count ONLY excess when allocated transactions exceed envelope', () => {
  const budgetLines = [
    { id: 'bl-1', kind: 'expense', amount: 500 },  // Enveloppe 500 CHF
  ];
  const transactions = [
    { kind: 'expense', amount: 600, budgetLineId: 'bl-1' },  // Dépassement de 100
  ];

  // Attendu: 500 (enveloppe) + 100 (dépassement) = 600
  expect(BudgetFormulas.calculateTotalExpenses(budgetLines, transactions)).toBe(600);
});
```

### Test 3: Transaction libre (non allouée)
```typescript
it('should count free transactions (not allocated) fully', () => {
  const budgetLines = [
    { id: 'bl-1', kind: 'expense', amount: 500 },
  ];
  const transactions = [
    { kind: 'expense', amount: 100, budgetLineId: null },  // Libre
  ];

  // Attendu: 500 (enveloppe) + 100 (transaction libre) = 600
  expect(BudgetFormulas.calculateTotalExpenses(budgetLines, transactions)).toBe(600);
});
```

### Test 4: Mix de transactions allouées et libres
```typescript
it('should handle mix of allocated and free transactions correctly', () => {
  const budgetLines = [
    { id: 'bl-1', kind: 'expense', amount: 500 },  // Enveloppe
  ];
  const transactions = [
    { kind: 'expense', amount: 300, budgetLineId: 'bl-1' },  // Allouée (couvert)
    { kind: 'expense', amount: 400, budgetLineId: 'bl-1' },  // Allouée (200 en dépassement)
    { kind: 'expense', amount: 150, budgetLineId: null },    // Libre
  ];

  // allocated_total = 700, envelope = 500 → dépassement = 200
  // Attendu: 500 (enveloppe) + 200 (dépassement) + 150 (libre) = 850
  expect(BudgetFormulas.calculateTotalExpenses(budgetLines, transactions)).toBe(850);
});
```

### Test 5: Backward compatibility
```typescript
it('should maintain backward compatibility with items without budgetLineId', () => {
  // Ancien comportement: items sans budgetLineId ni id
  const budgetLines = [
    { kind: 'expense', amount: 500 },  // Pas d'id
  ];
  const transactions = [
    { kind: 'expense', amount: 100 },  // Pas de budgetLineId
  ];

  // Attendu: comportement original 500 + 100 = 600
  expect(BudgetFormulas.calculateTotalExpenses(budgetLines, transactions)).toBe(600);
});
```

---

## Dependencies

### Prérequis
- Migration DB `budget_line_id` déjà appliquée ✓
- Schémas Zod avec `budgetLineId` déjà en place ✓
- Data provider calcule déjà `consumedAmount` ✓

### Impact sur autres modules
1. **Backend**: `fetchBudgetData()` doit retourner `budget_line_id` des transactions et `id` des budget lines
2. **Frontend**: Mise à jour automatique car utilise `BudgetFormulas` via le shared package

---

## Prochaine étape

Exécuter `/workflow:epct:plan .claude/tasks/12-allocated-transactions-budget-impact` pour créer le plan d'implémentation.
