# Plan de Correction : Logique de Rollover Cumulatif

## Problème Identifié

La documentation actuelle contient une erreur logique fondamentale : le rollover n'est pas simplement l'ending_balance du mois précédent, mais le **cumul total** de tous les soldes précédents. L'exemple actuel perd la "mémoire" du rollover cumulé, ce qui créerait un bug majeur dans l'implémentation.

### Exemple du Bug
- **Janvier** : ending_balance = 1000 CHF → disponible = 1000 CHF
- **Février** : ending_balance = 2000 CHF + rollover 1000 CHF → disponible = 3000 CHF
- **Mars** : ending_balance = 300 CHF + rollover **2000 CHF** ❌ → disponible = 2300 CHF

**Problème** : En Mars, prendre uniquement l'ending_balance de Février (2000 CHF) fait perdre les 1000 CHF de Janvier qui étaient disponibles en Février.

## Solution : Architecture avec `rollover_balance`

### Terminologie Clarifiée
- **`ending_balance`** : Solde pur du mois (revenus - dépenses du mois uniquement)
- **`rollover_balance`** : Solde total cumulé qui peut être reporté au mois suivant
- **`rollover`** : Héritage du mois N-1 (= rollover_balance du mois précédent)
- **`available_to_spend`** : Ce que voit l'utilisateur

### Formules Corrigées
```
rollover_balance_N = rollover_balance_(N-1) + ending_balance_N
rollover_du_mois_N = rollover_balance_(N-1)
available_to_spend_N = ending_balance_N + rollover_balance_(N-1)
```

---

## Phase 1 : Migration Base de Données

### 1.1 Création de la Migration Supabase

**Fichier** : `backend-nest/supabase/migrations/[timestamp]_add_rollover_balance_to_monthly_budget.sql`

```sql
-- Ajouter la colonne rollover_balance à monthly_budget
ALTER TABLE monthly_budget 
ADD COLUMN rollover_balance NUMERIC(10,2) DEFAULT 0;

-- Commenter la colonne pour clarifier son usage
COMMENT ON COLUMN monthly_budget.rollover_balance IS 'Solde total cumulé qui peut être reporté au mois suivant (évite la récursivité)';

-- Index pour optimiser les requêtes de rollover
CREATE INDEX idx_monthly_budget_rollover_balance ON monthly_budget (user_id, year, month, rollover_balance);
```

### 1.2 Script de Migration des Données Existantes

**Fichier** : `backend-nest/scripts/migrate-rollover-balance.sql`

```sql
-- Recalculer rollover_balance pour tous les budgets existants
WITH ordered_budgets AS (
  SELECT 
    id,
    user_id,
    year,
    month,
    ending_balance,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY year, month
    ) as row_num
  FROM monthly_budget 
  WHERE ending_balance IS NOT NULL
),
cumulative_calculation AS (
  SELECT 
    id,
    user_id,
    year,
    month,
    ending_balance,
    SUM(ending_balance) OVER (
      PARTITION BY user_id 
      ORDER BY year, month 
      ROWS UNBOUNDED PRECEDING
    ) as calculated_rollover_balance
  FROM ordered_budgets
)
UPDATE monthly_budget 
SET rollover_balance = cc.calculated_rollover_balance
FROM cumulative_calculation cc
WHERE monthly_budget.id = cc.id;
```

### 1.3 Commandes d'Exécution

```bash
# Dans backend-nest/
bun run supabase:push  # Appliquer la migration
bun run generate-types:local  # Regénérer les types TypeScript
```

---

## Phase 2 : Mise à Jour du Code Backend

### 2.1 Types TypeScript

**Fichier** : `backend-nest/src/types/database.types.ts`

Regénérer automatiquement après la migration.

### 2.2 Service Budget - Calcul du Rollover

**Fichier** : `backend-nest/src/modules/budget/budget.service.ts`

#### Mise à Jour des Méthodes de Calcul

