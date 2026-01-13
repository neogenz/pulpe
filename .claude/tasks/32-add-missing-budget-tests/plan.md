# Plan : Ajouter les tests manquants pour le module Budget

## Contexte du problème

### Bug découvert
Un bug critique a été introduit dans `budget.calculator.ts` : la méthode `fetchBudgetData` utilisait le même paramètre `selectFields` pour les tables `budget_line` ET `transaction`.

Quand on a passé `'id, kind, amount, budget_line_id'`, la colonne `budget_line_id` a été demandée à la table `budget_line` qui **n'a pas cette colonne** (elle n'existe que dans `transaction`).

**Résultat** : L'API `/budgets` retournait `remaining: 0` pour tous les budgets.

### Pourquoi aucun test n'a détecté ce bug

1. **Mocks trop permissifs** : Les mocks retournent toujours toutes les colonnes, indépendamment des paramètres `selectFields`
2. **Pas de test unitaire pour `BudgetCalculator.calculateEndingBalance`** : Cette méthode est mockée avec une valeur en dur `() => Promise.resolve(100)`
3. **Pas de test pour `BudgetRepository.fetchBudgetData`** : La séparation des champs par table n'est jamais vérifiée
4. **Pas de test vérifiant le calcul de `remaining`** dans `BudgetService.findAll`

### Correction appliquée
Séparation des paramètres dans `BudgetDataOptions` :
```typescript
interface BudgetDataOptions {
  budgetLineFields?: string;   // Pour table budget_line
  transactionFields?: string;  // Pour table transaction
  // ...
}
```

---

## Tests à implémenter

### 1. Test unitaire : `budget.repository.spec.ts` (NOUVEAU FICHIER)

**Objectif** : Vérifier que `fetchBudgetData` passe les bons champs à chaque table.

**Fichier** : `backend-nest/src/modules/budget/budget.repository.spec.ts`

**Pattern** : Créer un mock Supabase qui capture les appels `from(table).select(fields)`.

```typescript
import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { BudgetRepository } from './budget.repository';

describe('BudgetRepository', () => {
  describe('fetchBudgetData', () => {
    it('should use separate field selections for budget_line and transaction tables', async () => {
      // ARRANGE
      const capturedCalls: { table: string; fields: string }[] = [];

      const mockSupabase = {
        from: (table: string) => ({
          select: (fields: string) => {
            capturedCalls.push({ table, fields });
            return {
              eq: () => ({
                order: () => ({
                  then: (cb: Function) => cb({ data: [], error: null }),
                }),
                then: (cb: Function) => cb({ data: [], error: null }),
              }),
            };
          },
        }),
      };

      const repository = new BudgetRepository();

      // ACT
      await repository.fetchBudgetData('budget-id', mockSupabase as any, {
        budgetLineFields: 'id, kind, amount',
        transactionFields: 'id, kind, amount, budget_line_id',
      });

      // ASSERT
      const budgetLineCall = capturedCalls.find(c => c.table === 'budget_line');
      const transactionCall = capturedCalls.find(c => c.table === 'transaction');

      expect(budgetLineCall?.fields).toBe('id, kind, amount');
      expect(transactionCall?.fields).toBe('id, kind, amount, budget_line_id');

      // CRITICAL: Verify budget_line_id is NOT passed to budget_line table
      expect(budgetLineCall?.fields).not.toContain('budget_line_id');
    });

    it('should use default fields when no options provided', async () => {
      // Test que les valeurs par défaut sont 'kind, amount' pour les deux tables
    });
  });
});
```

---

### 2. Test unitaire : `budget.calculator.spec.ts` (NOUVEAU FICHIER)

**Objectif** : Vérifier que `calculateEndingBalance` retourne le bon résultat avec la logique d'enveloppe.

**Fichier** : `backend-nest/src/modules/budget/budget.calculator.spec.ts`

**Pattern** : Mocker le repository avec des données réalistes et vérifier le comportement.

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { BudgetCalculator } from './budget.calculator';
import { createMockPinoLogger } from '../../test/test-mocks';

