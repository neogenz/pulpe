# Task: AllocatedTransactionFormDialog

## Problem

L'utilisateur n'a pas de formulaire pour créer ou éditer une transaction allouée. Il faut un dialog avec les champs nécessaires qui supporte les modes création et édition.

## Proposed Solution

Créer le composant `AllocatedTransactionFormDialog` avec un formulaire réactif Angular pour saisir montant, description, et date. Le dialog doit supporter deux modes: création (vide) et édition (pré-rempli).

## Dependencies

- Task 6: AllocatedTransactionsDialog (dialog parent existe)

## Context

- Pattern form dialog: `frontend/projects/webapp/src/app/feature/budget/budget-details/edit-budget-line/edit-budget-line-dialog.ts`
- Reactive Forms + Validators
- Interface data contient: budgetLineId, budgetId, kind, transaction? (optionnel pour mode édition)
- Champs cachés auto-remplis: budgetLineId, budgetId, kind

## Success Criteria

- Composant `AllocatedTransactionFormDialog` créé:
  - Interface data: `{ budgetLineId, budgetId, kind, transaction? }`
  - Champs formulaire:
    - amount: required, min(0.01)
    - name/description: required, minLength(1)
    - transactionDate: date picker, default aujourd'hui
  - Mode création: formulaire vide, date = aujourd'hui
  - Mode édition: formulaire pré-rempli avec transaction existante
  - Boutons: Annuler, Enregistrer
  - Return: TransactionCreate ou TransactionUpdate au submit
- Tests unitaires:
  - Validation formulaire (champs requis, montant min)
  - Mode création vs édition
  - Soumission valide retourne bon format
