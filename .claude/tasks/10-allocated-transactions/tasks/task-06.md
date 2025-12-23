# Task: AllocatedTransactionsDialog (Affichage)

## Problem

L'utilisateur n'a pas de moyen de voir les transactions allouées à une ligne budgétaire spécifique. Il faut un dialog qui affiche la liste des transactions avec les montants consommés/restants.

## Proposed Solution

Créer le composant `AllocatedTransactionsDialog` qui affiche la liste des transactions allouées, les montants, et intégrer un bouton "Voir les transactions" dans le menu de budget-table.

## Dependencies

- Task 5: Frontend API Service + Store (données disponibles)

## Context

- Pattern dialog: `frontend/projects/webapp/src/app/feature/budget/budget-details/edit-budget-line/edit-budget-line-dialog.ts`
- Budget table: `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`
- MatMenu mobile avec 3-dot pattern
- Vocabulaire UI: "X CHF prévus · Y CHF dépensés · Z CHF restants"

## Success Criteria

- Composant `AllocatedTransactionsDialog` créé:
  - Header avec nom de la BudgetLine
  - Affichage montants: prévu/dépensé/restant
  - Liste transactions (date, description, montant) triées DESC
  - Message "Aucune transaction enregistrée" si liste vide
  - Bouton "Ajouter" (désactivé/placeholder pour Task 7)
  - Actions éditer/supprimer (désactivées/placeholder pour Task 8)
  - Bouton Fermer
- Intégration budget-table:
  - Entrée "Voir les transactions" dans MatMenu mobile
  - Bouton/icône équivalent desktop
  - Ouvre dialog avec données de la ligne
- Chips info dans colonne montant: "X CHF dépensés · Y CHF restants"
- Tests unitaires dialog:
  - Affichage liste
  - Message vide
  - Calculs corrects
  - Tri DESC
