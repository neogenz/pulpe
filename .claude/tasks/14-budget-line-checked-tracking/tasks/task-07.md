# Task: Budget-table UI - Affichage solde réalisé

## Problem

Le composant budget-table n'affiche pas le solde réalisé. Les utilisateurs ne peuvent pas voir leur situation financière réelle basée sur les lignes cochées, distincte du solde prévisionnel.

## Proposed Solution

Ajouter une section dédiée sous le tableau pour afficher le solde réalisé, clairement distingué du solde prévisionnel existant.

## Dependencies

- Task #5: Frontend Data Layer (calculator avec calculateRealizedBalance)
- Task #6: Budget-table Checkbox (pour que le solde ait du sens)

## Context

- Composant: `frontend/.../budget-table/budget-table.ts`
- Calculator: `BudgetCalculator.calculateRealizedBalance`
- Position: Nouvelle ligne sous le tableau (décision utilisateur)
- Pattern computed signal: voir `budgetTableData` (lignes 727-735)
- Formule: `Σ(revenus cochés) - Σ(dépenses cochées) - Σ(épargnes cochées)`

## Success Criteria

- Computed signal `realizedBalance` créé
- Section visuellement distincte sous le tableau
- Label clair "Solde réalisé:" ou équivalent
- Montant formaté en CHF (ou devise du budget)
- Mise à jour réactive quand lignes cochées/décochées
- Styling différent du solde prévisionnel (couleur/style distinct)
