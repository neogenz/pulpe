# Implementation Plan: Rollover basé sur payDayOfMonth

## Overview

**Contexte** : L'affichage fonctionne déjà correctement avec `budget-period.ts`. Le problème est que le **rollover SQL** ne prend pas en compte le `payDayOfMonth`.

**Objectif** : Faire en sorte que le calcul du rollover utilise les mêmes périodes de paie que l'affichage.

### Exemple avec payDay=27 :

| Budget | Période couverte | Rollover vient de |
|--------|------------------|-------------------|
| Décembre | 27 nov → 26 déc | Novembre |
| Janvier | 27 déc → 26 jan | Décembre |
| Février | 27 jan → 26 fév | Janvier |

---

## Fichiers à modifier

### 1. `backend-nest/supabase/migrations/[timestamp]_add_payday_to_rollover_function.sql`

**Créer nouvelle migration** qui modifie la fonction RPC.

**Action 1** : DROP l'ancienne fonction à un paramètre
```sql
DROP FUNCTION IF EXISTS public.get_budget_with_rollover(UUID);
```

**Action 2** : Créer nouvelle fonction avec deux paramètres
- Signature : `get_budget_with_rollover(p_budget_id UUID, p_pay_day_of_month INT DEFAULT 1)`
- Retourne : `TABLE (ending_balance NUMERIC, rollover NUMERIC, available_to_spend NUMERIC, previous_budget_id UUID)`

**Action 3** : Implémenter la logique d'ordonnancement par date de paie effective

La logique de `budget-period.ts` est :
```
Si jour >= payDay → budget du mois courant
Si jour < payDay → budget du mois précédent
```

**CRITICAL - Gestion des mois courts** : `make_date(2024, 2, 31)` provoque une erreur car février n'a pas 31 jours.

Utiliser cette formule pour calculer la date de début effective :
```sql
-- Calculer le jour effectif (min entre payDay et dernier jour du mois)
WITH effective_start AS (
  SELECT
    mb.id,
    mb.year,
    mb.month,
    COALESCE(mb.ending_balance, 0) as ending_balance,
    -- Calculer la date de début de la période budgétaire
    CASE
      WHEN p_pay_day_of_month IS NULL OR p_pay_day_of_month <= 1 THEN
        make_date(mb.year, mb.month, 1)
      ELSE
        make_date(
          mb.year,
          mb.month,
          LEAST(
            p_pay_day_of_month,
            EXTRACT(DAY FROM (
              date_trunc('month', make_date(mb.year, mb.month, 1))
              + INTERVAL '1 month'
              - INTERVAL '1 day'
            ))::INT
          )
        )
    END as budget_start_date
  FROM public.monthly_budget mb
  WHERE mb.user_id = (SELECT user_id FROM public.monthly_budget WHERE id = p_budget_id)
)
```

Puis ordonner les budgets par `budget_start_date` pour les window functions :
```sql
LAG(mb.id) OVER (
  PARTITION BY mb.user_id
  ORDER BY budget_start_date  -- Pas ORDER BY year, month !
) as previous_budget_id
```

**Action 4** : Gérer le cas payDay = 1 ou NULL
- Comportement calendaire standard (pas de décalage)
- Valider l'input : `GREATEST(1, LEAST(31, COALESCE(p_pay_day_of_month, 1)))`

**Action 5** : Ajouter COMMENT et SET search_path

---

### 2. `backend-nest/src/modules/budget/budget.calculator.ts`

**Action 1** : Modifier signature de `getRollover()` (ligne ~71)
- Avant : `getRollover(budgetId: string, supabase: AuthenticatedSupabaseClient)`
- Après : `getRollover(budgetId: string, payDayOfMonth: number, supabase: AuthenticatedSupabaseClient)`

> Note: Type `number` (pas `number | null`) car la validation se fait dans le service.

**Action 2** : Modifier l'appel RPC (ligne ~77)
```typescript
const { data, error } = await supabase
  .rpc('get_budget_with_rollover', {
    p_budget_id: budgetId,
    p_pay_day_of_month: payDayOfMonth
  })
  .single();
```

---

### 3. `backend-nest/src/modules/budget/budget.service.ts`

**Action 1** : Créer méthode privée pour récupérer et valider payDayOfMonth

