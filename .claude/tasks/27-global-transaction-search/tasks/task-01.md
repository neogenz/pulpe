# Task: Add TransactionSearchResult Schema

## Problem

Le backend et le frontend doivent partager un contrat de données pour les résultats de recherche de transactions. Ce schéma doit inclure les informations de la transaction ainsi que le contexte du budget (nom, année, mois) pour permettre l'affichage du breadcrumb.

## Proposed Solution

Ajouter un nouveau schéma Zod `transactionSearchResultSchema` dans le package shared qui définit la structure des résultats de recherche avec tous les champs nécessaires : données transaction + métadonnées budget + labels formatés.

## Dependencies

- Aucune (tâche fondation)

## Context

- Fichier cible: `shared/schemas.ts`
- Position: après `transactionUpdateSchema` (~ligne 269)
- Pattern existant: suivre la structure de `transactionSchema` et des response schemas

**Champs requis:**
- Transaction: id, name, amount, kind, transactionDate, category
- Budget context: budgetId, budgetName
- Display helpers: year (number), month (1-12), monthLabel ("Janvier", etc.)

## Success Criteria

- Schema `transactionSearchResultSchema` exporté
- Type `TransactionSearchResult` exporté
- Schema `transactionSearchResultListSchema` (array) exporté
- Schema `transactionSearchResponseSchema` avec structure `{ success, data }` exporté
- Type `TransactionSearchResponse` exporté
- Build shared réussit (`pnpm build:shared`)