```typescript
// Nouvelle méthode pour calculer et persister rollover_balance
private async calculateAndPersistRolloverBalance(
  budgetId: string,
  userId: string,
  year: number,
  month: number,
): Promise<number> {
  const endingBalance = await this.calculateEndingBalance(budgetId);
  const previousRolloverBalance = await this.getPreviousRolloverBalance(userId, year, month);
  
  const newRolloverBalance = previousRolloverBalance + endingBalance;
  
  // Persister les deux valeurs
  await this.supabase
    .from('monthly_budget')
    .update({
      ending_balance: endingBalance,
      rollover_balance: newRolloverBalance,
    })
    .eq('id', budgetId);
    
  return newRolloverBalance;
}

// Nouvelle méthode pour récupérer le rollover_balance du mois précédent
private async getPreviousRolloverBalance(
  userId: string, 
  year: number, 
  month: number
): Promise<number> {
  const { data } = await this.supabase
    .from('monthly_budget')
    .select('rollover_balance')
    .eq('user_id', userId)
    .eq('year', month === 1 ? year - 1 : year)
    .eq('month', month === 1 ? 12 : month - 1)
    .single();
    
  return data?.rollover_balance ?? 0;
}

// Mise à jour de la méthode de calcul Available to Spend
async calculateAvailableToSpend(budgetId: string): Promise<number> {
  const { data: budget } = await this.supabase
    .from('monthly_budget')
    .select('ending_balance, user_id, year, month')
    .eq('id', budgetId)
    .single();
    
  if (!budget) throw new NotFoundException('Budget not found');
  
  const endingBalance = budget.ending_balance ?? 
    await this.calculateEndingBalance(budgetId);
    
  const rollover = await this.getPreviousRolloverBalance(
    budget.user_id, 
    budget.year, 
    budget.month
  );
  
  return endingBalance + rollover;
}
```

#### Mise à Jour des Événements de Recalcul

```typescript
// Déclencher le recalcul lors des modifications
async onBudgetLineChanged(budgetId: string): Promise<void> {
  const { data: budget } = await this.supabase
    .from('monthly_budget')
    .select('user_id, year, month')
    .eq('id', budgetId)
    .single();
    
  if (budget) {
    await this.calculateAndPersistRolloverBalance(
      budgetId,
      budget.user_id,
      budget.year,
      budget.month
    );
  }
}

async onTransactionChanged(budgetId: string): Promise<void> {
  // Même logique que onBudgetLineChanged
  await this.onBudgetLineChanged(budgetId);
}
```

### 2.3 DTOs et Mappers

**Fichier** : `backend-nest/src/modules/budget/dto/budget-response.dto.ts`

```typescript
export class BudgetSummaryDto {
  endingBalance: number;
  rolloverBalance: number;
  rollover: number; // rollover_balance du mois précédent
  availableToSpend: number;
  // ... autres champs
}
```

**Fichier** : `backend-nest/src/modules/budget/budget.mapper.ts`

```typescript
static toBudgetSummary(
  budget: BudgetRow,
  rollover: number,
  availableToSpend: number
): BudgetSummaryDto {
  return {
    endingBalance: budget.ending_balance ?? 0,
    rolloverBalance: budget.rollover_balance ?? 0,
    rollover,
    availableToSpend,
    // ... autres mappings
  };
}
```

### 2.4 Tests Unitaires

**Fichier** : `backend-nest/src/modules/budget/budget.service.spec.ts`

```typescript
describe('Rollover Balance Calculation', () => {
  it('should calculate cumulative rollover balance correctly', async () => {
    // Janvier : ending_balance = 500 CHF
    // Février : ending_balance = -200 CHF
    // Résultat attendu : rollover_balance_février = 500 + (-200) = 300 CHF
    
    const janBudget = await service.createBudget(userId, { year: 2025, month: 1 });
    await service.updateEndingBalance(janBudget.id, 500);
    
    const febBudget = await service.createBudget(userId, { year: 2025, month: 2 });
    await service.updateEndingBalance(febBudget.id, -200);
    
    const rolloverBalance = await service.getRolloverBalance(febBudget.id);
    expect(rolloverBalance).toBe(300);
  });
  
  it('should handle first month with zero rollover', async () => {
    const budget = await service.createBudget(userId, { year: 2025, month: 1 });
    const rollover = await service.getPreviousRolloverBalance(userId, 2025, 1);
    expect(rollover).toBe(0);
  });
});
```

---

## Phase 3 : Mise à Jour des Documentations

### 3.1 BUSINESS_RULES_ROLLOVER_LIVING_ALLOWANCE.md