describe('BudgetCalculator', () => {
  describe('calculateEndingBalance', () => {
    it('should calculate ending balance with envelope-aware expense logic', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () => Promise.resolve({
          budgetLines: [
            { id: 'line-1', kind: 'income', amount: 5000 },
            { id: 'line-2', kind: 'expense', amount: 500 }, // Envelope de 500
          ],
          transactions: [
            { id: 'tx-1', kind: 'expense', amount: 100, budget_line_id: 'line-2' }, // Alloué
          ],
        }),
      };

      const calculator = new BudgetCalculator(
        createMockPinoLogger() as any,
        mockRepository as any,
      );

      // ACT
      const result = await calculator.calculateEndingBalance('budget-id', {} as any);

      // ASSERT
      // Income: 5000
      // Expenses: max(500, 100) = 500 (envelope couvre la transaction)
      // Ending balance = 5000 - 500 = 4500
      expect(result).toBe(4500);
    });

    it('should count overage when transaction exceeds envelope', async () => {
      // ARRANGE
      const mockRepository = {
        fetchBudgetData: () => Promise.resolve({
          budgetLines: [
            { id: 'line-1', kind: 'income', amount: 5000 },
            { id: 'line-2', kind: 'expense', amount: 100 }, // Envelope de 100
          ],
          transactions: [
            { id: 'tx-1', kind: 'expense', amount: 150, budget_line_id: 'line-2' }, // Dépasse de 50
          ],
        }),
      };

      const calculator = new BudgetCalculator(
        createMockPinoLogger() as any,
        mockRepository as any,
      );

      // ACT
      const result = await calculator.calculateEndingBalance('budget-id', {} as any);

      // ASSERT
      // Expenses: max(100, 150) = 150 (overage comptabilisé)
      // Ending balance = 5000 - 150 = 4850
      expect(result).toBe(4850);
    });

    it('should pass correct field options to repository', async () => {
      // ARRANGE
      let capturedOptions: any = null;
      const mockRepository = {
        fetchBudgetData: (_id: string, _client: any, options: any) => {
          capturedOptions = options;
          return Promise.resolve({ budgetLines: [], transactions: [] });
        },
      };

      const calculator = new BudgetCalculator(
        createMockPinoLogger() as any,
        mockRepository as any,
      );

      // ACT
      await calculator.calculateEndingBalance('budget-id', {} as any);

      // ASSERT - Verify the calculator requests the right fields
      expect(capturedOptions.budgetLineFields).toBe('id, kind, amount');
      expect(capturedOptions.transactionFields).toBe('id, kind, amount, budget_line_id');
    });
  });
});
```

---

### 3. Test de régression : Ajouter à `budget.service.spec.ts`

**Objectif** : Vérifier que `findAll` retourne des budgets avec un `remaining` correctement calculé.

**Fichier** : `backend-nest/src/modules/budget/budget.service.spec.ts` (EXISTANT)

**Ajouter dans le describe 'findAll'** :

```typescript
describe('findAll', () => {
  // ... tests existants ...

  it('should return budgets with correctly calculated remaining field', async () => {
    // ARRANGE
    const mockUser = createMockAuthenticatedUser();
    const mockBudgets = [createValidBudgetEntity()];

    mockSupabaseClient.setMockData(mockBudgets);

    // Mock calculator to return a specific value
    mockCalculator.calculateEndingBalance = () => Promise.resolve(4500);
    mockCalculator.getRollover = () => Promise.resolve({ rollover: 500, previousBudgetId: null });

    // ACT
    const result = await service.findAll(mockUser, mockSupabaseClient as any);

    // ASSERT
    expect(result.success).toBe(true);
    expect(result.data[0].remaining).toBe(5000); // 4500 + 500 rollover
  });

  it('should not use same selectFields for different tables (regression test)', async () => {
    // Ce test vérifie que le bug de selectFields partagé ne revient pas
    // En vérifiant que le calculator est appelé avec les bons paramètres
  });
});
```

---

## Checklist d'implémentation

- [ ] Créer `backend-nest/src/modules/budget/budget.repository.spec.ts`
  - [ ] Test : séparation des champs par table
  - [ ] Test : valeurs par défaut

- [ ] Créer `backend-nest/src/modules/budget/budget.calculator.spec.ts`
  - [ ] Test : calcul avec logique d'enveloppe (within envelope)
  - [ ] Test : calcul avec dépassement (overage)
  - [ ] Test : vérification des options passées au repository

- [ ] Modifier `backend-nest/src/modules/budget/budget.service.spec.ts`
  - [ ] Test de régression : `remaining` calculé correctement dans `findAll`

- [ ] Exécuter les tests : `cd backend-nest && bun test budget`
- [ ] Vérifier la couverture : `bun test --coverage`

---

## Patterns à suivre

### Structure de test (AAA)
```typescript
it('should do something', async () => {
  // ARRANGE - Setup
  const mockData = {...};

  // ACT - Execute
  const result = await service.method();

  // ASSERT - Verify
  expect(result).toBe(expected);
});
```

### Mocks Supabase
Utiliser `createMockSupabaseClient()` de `test/test-mocks.ts` ou créer un mock ciblé.

### Conventions de nommage
- Fichier : `*.spec.ts`
- Describe : Nom de la classe
- It : `should + comportement attendu`

---

## Commandes

```bash
# Lancer les tests du module budget
cd backend-nest && bun test budget

# Lancer un fichier spécifique
bun test budget.repository.spec.ts

# Avec coverage
bun test budget --coverage
```
