# Plan d'Architecture Simplifiée : Logique de Rollover Dynamique

## Architecture Simplifiée Adoptée

Après révision, nous adoptons une architecture **ultra-simple** qui respecte les principes KISS/YAGNI et élimine la complexité de stockage cumulatif.

### Principe Fondamental
**Le rollover est calculé dynamiquement à la lecture, pas stocké en base.**

✅ **Rollover = Available to Spend du mois précédent**  
✅ **Seul `ending_balance` est persisté en base**  
✅ **Calculs dynamiques via Window Functions SQL**

## Nouvelle Architecture

### Données Stockées (Base de Données)
Pour chaque mois **N**, on stocke uniquement :
- **`incomes_N`** : Revenus du mois
- **`expenses_N`** : Dépenses du mois  
- **`ending_balance_N`** : Solde pur du mois (revenus - dépenses, sans rollover)

### Calculs Dynamiques (À la Lecture)
Quand on affiche le mois **N** :
- **`rollover_N`** = `available_to_spend_(N-1)` (calculé via window functions SQL)
- **`available_to_spend_N`** = `ending_balance_N + rollover_N`

### Formules Simplifiées

#### Formules conceptuelles (logique métier)
```
ending_balance_N = incomes_N - expenses_N
rollover_N = available_to_spend_(N-1)
available_to_spend_N = ending_balance_N + rollover_N
```

#### Implémentation SQL (window functions)
```sql
-- Implémentation optimisée : cumul direct des ending_balance précédents
-- Mathématiquement équivalent à rollover_N = available_to_spend_(N-1)
-- mais plus performant en SQL
rollover_N = SUM(ending_balance_1 + ending_balance_2 + ... + ending_balance_(N-1))
available_to_spend_N = SUM(ending_balance_1 + ending_balance_2 + ... + ending_balance_N)
```

### Exemple Concret
| Mois | Ending_balance (stocké) | Rollover (= available_to_spend du mois précédent) | Available_to_spend (calculé) |
|------|------------------------|--------------------------------------------------|----------------------------|
| Janvier | 500 CHF | 0 CHF (pas de mois précédent) | 500 CHF |
| Février | 400 CHF | 500 CHF (= available_to_spend de janvier) | 900 CHF |
| Mars | -100 CHF | 900 CHF (= available_to_spend de février) | 800 CHF |

---

## Phase 1 : Migration Base de Données (Simplification)

### 1.1 Suppression de la Colonne rollover_balance

**Fichier** : `backend-nest/supabase/migrations/20250829120000_remove_rollover_balance_simplify_architecture.sql`

```sql
-- Remove rollover_balance column to simplify architecture
-- New approach: calculate rollover dynamically from ending_balance only

-- Drop the index first
DROP INDEX IF EXISTS idx_monthly_budget_rollover_balance;

-- Remove the rollover_balance column
ALTER TABLE monthly_budget 
DROP COLUMN IF EXISTS rollover_balance;

-- Update table comment to reflect new simplified approach
COMMENT ON TABLE monthly_budget IS 'Monthly budgets with ending_balance only. Available to spend calculated dynamically as ending_balance_N + available_to_spend_(N-1)';
```

### 1.2 Avantages de la Simplification

- **✅ KISS** : Une seule colonne `ending_balance` à maintenir
- **✅ Auto-cohérent** : Pas de risque de désynchronisation entre ending_balance et rollover_balance
- **✅ Modification simple** : Changer un ancien mois impacte automatiquement les suivants
- **✅ Maintenance réduite** : Pas de propagation manuelle à gérer

### 1.3 Commandes d'Exécution

```bash
# ⚠️ ATTENTION: supabase:push va directement vers REMOTE/PRODUCTION !

# LOCAL (développement - migrations appliquées manuellement)
bun run dev                        # Démarre Supabase local (sans appliquer les migrations)
npx supabase migration up --local  # ⚠️ IMPORTANT: Appliquer les migrations manuellement
bun run generate-types:local       # Types depuis base locale
bun test                           # Validation code

# PRODUCTION (ATTENTION: commande dangereuse !)
bun run supabase:push              # ⚠️ PUSH DIRECT vers base REMOTE/PRODUCTION !
```

**⚠️ Important :** 
- `bun run dev` démarre Supabase mais **n'applique PAS automatiquement les migrations**
- Toujours exécuter `npx supabase migration up --local` après avoir ajouté de nouvelles migrations
- Si erreur "function not found in schema cache", exécuter `npx supabase migration up --local` pour forcer l'application des migrations


