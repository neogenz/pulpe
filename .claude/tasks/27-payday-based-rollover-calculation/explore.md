# Task: Modifier le calcul du rollover pour qu'il soit basé sur le payDayOfMonth

## Résumé

Le rollover est actuellement calculé par ordre calendaire (`ORDER BY year, month`). Il faut modifier le calcul pour qu'il suive les "périodes de paie" basées sur `payDayOfMonth`.

**Comportement actuel :**
- Rollover flow: Jan → Feb → Mar (calendaire)
- `payDayOfMonth` n'affecte que l'affichage

**Comportement souhaité :**
- Avec payDay=27, le budget "Décembre" (27 déc → 26 jan) → budget "Janvier" (27 jan → 26 fév)
- Le rollover suit la chaîne des périodes de paie

---

## Codebase Context

### Fichiers Clés

| Fichier | Ligne | Rôle |
|---------|-------|------|
| `backend-nest/supabase/migrations/20250905053019_fix_rollover_function_schema.sql` | 4-60 | **CRITIQUE** - Fonction SQL RPC `get_budget_with_rollover` |
| `backend-nest/src/modules/budget/budget.calculator.ts` | 71-98 | Appel RPC depuis le backend |
| `backend-nest/src/modules/user/user.controller.ts` | 261-349 | API pour `payDayOfMonth` (stocké dans user_metadata) |
| `shared/src/calculators/budget-period.ts` | 56-84 | Logique TypeScript pour calculer la période budgétaire |
| `shared/src/calculators/budget-period.spec.ts` | 1-268 | Tests complets de la logique de période |

### Fonction SQL Actuelle (à modifier)

```sql
-- backend-nest/supabase/migrations/20250905053019_fix_rollover_function_schema.sql:23-34
LAG(mb.id) OVER (
  PARTITION BY mb.user_id
  ORDER BY mb.year, mb.month  -- ← Ordre CALENDAIRE, pas basé sur payDay
) as previous_budget_id,

SUM(COALESCE(mb.ending_balance, 0)) OVER (
  PARTITION BY mb.user_id
  ORDER BY mb.year, mb.month  -- ← Même problème ici
  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
) as rollover,
```

### Logique de Période Existante (TypeScript)

```typescript
// shared/src/calculators/budget-period.ts:72-83
if (dayOfMonth >= validPayDay) {
  return { month: calendarMonth, year: calendarYear };
}
// Sinon on est dans le budget du mois précédent
if (calendarMonth === 1) {
  return { month: 12, year: calendarYear - 1 };
}
return { month: calendarMonth - 1, year: calendarYear };
```

Cette logique doit être **répliquée en SQL** pour ordonner les budgets.

### Accès à payDayOfMonth

Le `payDayOfMonth` est stocké dans `auth.users.raw_user_meta_data` (JSONB):

```typescript
// backend-nest/src/modules/user/user.controller.ts:277-278
const payDayOfMonth = currentUserData.user.user_metadata?.payDayOfMonth ?? null;
```

**Options pour y accéder dans la fonction RPC :**
1. Passer en paramètre (recommandé) : `get_budget_with_rollover(p_budget_id, p_pay_day_of_month)`
2. Utiliser `auth.uid()` avec `SECURITY DEFINER` pour lire `auth.users`
3. Créer une table `user_settings` dans le schema `public`

---

## Documentation Insights

### Supabase RPC avec Plusieurs Paramètres

```typescript
// Appel TypeScript
const { data } = await supabase.rpc('get_budget_with_rollover', {
  p_budget_id: budgetId,
  p_pay_day_of_month: 27
});

// Définition SQL
CREATE OR REPLACE FUNCTION get_budget_with_rollover(
  p_budget_id UUID,
  p_pay_day_of_month INT DEFAULT 15
)
```

### Calcul du "Pay Period" en SQL

```sql
-- Calculer la date de début de période de paie
CASE
  WHEN EXTRACT(DAY FROM mb.created_at) >= p_pay_day_of_month
  THEN MAKE_DATE(
    EXTRACT(YEAR FROM mb.created_at)::INT,
    EXTRACT(MONTH FROM mb.created_at)::INT,
    LEAST(p_pay_day_of_month, 28)
  )
  ELSE MAKE_DATE(
    EXTRACT(YEAR FROM mb.created_at)::INT,
    EXTRACT(MONTH FROM mb.created_at)::INT - 1,
    LEAST(p_pay_day_of_month, 28)
  )
END AS pay_period_sort
```

