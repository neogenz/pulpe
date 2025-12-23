# Task: Migration DB + Shared Schemas

## Problem

La table `transaction` n'a pas de colonne pour lier une transaction à une ligne budgétaire. Les schémas Zod partagés ne supportent pas le champ `budgetLineId`. Sans cette fondation, impossible d'implémenter les transactions allouées.

## Proposed Solution

Créer une migration Supabase pour ajouter la colonne `budget_line_id` nullable à la table `transaction`, puis mettre à jour les schémas Zod dans le package shared pour inclure ce nouveau champ.

## Dependencies

- Aucune (tâche fondatrice)

## Context

- Pattern migration: `backend-nest/supabase/migrations/20250828165030_add_ending_balance_to_monthly_budget.sql`
- Schémas transaction: `shared/schemas.ts:235-242` (transactionCreateSchema, transactionUpdateSchema)
- La colonne doit être nullable pour backward compatibility
- FK avec ON DELETE SET NULL (si BudgetLine supprimée, transaction devient libre)
- Index partiel pour performance des queries

## Success Criteria

- Migration SQL créée avec colonne `budget_line_id UUID NULL`
- Contrainte FK vers `budget_line(id)` avec ON DELETE SET NULL
- Index partiel sur `budget_line_id` WHERE NOT NULL
- `transactionSchema` inclut `budgetLineId: z.uuid().nullable()`
- `transactionCreateSchema` inclut `budgetLineId: z.uuid().nullable().optional()`
- `transactionUpdateSchema` inclut `budgetLineId: z.uuid().nullable().optional()`
- Types régénérés via `bun run generate-types:local`
- Build shared passe sans erreur