**Sections à Modifier :**

#### Section "Formules de Calcul"
```markdown
### 2. Ending Balance (Solde de Fin de Mois) - VALEUR STOCKÉE
```
Ending Balance = Σ(Revenus) - Σ(Dépenses + Épargnes)
                 depuis budget_lines ET transactions
```

**Définition :** Le solde "pur" du mois, SANS tenir compte du rollover. Cette valeur est **persistée dans la base de données** (`monthly_budget.ending_balance`).

### 3. Rollover Balance (Solde Total Reportable) - VALEUR STOCKÉE
```
Rollover Balance = Rollover Balance(mois N-1) + Ending Balance(mois N)
```

**Définition :** Le solde total cumulé qui peut être reporté au mois suivant. Cette valeur est **persistée dans la base de données** (`monthly_budget.rollover_balance`) pour éviter la récursivité.

### 4. Rollover (Report du Mois Précédent)
```
Rollover du mois N = Rollover Balance du mois N-1
```

**Définition :** Le montant reporté du mois précédent. C'est le rollover_balance du mois précédent.

### 5. Disponible à Dépenser (Available to Spend) - VALEUR AFFICHÉE
```
Disponible à Dépenser = Ending Balance(mois actuel) + Rollover Balance(mois précédent)
```
```

#### Section "Exemple Concret" Corrigé
```markdown
**Janvier :**
- Revenus (budget_lines) : 5000 CHF
- Dépenses + Épargnes (budget_lines) : 4000 CHF
- Transactions : 0 CHF
- **Ending Balance Janvier (stocké) : 1000 CHF**
- **Rollover Balance Janvier (stocké) : 1000 CHF** (premier mois)
- Rollover reçu : 0 CHF (premier mois)
- **Disponible à Dépenser affiché : 1000 CHF**

**Février :**
- Revenus (budget_lines) : 5000 CHF
- Dépenses + Épargnes (budget_lines) : 3000 CHF
- Transactions : 0 CHF
- **Ending Balance Février (stocké) : 2000 CHF**
- **Rollover Balance Février (stocké) : 3000 CHF** (1000 + 2000)
- Rollover reçu (= Rollover Balance Janvier) : 1000 CHF
- **Disponible à Dépenser affiché : 3000 CHF**

**Mars :**
- Revenus (budget_lines) : 5000 CHF
- Dépenses + Épargnes (budget_lines) : 4500 CHF
- Transactions : -200 CHF (dépense réelle)
- **Ending Balance Mars (stocké) : 300 CHF** (5000 - 4500 - 200)
- **Rollover Balance Mars (stocké) : 3300 CHF** (3000 + 300)
- Rollover reçu (= Rollover Balance Février) : 3000 CHF
- **Disponible à Dépenser affiché : 3300 CHF**
```

#### Nouveau Tableau Comparatif
```markdown
## 📊 Tableau Comparatif des Concepts

| Mois | Ending Balance | Rollover | Rollover Balance | Available to Spend |
|------|---------------|----------|------------------|-------------------|
|      | (solde du mois) | (héritage N-1) | (cumul total) | (affiché user) |
| Jan  | +1000 CHF     | 0 CHF    | +1000 CHF        | 1000 CHF          |
| Fév  | +2000 CHF     | +1000 CHF| +3000 CHF        | 3000 CHF          |
| Mar  | +300 CHF      | +3000 CHF| +3300 CHF        | 3300 CHF          |

**Formules :**
- `rollover_balance_N = rollover_balance_(N-1) + ending_balance_N`
- `rollover_N = rollover_balance_(N-1)`
- `available_to_spend_N = ending_balance_N + rollover_N`
```

### 3.2 SPECS.md

**Section "Business Model" à Mettre à Jour :**

