# Task: Ajouter le champ checked_at en base de données

## Problem
Les lignes budgétaires n'ont actuellement aucun moyen de marquer qu'elles ont été réalisées. Il faut ajouter un champ `checked_at` (timestamp nullable) pour stocker la date de coche.

## Proposed Solution
Créer une migration Supabase qui ajoute la colonne `checked_at` à la table `budget_line`. Mettre à jour les types TypeScript générés et les schémas Zod partagés.

## Dependencies
- None (fondation pour toutes les autres tâches)

## Context

### Migrations Supabase
- **Location**: `backend-nest/supabase/migrations/`
- **Naming**: `YYYYMMDDHHMMSS_descriptive_name.sql`
- **Exemple existant**: `20250828165030_add_ending_balance_to_monthly_budget.sql`

### Table budget_line actuelle
```sql
CREATE TABLE "public"."budget_line" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "budget_id" uuid NOT NULL,
    "template_line_id" uuid,
    "savings_goal_id" uuid,
    "name" text NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "kind" public.transaction_kind NOT NULL,
    "recurrence" public.transaction_recurrence NOT NULL,
    "is_manually_adjusted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

### Fichiers à modifier

1. **Migration SQL** (NOUVEAU):
   - `backend-nest/supabase/migrations/YYYYMMDDHHMMSS_add_checked_at_to_budget_line.sql`

2. **Types DB** (auto-généré):
   - `backend-nest/src/types/database.types.ts`
   - Commande: `cd backend-nest && bun run generate-types:local`

3. **Schémas Zod** (`shared/schemas.ts`):
   - Ligne ~187: Ajouter `checkedAt: z.iso.datetime().nullable()` à `budgetLineSchema`
   - Ligne ~199: Ajouter `checkedAt: z.iso.datetime().nullable().optional()` à `budgetLineCreateSchema`

4. **Mapper backend** (`backend-nest/src/modules/budget-line/budget-line.mappers.ts`):
   - Ligne ~29: Ajouter `checkedAt: budgetLineDb.checked_at` dans `toApi()`
   - Ligne ~107: Gérer dans `toUpdate()` si nécessaire

### Pattern de migration
```sql
ALTER TABLE public.budget_line
ADD COLUMN checked_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.budget_line.checked_at IS
'Timestamp when the budget line was marked as completed by the user. NULL means not yet completed.';
```

## Success Criteria
- [ ] Migration SQL appliquée sans erreur
- [ ] Colonne `checked_at: timestamp | null` présente en DB
- [ ] Types TypeScript régénérés avec `checked_at: string | null`
- [ ] Schéma Zod `budgetLineSchema` mis à jour avec `checkedAt`
- [ ] Mapper `toApi()` retourne le champ `checkedAt`
- [ ] `pnpm quality` passe