**Attention :** Les budgets utilisent `month` et `year` (colonnes INT), pas `created_at`. Il faudra adapter.

---

## Research Findings

### Approche Recommandée par l'Industrie

Les apps financières (YNAB, Monarch Money, PocketSmith) :
1. **Calculent les périodes à la volée** (pas de pré-génération)
2. **Stockent payDay sur l'utilisateur** (single source of truth)
3. **Rollover séquentiel** : variance du mois N → budget du mois N+1

### Pattern SQL pour Tri Personnalisé

```sql
-- Créer un champ de tri basé sur la "période effective"
WITH budgets_with_ordering AS (
  SELECT
    mb.id,
    mb.user_id,
    mb.year,
    mb.month,
    -- Période effective basée sur payDay
    CASE
      WHEN 15 >= p_pay_day_of_month  -- jour "milieu" du mois comme proxy
      THEN MAKE_DATE(mb.year, mb.month, p_pay_day_of_month)
      ELSE MAKE_DATE(mb.year, mb.month - 1, p_pay_day_of_month)
    END AS pay_period_start
  FROM monthly_budget mb
)
SELECT * FROM budgets_with_ordering
ORDER BY pay_period_start;
```

**Problème identifié :** Les budgets n'ont pas de `created_at` ni de référence à un jour spécifique. Ils ont juste `month` et `year`.

**Solution proposée :** Considérer que le budget de (month=1, year=2025) représente la période "Janvier" qui commence le payDay de janvier.

---

## Patterns à Suivre

### 1. RPC Response Validation (Zod)

```typescript
// backend-nest/src/modules/budget/schemas/rpc-responses.schema.ts:27-32
const budgetWithRolloverResponseSchema = z.object({
  ending_balance: z.number(),
  rollover: z.number(),
  available_to_spend: z.number(),
  previous_budget_id: z.string().uuid().nullable(),
});
```

### 2. Tests Complets avec Edge Cases

```typescript
// shared/src/calculators/budget-period.spec.ts - Pattern à répliquer
describe('getBudgetPeriodForDate', () => {
  it('affiche janvier quand on est le 30 janvier avec jour de paie au 27', () => {
    const result = getBudgetPeriodForDate(new Date('2025-01-30'), 27);
    expect(result).toEqual({ month: 1, year: 2025 });
  });

  it('affiche décembre quand on est le 26 janvier avec jour de paie au 27', () => {
    const result = getBudgetPeriodForDate(new Date('2025-01-26'), 27);
    expect(result).toEqual({ month: 12, year: 2024 });
  });
});
```

---

## Dependencies

### Tables Impliquées
- `monthly_budget` : `id`, `user_id`, `month`, `year`, `ending_balance`
- `auth.users` : `raw_user_meta_data->>'payDayOfMonth'`

### Services à Modifier
- `BudgetCalculator.getRollover()` - ajouter paramètre `payDayOfMonth`
- `BudgetService` - passer `payDayOfMonth` au calculator

### Frontend (pas de changement requis)
- Le frontend utilise déjà `payDayOfMonth` pour l'affichage via `currentBudgetPeriod`
- Le rollover sera automatiquement correct une fois le backend modifié

---

## Questions Ouvertes

1. **Rétroactivité ?** Si l'utilisateur change payDay, faut-il recalculer les anciens rollovers ?
   - Recommandation : Non, le calcul est à la volée (window function)

2. **Budgets sans `created_at`** : Comment déterminer l'ordre pour un budget (month=1, year=2025) ?
   - Solution : Utiliser directement `month` et `year` avec la formule de décalage

3. **Migration SQL** : Créer nouvelle migration ou modifier l'existante ?
   - Recommandation : Nouvelle migration qui DROP et recrée la fonction

---

## Prochaines Étapes

1. **Créer la migration SQL** : Nouvelle fonction `get_budget_with_rollover(UUID, INT)`
2. **Modifier BudgetCalculator** : Passer `payDayOfMonth` au RPC
3. **Modifier BudgetService** : Récupérer `payDayOfMonth` depuis user_metadata
4. **Ajouter tests** : Tests unitaires pour la nouvelle logique SQL
5. **Tester E2E** : Vérifier que le rollover suit les périodes de paie

Exécuter : `/epct:plan .claude/tasks/27-payday-based-rollover-calculation` pour créer le plan d'implémentation.
