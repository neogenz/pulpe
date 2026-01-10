# Task: Backend Search Implementation

## Problem

L'API ne dispose pas d'endpoint pour rechercher des transactions globalement. Il faut créer la logique de recherche dans le service et exposer un endpoint REST qui effectue une recherche textuelle sur les champs `name` et `category` de toutes les transactions de l'utilisateur.

## Proposed Solution

1. Créer les DTOs Swagger pour la documentation de l'API
2. Ajouter une méthode `search()` dans TransactionService qui effectue une requête Supabase avec jointure sur budgets et filtrage ILIKE
3. Ajouter un endpoint `GET /transactions/search?q=term` dans le controller

## Dependencies

- Task #1: TransactionSearchResult schema (pour typage des réponses)

## Context

- Fichiers cibles:
  - `backend-nest/src/modules/transaction/dto/search-transaction.dto.ts` (nouveau)
  - `backend-nest/src/modules/transaction/transaction.service.ts`
  - `backend-nest/src/modules/transaction/transaction.controller.ts`

**Patterns à suivre:**
- Service: voir `findByBudgetId()` pour le pattern de requête Supabase
- Controller: voir `@Get('budget/:budgetId')` pour le pattern d'endpoint
- DTOs: voir `transaction-swagger.dto.ts` pour le pattern Swagger

**Spécifications:**
- Minimum 2 caractères pour la recherche
- Filtrer sur `name` OR `category` avec ILIKE
- Jointure avec `budgets` pour récupérer le nom du budget
- Limiter à 50 résultats
- Trier par date décroissante
- Helper pour convertir month number en label français

## Success Criteria

- Endpoint `GET /v1/transactions/search?q=test` retourne 200 avec résultats
- Query < 2 chars retourne 400 Bad Request
- Résultats incluent tous les champs du schema (id, name, amount, kind, budgetId, budgetName, year, month, monthLabel)
- RLS respecté (seules les transactions de l'utilisateur sont retournées)
- Documentation Swagger générée
- Tests unitaires passent
