# Task: Frontend Budget List Page Integration

## Problem

La page liste des budgets ne dispose pas d'accès à la recherche de transactions. Il faut ajouter un bouton recherche dans le header qui ouvre le dialog de recherche, et gérer la navigation vers le budget sélectionné après fermeture du dialog.

## Proposed Solution

1. Ajouter un bouton icône `search` dans le header de `budget-list-page.ts`
2. Créer une méthode `openSearchDialog()` qui ouvre le dialog
3. Gérer le résultat du dialog pour naviguer vers le budget concerné avec les paramètres année/mois

## Dependencies

- Task #4: SearchTransactionsDialog component (pour l'import et l'ouverture)

## Context

- Fichier cible: `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`
- Position template: ligne ~80, avant le bouton "Ajouter un budget"
- Position méthode: après `openCreateBudgetDialog()`

**Pattern existant pour les boutons header (lignes 58-80):**
```html
<button
  matIconButton
  (click)="onExportBudgets()"
  matTooltip="Exporter tous les budgets en JSON"
  aria-label="Exporter"
  data-testid="export-budgets-btn"
>
  <mat-icon>download</mat-icon>
</button>
```

**Pattern existant pour ouverture de dialog:**
Voir `openCreateBudgetDialog()` pour la configuration responsive et la gestion du résultat

**Navigation après sélection:**
- Router.navigate vers `/budget/${result.budgetId}`
- Avec queryParams `{ month: result.month, year: result.year }` si applicable

## Success Criteria

- Bouton recherche visible dans le header (icône loupe)
- Tooltip "Rechercher dans les transactions"
- aria-label pour accessibilité
- data-testid="search-transactions-btn"
- Clic ouvre le SearchTransactionsDialog
- Sélection d'un résultat navigue vers le budget correspondant
- Tests unitaires passent
