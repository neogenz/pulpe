# Task: Validation Backend Transaction Allouée

## Problem

Le backend n'a pas de logique pour valider qu'une transaction allouée appartient au même budget et a le même kind que sa BudgetLine. Sans validation, des incohérences de données sont possibles.

## Proposed Solution

Ajouter les définitions d'erreurs métier, implémenter la validation dans TransactionService.create(), mettre à jour les mappers pour gérer `budgetLineId`, et écrire les tests unitaires.

## Dependencies

- Task 1: Migration DB + Shared Schemas (colonne `budget_line_id` doit exister)

## Context

- Pattern validation: `backend-nest/src/modules/transaction/transaction.service.ts:69-112` (validateCreateTransactionDto)
- Pattern erreurs: `backend-nest/src/common/constants/error-definitions.ts` (section TRANSACTION)
- Pattern mappers: `backend-nest/src/modules/transaction/transaction.mappers.ts`
- Injection BudgetLineService nécessaire pour récupérer la BudgetLine

## Success Criteria

- Nouvelles erreurs dans error-definitions.ts:
  - `TRANSACTION_BUDGET_LINE_BUDGET_MISMATCH`
  - `TRANSACTION_BUDGET_LINE_KIND_MISMATCH`
  - `BUDGET_LINE_NOT_FOUND`
- Validation dans TransactionService:
  - Si `budgetLineId` fourni, vérifier existence de la BudgetLine
  - Vérifier `budgetLine.budgetId === dto.budgetId`
  - Vérifier `budgetLine.kind === dto.kind`
- Mappers mis à jour pour `budget_line_id`
- Tests unitaires couvrant:
  - Transaction allouée valide → succès
  - BudgetLine d'un autre budget → erreur BUDGET_MISMATCH
  - Kind différent → erreur KIND_MISMATCH
  - Transaction libre (sans budgetLineId) → succès
  - BudgetLine inexistante → erreur NOT_FOUND
