# Task: Migration DB - Ajouter colonne checked_at

## Problem

La table `budget_line` ne possède pas de colonne pour enregistrer quand une ligne budgétaire a été marquée comme "réalisée". Cette information est nécessaire pour permettre aux utilisateurs de cocher leurs lignes budgétaires et voir la date de réalisation.

## Proposed Solution

Créer une migration Supabase qui ajoute la colonne `checked_at` de type `timestamp with time zone` nullable à la table `budget_line`. Ensuite, regénérer les types TypeScript automatiquement.

## Dependencies

- Aucune (tâche de base)

## Context

- Table existante: `backend-nest/schema.sql:313-326`
- Pattern migrations: `backend-nest/supabase/migrations/`
- Dernière migration: `20251223121017_add_allocated_transactions.sql`
- Commande regenerate types: `bun run generate-types:local` dans `backend-nest/`

## Success Criteria

- Migration SQL créée avec naming convention `YYYYMMDDHHMMSS_add_checked_at_to_budget_line.sql`
- Migration appliquée localement sans erreur
- `backend-nest/src/types/database.types.ts` contient `checked_at: string | null` dans les types Row, Insert, Update de `budget_line`
- `backend-nest/schema.sql` reflète la nouvelle colonne (après db pull ou sync)
