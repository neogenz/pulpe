# Task: CRUD Actions + Store Optimistic Updates

## Problem

Les actions créer/éditer/supprimer dans AllocatedTransactionsDialog ne sont pas connectées. Le store n'a pas de méthodes pour gérer les mutations de transactions allouées avec optimistic updates.

## Proposed Solution

Activer les actions dans AllocatedTransactionsDialog, implémenter les méthodes CRUD dans budget-details-store avec optimistic updates, et ajouter les snackbars de feedback.

## Dependencies

- Task 7: AllocatedTransactionFormDialog (formulaire existe)

## Context

- Store: `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
- Pattern optimistic: update signal → API call → confirm ou revert
- ConfirmationDialog: `frontend/projects/webapp/src/app/ui/dialogs/confirmation-dialog.ts`
- MatSnackBar pattern dans le codebase
- Transaction API: vérifier existence méthodes CRUD

## Success Criteria

- AllocatedTransactionsDialog actions activées:
  - Bouton "Ajouter" → ouvre AllocatedTransactionFormDialog mode création
  - Icône éditer → ouvre AllocatedTransactionFormDialog mode édition
  - Icône supprimer → ouvre ConfirmationDialog
- Store méthodes CRUD:
  - `createAllocatedTransaction()`: optimistic add → API → confirm/revert
  - `updateAllocatedTransaction()`: optimistic update → API → confirm/revert
  - `deleteAllocatedTransaction()`: optimistic remove → API → confirm/revert
  - Recalcul montants après chaque mutation
- Snackbars:
  - "Transaction enregistrée" après création/modification
  - "Transaction supprimée" après suppression
  - Message erreur si API échoue
- Tests unitaires store:
  - CRUD optimistic + success
  - CRUD error + rollback
