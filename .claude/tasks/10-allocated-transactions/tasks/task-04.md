# Task: API Endpoints Enrichis

## Problem

L'API ne retourne pas les données de consommation par BudgetLine. Le frontend a besoin d'endpoints qui retournent les BudgetLines enrichies avec consumedAmount, remainingAmount, et allocatedTransactions.

## Proposed Solution

Créer le DTO `BudgetLineWithTransactionsDto`, ajouter l'endpoint `GET /budget-lines/:id/transactions`, et enrichir/créer l'endpoint `GET /budgets/:id/lines` pour retourner les données complètes.

## Dependencies

- Task 2: Validation Backend (validation transaction allouée implémentée)
- Task 3: Calculs Métier BudgetLine (méthodes de calcul disponibles)

## Context

- Pattern DTO: `backend-nest/src/modules/budget-line/dto/`
- Pattern controller: `backend-nest/src/modules/budget-line/budget-line.controller.ts`
- Budget controller: `backend-nest/src/modules/budget/budget.controller.ts`
- Pattern response: `{ success: true, data: ... }`
- Swagger decorators: @ApiOperation, @ApiResponse

## Success Criteria

- DTO `BudgetLineWithTransactionsDto` créé avec:
  - budgetLine, consumedAmount, remainingAmount, allocatedTransactions
- Endpoint `GET /budget-lines/:id/transactions`:
  - Retourne transactions allouées triées par date DESC
  - Documenté Swagger
- Endpoint `GET /budgets/:id/lines`:
  - Retourne `BudgetLineWithTransactionsDto[]`
  - Chaque ligne enrichie avec calculs et transactions
  - Documenté Swagger
- Méthode `getBudgetLinesWithTransactions()` dans BudgetService
- Tests d'intégration:
  - GET /budgets/:id/lines retourne données enrichies
  - GET /budget-lines/:id/transactions retourne transactions triées
