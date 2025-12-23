# Task: Calculs Métier BudgetLine

## Problem

Pas de méthodes pour calculer le montant consommé et restant d'une BudgetLine, ni pour récupérer la liste des transactions allouées. Ces calculs sont nécessaires pour l'API enrichie et l'affichage frontend.

## Proposed Solution

Ajouter trois méthodes dans BudgetLineService: `getConsumedAmount()`, `getRemainingAmount()`, et `getAllocatedTransactions()`. Écrire les tests unitaires correspondants.

## Dependencies

- Task 1: Migration DB + Shared Schemas (colonne `budget_line_id` doit exister)

## Context

- Service: `backend-nest/src/modules/budget-line/budget-line.service.ts`
- Pattern query Supabase: voir méthodes existantes dans le service
- Mapper transactions: `transactionMappers.toApiList()`
- Note: Pas de modification dans BudgetService - calcul global `remaining` fonctionne déjà via BudgetCalculator

## Success Criteria

- Méthode `getConsumedAmount(budgetLineId, supabase)`:
  - Query: SUM(amount) WHERE budget_line_id = ?
  - Retourne 0 si aucune transaction
- Méthode `getRemainingAmount(budgetLineId, supabase)`:
  - Calcule: budgetLine.amount - consumedAmount
- Méthode `getAllocatedTransactions(budgetLineId, supabase)`:
  - Query: SELECT * WHERE budget_line_id = ? ORDER BY transaction_date DESC
  - Retourne tableau de Transaction mappées
- Tests unitaires couvrant:
  - Somme correcte avec plusieurs transactions
  - Retour 0 sans transactions
  - Calcul remaining correct
  - Tri par date DESC