## Phase 2 : Mise à Jour du Code Backend

### 2.1 Types TypeScript

**Fichier** : `backend-nest/src/types/database.types.ts`

Types automatiquement mis à jour après la migration (plus de `rollover_balance`).

### 2.2 Service Budget - Calcul Dynamique du Rollover

**Fichier** : `backend-nest/src/modules/budget/budget.service.ts`

#### Nouvelle Logique : Supabase RPC + Window Functions

```sql
-- Fonction SQL optimisée (1 requête pour tout calculer) - VERSION CORRIGÉE
CREATE OR REPLACE FUNCTION get_budget_with_rollover(p_budget_id UUID)
RETURNS TABLE (
  ending_balance NUMERIC,
  rollover NUMERIC,
  available_to_spend NUMERIC
) AS $$
  WITH user_budget AS (
    -- Get the user and date info for the target budget
    SELECT user_id, year, month 
    FROM monthly_budget 
    WHERE id = p_budget_id
  ),
  user_budgets_with_rollover AS (
    -- Get ALL budgets for this user with rollover calculations
    SELECT 
      mb.id,
      mb.ending_balance,
      -- Rollover = Sum of all previous months' ending_balance for this user
      -- Mathématiquement équivalent à rollover_N = available_to_spend_(N-1)
      COALESCE(
        SUM(mb.ending_balance) OVER (
          PARTITION BY mb.user_id 
          ORDER BY mb.year, mb.month 
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0
      ) as rollover,
      -- Available to spend = Sum of ALL months (including current) ending_balance
      -- = ending_balance_N + rollover_N
      SUM(mb.ending_balance) OVER (
        PARTITION BY mb.user_id 
        ORDER BY mb.year, mb.month 
        ROWS UNBOUNDED PRECEDING
      ) as available_to_spend
    FROM monthly_budget mb
    CROSS JOIN user_budget ub
    WHERE mb.user_id = ub.user_id
  )
  SELECT 
    ubwr.ending_balance,
    ubwr.rollover,
    ubwr.available_to_spend
  FROM user_budgets_with_rollover ubwr
  WHERE ubwr.id = p_budget_id;
$$ LANGUAGE sql STABLE;
```

```typescript
// TypeScript ultra-simplifié - pas de récursivité !
async calculateAvailableToSpend(budgetId: string): Promise<{
  endingBalance: number;
  rollover: number;
  availableToSpend: number;
}> {
  // S'assurer que ending_balance est à jour
  await this.recalculateBalances(budgetId, supabase);
  
  // MÉTIER: Tout calculé en SQL (window functions PostgreSQL)
  const { data } = await supabase.rpc('get_budget_with_rollover', {
    p_budget_id: budgetId
  });
  
  return {
    endingBalance: data[0].ending_balance,
    rollover: data[0].rollover,
    availableToSpend: data[0].available_to_spend,
  };
}

// Mise à jour simplifiée (aucune propagation nécessaire)
async recalculateBalances(budgetId: string): Promise<void> {
  const endingBalance = await this.calculateMonthlyEndingBalance(budgetId, supabase);
  await this.persistEndingBalanceOnly(budgetId, endingBalance, supabase);
  // Window functions SQL gèrent automatiquement la cohérence des calculs
}
```

### 2.3 DTOs et Mappers Simplifiés

**Fichier** : `@pulpe/shared/schemas.ts`

