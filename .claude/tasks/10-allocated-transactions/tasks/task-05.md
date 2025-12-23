# Task: Frontend API Service + Store

## Problem

Le frontend n'a pas de service API pour récupérer les BudgetLines enrichies, ni de type TypeScript pour `BudgetLineWithTransactions`. Le store doit être mis à jour pour consommer ces nouvelles données.

## Proposed Solution

Ajouter le type `BudgetLineWithTransactions` dans shared, créer/mettre à jour le service API budget-line, et modifier le store budget-details pour utiliser l'endpoint enrichi.

## Dependencies

- Task 4: API Endpoints Enrichis (backend prêt)

## Context

- Pattern API service: `frontend/projects/webapp/src/app/data/budget-api.ts`
- Store: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
- Pattern resource(): voir usage dans le store existant
- Schémas: `shared/schemas.ts`

## Success Criteria

- Type `BudgetLineWithTransactions` ajouté dans shared/schemas.ts:
  - budgetLine: BudgetLine
  - consumedAmount: number
  - remainingAmount: number
  - allocatedTransactions: Transaction[]
- Service API (budget-line-api.ts ou équivalent):
  - `getBudgetLinesWithTransactions$(budgetId)`: Observable<BudgetLineWithTransactions[]>
  - `getAllocatedTransactions$(budgetLineId)`: Observable<Transaction[]>
- Store budget-details:
  - Type budgetLines mis à jour
  - Resource utilise nouvel endpoint enrichi
  - Computed exposé pour accès aux données par ligne
- Build frontend passe sans erreur
