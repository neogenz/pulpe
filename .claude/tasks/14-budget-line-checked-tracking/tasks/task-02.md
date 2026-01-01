# Task: Shared Schema - Ajouter checkedAt au type BudgetLine

## Problem

Le type `BudgetLine` dans les schémas Zod partagés ne contient pas la propriété `checkedAt` nécessaire pour tracker la date de réalisation d'une ligne budgétaire. Le frontend et le backend doivent partager ce type.

## Proposed Solution

Ajouter la propriété `checkedAt` au `budgetLineSchema` dans le package shared. Cette propriété doit être nullable (null = non coché, datetime = date de coche).

## Dependencies

- Task #1: Migration DB (les types DB doivent exister)

## Context

- Fichier: `shared/schemas.ts:174-188` - `budgetLineSchema`
- Pattern existant: `createdAt: z.iso.datetime()`, `updatedAt: z.iso.datetime()`
- Ne PAS ajouter à `budgetLineCreateSchema` (création = jamais coché)
- Ne PAS ajouter à `budgetLineUpdateSchema` (endpoint dédié `/check`)

## Success Criteria

- `budgetLineSchema` contient `checkedAt: z.iso.datetime().nullable()`
- Type `BudgetLine` inféré inclut `checkedAt: string | null`
- Build shared réussit (`pnpm build:shared`)
- Aucune régression sur les schémas existants