```typescript
// Schema BudgetSummary simplifié (sans rolloverBalance)
export const budgetSummarySchema = z.object({
  endingBalance: z.number(),
  rollover: z.number(),
  availableToSpend: z.number(),
});

// Schema Budget simplifié (sans rolloverBalance)
export const budgetSchema = z.object({
  id: z.string().uuid(),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500),
  userId: z.string().uuid().optional(),
  templateId: z.string().uuid(),
  endingBalance: z.number().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

**Fichier** : `backend-nest/src/modules/budget/budget.mappers.ts`

```typescript
// Mapper simplifié sans rolloverBalance
export function toBudgetSummary(rolloverData: {
  endingBalance: number;
  rollover: number;
  availableToSpend: number;
}): BudgetSummary {
  return {
    endingBalance: rolloverData.endingBalance,
    rollover: rolloverData.rollover,
    availableToSpend: rolloverData.availableToSpend,
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

## Phase 3 : Tests et Validation

### 3.1 Tests Backend

**Commandes :**
```bash
# Tests unitaires avec la nouvelle logique
cd backend-nest
bun test budget.service.spec.ts

# Tests d'intégration
bun test:e2e budget
```

### 3.2 Tests de Migration


### 3.3 Tests de Régression

- Vérifier que les calculs existants ne sont pas cassés
- Valider que la performance n'est pas dégradée
- Confirmer que l'API reste compatible

---

## Phase 4 : Déploiement

### 5.1 Checklist Pré-déploiement

- [ ] Migration SQL testée localement
- [ ] Types TypeScript regénérés
- [ ] Tests unitaires passent
- [ ] Tests d'intégration passent 
- [ ] Documentation mise à jour
- [ ] Script de migration des données existantes prêt

### 5.2 Procédure de Déploiement

1. **Tester localement** : `bun run dev` + `bun test` (migrations auto-appliquées)
2. **⚠️ DÉJÀ FAIT** : Les migrations sont déjà en production ! 
3. **Regénérer types production** : `bun run generate-types` (depuis prod)
4. **Déployer code backend** mis à jour


---

## Calendrier d'Exécution

| Phase | Durée Estimée | Dépendances |
|-------|--------------|-------------|
| Phase 1: Migration BDD | 2h | - |
| Phase 2: Code Backend | 4h | Phase 1 |
| Phase 3: Tests | 3h | Phase 1-2 |
| Phase 4: Déploiement | 1h | Phase 1-3 |

**Total Estimé :** 10 heures

---

## Bénéfices de l'Architecture Simplifiée

### ✅ Simplicité Maximale (KISS/YAGNI)
- **1 seule colonne** : `ending_balance` à maintenir
- **Logique évidente** : Calcul récursif transparent
- **Maintenance réduite** : Pas de synchronisation entre 2 champs

### ✅ Robustesse Auto-Cohérente
- **Pas de désynchronisation** : Impossible d'avoir des incohérences
- **Auto-correction** : Modifier un mois ancien corrige automatiquement les suivants
- **Simplicité de debug** : Logique de calcul visible et traçable

### ✅ Architecture Métier Alignée  
- **Processus naturel** : Available to spend = ce que j'ai + ce que j'avais
- **Code self-documented** : La logique métier est dans le code, pas cachée dans du stockage
- **Maintenance 1 développeur** : Complexité adaptée à la taille du projet

---

## Leçons Apprises (Septembre 2025)

### 🐛 Bug Critique Identifié et Corrigé

**Problème** : La fonction SQL `get_budget_with_rollover` initiale ne fonctionnait pas.

**Symptôme** : Rollover toujours à 0, même avec des mois précédents ayant des `ending_balance` non-nuls.

**Cause racine** : La clause WHERE restrictive (`AND mb.id = p_budget_id`) limitait la requête à une seule ligne, rendant les window functions inopérantes.

**Solution** : Restructuration avec CTE pour calculer le rollover sur TOUS les budgets de l'utilisateur, puis filtrage du résultat final.

### 🎯 Architecture Validée en Production

**✅ Window Functions SQL** : Approche optimale confirmée
- Calcul en une seule requête
- Performance excellente même avec historique complet
- Aucune récursivité côté application

**✅ Équivalence Mathématique** : Les deux approches donnent le même résultat
- `rollover_N = available_to_spend_(N-1)` (conceptuel)
- `rollover_N = SUM(ending_balance_1..N-1)` (implémentation SQL)

**✅ Principe KISS Respecté** : La solution la plus simple qui fonctionne
- 1 seule colonne `ending_balance` à maintenir
- Pas de propagation manuelle
- Auto-cohérence garantie

### 🔍 Outils de Diagnostic Efficaces

**Tests d'intégration critiques** :
- Appeler directement l'API avec des données réelles
- Vérifier la cohérence mathématique des calculs
- Tester avec différents scénarios (premiers mois, mois négatifs)

**Debugging SQL** :
- Tester les fonctions RPC directement via curl/Supabase Studio
- Utiliser des CTEs pour décomposer les calculs complexes
- Valider que les window functions opèrent sur le bon dataset

### 💡 Réflexions Architecturales

**Logique métier en SQL** : Choix validé pour ce cas d'usage
- Calculs cumulatifs = domaine d'excellence des window functions
- Performance critique atteinte
- Réutilisabilité assurée

**Documentation vivante** : Ce plan.md s'avère essentiel
- Trace les décisions architecturales
- Documente les bugs et leurs corrections
- Guide les futures modifications

**Méthodologie KISS/YAGNI** : Efficace pour un projet maintenu par 1 développeur
- Évite la sur-ingénierie
- Facilite le debugging
- Réduit la complexité cognitive