```markdown
### Core Calculation Logic: "Fixed Block" vs. "Available to Spend"

1. **The Fixed Block:** At the start of the month, the system calculates the **Fixed Block**.
   `Fixed Block = Sum(All Expenses) + Sum(All Planned Savings)`

2. **The Ending Balance:** The system calculates and stores the month's pure balance.
   `Ending Balance = Income - (Expenses + Savings)` from ALL sources (budget_lines + transactions)
   - Stored in `monthly_budget.ending_balance`
   - Does NOT include rollover

3. **The Rollover Balance:** The system calculates and stores the cumulative total.
   `Rollover Balance = Previous Rollover Balance + Current Ending Balance`
   - Stored in `monthly_budget.rollover_balance`
   - Avoids recursion for performance

4. **The Rollover:** Previous month's rollover balance becomes current month's rollover.
   `Rollover = rollover_balance of month n-1`

5. **Available to Spend (User Display):** What the user sees as spendable amount.
   `Available to Spend = Ending Balance (current month) + Rollover`
```

**Section "Business Rules" à Ajouter :**

```markdown
### RG-009: Rollover Balance Persistence Strategy

- **Rule:** The system MUST persist both `ending_balance` and `rollover_balance` to avoid recursive calculations.
- **Architecture:** 
  - `ending_balance` = pure month balance (local, independent)
  - `rollover_balance` = cumulative total (for performance optimization)
- **Update Strategy:** When month N is modified:
  1. Recalculate `ending_balance_N` from budget_lines + transactions
  2. Update `rollover_balance_N = rollover_balance_(N-1) + ending_balance_N`
  3. No cascade: future months keep their existing rollover_balance
```

---

## Phase 4 : Tests et Validation

### 4.1 Tests Backend

**Commandes :**
```bash
# Tests unitaires avec la nouvelle logique
cd backend-nest
bun test budget.service.spec.ts

# Tests d'intégration
bun test:e2e budget
```

### 4.2 Tests de Migration

**Script de Validation :**
```sql
-- Vérifier que rollover_balance est cohérent
WITH validation AS (
  SELECT 
    user_id,
    year,
    month,
    ending_balance,
    rollover_balance,
    LAG(rollover_balance) OVER (
      PARTITION BY user_id 
      ORDER BY year, month
    ) as prev_rollover_balance,
    rollover_balance - COALESCE(
      LAG(rollover_balance) OVER (
        PARTITION BY user_id 
        ORDER BY year, month
      ), 0
    ) as calculated_ending_balance
  FROM monthly_budget
  WHERE ending_balance IS NOT NULL
)
SELECT *
FROM validation
WHERE ABS(ending_balance - calculated_ending_balance) > 0.01; -- Doit être vide
```

### 4.3 Tests de Régression

- Vérifier que les calculs existants ne sont pas cassés
- Valider que la performance n'est pas dégradée
- Confirmer que l'API reste compatible

---

## Phase 5 : Déploiement

### 5.1 Checklist Pré-déploiement

- [ ] Migration SQL testée localement
- [ ] Types TypeScript regénérés
- [ ] Tests unitaires passent
- [ ] Tests d'intégration passent 
- [ ] Documentation mise à jour
- [ ] Script de migration des données existantes prêt

### 5.2 Procédure de Déploiement

1. **Backup de production** (au cas où)
2. **Appliquer la migration** : `bun run supabase:push`
3. **Migrer les données existantes** : Exécuter le script de migration
4. **Déployer le code backend** mis à jour
5. **Valider** quelques calculs en production

### 5.3 Rollback Plan

- Script de suppression de la colonne `rollover_balance`
- Version précédente du code prête à redéployer
- Backup de base de données disponible

---

## Calendrier d'Exécution

| Phase | Durée Estimée | Dépendances |
|-------|--------------|-------------|
| Phase 1: Migration BDD | 2h | - |
| Phase 2: Code Backend | 4h | Phase 1 |
| Phase 3: Documentation | 2h | Phase 1-2 |
| Phase 4: Tests | 3h | Phase 1-3 |
| Phase 5: Déploiement | 1h | Phase 1-4 |

**Total Estimé :** 12 heures

---

## Bénéfices Attendus

### ✅ Correction du Bug
- Élimination de la perte de mémoire du rollover cumulé
- Calculs cohérents sur tous les mois
- Logique métier alignée avec l'implémentation

### ✅ Performance Optimisée
- Pas de récursivité : calculs en O(1)
- Pas de requêtes en chaîne pour récupérer le rollover
- Scalabilité garantie même avec des années d'historique

### ✅ Architecture Robuste
- Données persistées pour éviter les recalculs
- Architecture simple et maintenable
- Tests exhaustifs pour éviter les régressions futures