```typescript
private static readonly DEFAULT_PAY_DAY = 1;
private static readonly MIN_PAY_DAY = 1;
private static readonly MAX_PAY_DAY = 31;

private async getPayDayOfMonth(
  supabase: AuthenticatedSupabaseClient
): Promise<number> {
  const { data } = await supabase.auth.getUser();
  const raw = data?.user?.user_metadata?.payDayOfMonth;

  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    return BudgetService.DEFAULT_PAY_DAY;
  }

  return Math.max(
    BudgetService.MIN_PAY_DAY,
    Math.min(BudgetService.MAX_PAY_DAY, raw)
  );
}
```

**Action 2** : Cacher payDayOfMonth au début des méthodes publiques (OBLIGATOIRE)

Pour chaque méthode publique qui appelle `getRollover()` :
1. Récupérer `payDayOfMonth` **une seule fois** au début
2. Le passer à tous les appels `calculator.getRollover()`

Exemple pour `findOneWithDetails` :
```typescript
async findOneWithDetails(...) {
  const payDayOfMonth = await this.getPayDayOfMonth(supabase);
  // ... utiliser payDayOfMonth partout
}
```

**Lignes concernées** (approximatif) :
- ~173 dans `enrichBudgetForExport`
- ~377 dans `addRolloverToBudget`
- ~792 et ~809 dans `calculateRemainingForBudget`

---

### 4. Régénérer les types Supabase

Après avoir appliqué la migration :
```bash
cd backend-nest && bun run generate-types:local
```

---

## Testing Strategy

### Tests unitaires (OBLIGATOIRE)

Créer `backend-nest/src/modules/budget/__tests__/rollover-payday.spec.ts` :

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('BudgetCalculator.getRollover', () => {
  describe('with payDay=1 (calendar behavior)', () => {
    it('should order budgets by calendar month', async () => {
      // Arrange: budgets for Dec 2024, Jan 2025
      // Act: getRollover for Jan with payDay=1
      // Assert: rollover comes from Dec
    });
  });

  describe('with payDay=27 (pay period behavior)', () => {
    it('should use Dec budget for dates Jan 1-26', async () => {
      // Arrange, Act, Assert
    });

    it('should use Jan budget for dates Jan 27+', async () => {
      // Arrange, Act, Assert
    });
  });

  describe('edge cases', () => {
    it('should handle payDay=31 in February (30 days month)', async () => {
      // payDay=31 should become payDay=28 or 29 for Feb
    });

    it('should handle year transition (Dec → Jan)', async () => {
      // Verify correct ordering across year boundary
    });

    it('should handle invalid payDay values', async () => {
      // payDay=-5 → 1, payDay=50 → 31
    });
  });
});
```

### Tests manuels

1. Créer un utilisateur avec payDay=27
2. Créer des budgets pour Décembre et Janvier
3. Ajouter des transactions :
   - Transaction le 15 déc → doit affecter budget Décembre
   - Transaction le 28 déc → doit affecter budget Janvier
4. Vérifier que le rollover de Janvier = ending_balance de Décembre

---

## Validation Checklist

- [ ] Migration SQL crée la fonction avec paramètre `p_pay_day_of_month`
- [ ] SQL gère les mois courts (payDay=31 en février)
- [ ] `budget.calculator.ts` passe payDayOfMonth au RPC
- [ ] `budget.service.ts` récupère et valide payDayOfMonth
- [ ] `budget.service.ts` cache payDayOfMonth (une requête auth par méthode max)
- [ ] Types Supabase régénérés (`bun run generate-types:local`)
- [ ] Tests unitaires passent
- [ ] Test manuel : rollover correct avec payDay=27
- [ ] Pas de régression avec payDay=1 (défaut)

---

## Rollout

### Backward Compatibility
- Le paramètre `p_pay_day_of_month` a une valeur par défaut (1)
- Les utilisateurs sans payDay configuré auront le comportement calendaire standard

### Migration
1. Déployer la migration SQL
2. Régénérer les types : `bun run generate-types:local`
3. Déployer le backend modifié
4. Aucun changement frontend nécessaire

---

## Notes de revue

### Sources consultées
- PostgreSQL Window Functions: https://www.postgresql.org/docs/current/functions-window.html
- PostgreSQL make_date edge cases: https://database.guide/how-make_date-works-in-postgresql/
- Supabase RPC: https://supabase.com/docs/reference/javascript/rpc

### Règles projet appliquées
- `.claude/rules/clean-code.md` : Fonctions ≤30 lignes, constantes explicites (DEFAULT_PAY_DAY, etc.)
- `.claude/rules/naming-conventions.md` : `getPayDayOfMonth()` (verbe + nom)
- `.claude/rules/testing/vitest.md` : Tests AAA, noms descriptifs, tests obligatoires
