# Task: Frontend Search Transactions Dialog Component

## Problem

Il n'existe pas de composant dialog pour effectuer une recherche de transactions. Il faut créer un dialog avec un champ de recherche qui déclenche une recherche API après 2+ caractères (debounced), affiche les résultats dans un tableau, et permet de sélectionner un résultat.

## Proposed Solution

Créer un composant standalone `SearchTransactionsDialogComponent` avec:
- Un champ de recherche Material avec icône et bouton clear
- Une logique de recherche debounced (300ms) avec minimum 2 caractères
- Un mat-table pour afficher les résultats avec colonnes: période (breadcrumb), nom, montant
- Des états: loading, résultats, vide
- La fermeture du dialog avec le résultat sélectionné

## Dependencies

- Task #3: Frontend API search method (pour appeler le backend)

## Context

- Fichier cible: `frontend/projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.ts` (nouveau)

**Patterns à suivre:**
- Dialog structure: voir `allocated-transactions-dialog.ts` (mat-table dans dialog)
- Form input: voir `add-transaction-bottom-sheet.ts` (mat-form-field avec réactive forms)
- Styling: Angular Material v20 + Tailwind CSS classes

**Template structure:**
1. `h2 mat-dialog-title` - "Rechercher une transaction"
2. `mat-dialog-content` - champ recherche + zone résultats
3. `mat-dialog-actions align="end"` - bouton Fermer

**Spécifications UI:**
- Breadcrumb période: format "2024 / Janvier" en `text-on-surface-variant`
- Montant aligné à droite, formaté CHF
- Rows cliquables avec hover effect
- Empty state centré avec icône et message

## Success Criteria

- Composant standalone avec OnPush change detection
- Champ de recherche avec icône prefix et bouton clear suffix
- Recherche déclenchée après 2+ caractères avec debounce 300ms
- Spinner affiché pendant le chargement
- Résultats affichés dans mat-table avec colonnes period/name/amount
- État vide "Aucun résultat trouvé" si recherche sans résultat
- Clic sur ligne ferme le dialog et retourne le `TransactionSearchResult`
- Tests unitaires passent
