# Implementation Plan: Dual Font Strategy (Option B)

## Overview

Remplacer Poppins par Plus Jakarta Sans pour tout le texte UI, et utiliser JetBrains Mono pour les montants financiers.

**Stratégie:**
1. Charger les deux fonts via Google Fonts
2. Configurer Plus Jakarta Sans comme font principale (Material + Tailwind)
3. Ajouter la classe `font-mono` aux éléments affichant des montants
4. Nettoyer les fonts inutilisées (Roboto)

## Dependencies

Ordre d'exécution obligatoire:
1. `index.html` (fonts chargées) → doit être fait en premier
2. `_variables.scss` (variables SCSS) → utilisé par styles.scss
3. `styles.scss` (Material theme) → dépend de _variables
4. `_tailwind.css` (utilities CSS) → peut être fait en parallèle avec 2-3
5. Composants (utilisent les classes) → doit être fait en dernier

---

## File Changes

### `projects/webapp/src/index.html`

**Action principale:** Remplacer Poppins par Plus Jakarta Sans + ajouter JetBrains Mono

- Ligne 12-14: Remplacer l'URL Google Fonts
  - Ancien: `family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500`
  - Nouveau: `family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500`
- Ligne 27: Même modification dans le bloc `<noscript>`
- Note: Supprimer Roboto (non utilisé), garder seulement les poids nécessaires
- Note: JetBrains Mono 400+500 suffisent pour les montants

---

### `projects/webapp/src/_variables.scss`

**Action principale:** Changer la font family principale

- Ligne 1: `$heading-font-family: 'Plus Jakarta Sans', sans-serif;`
- Ligne 2: `$regular-font-family: 'Plus Jakarta Sans', sans-serif;`

---

### `projects/webapp/src/styles.scss`

**Action principale:** Mettre à jour le fallback dans body

- Ligne 44: Remplacer `Poppins` par `'Plus Jakarta Sans'` dans le fallback font-family

---

### `projects/webapp/src/app/styles/vendors/_tailwind.css`

**Action principale:** Aucun changement requis

- Les lignes 209-213 restent inchangées car elles référencent `--mat-sys-body-large-font` qui sera automatiquement Plus Jakarta Sans via la cascade Material
- `--font-mono` est déjà configuré avec JetBrains Mono

---

## Composants à Modifier (Ajout de `font-mono`)

Les composants ci-dessous affichent des montants et doivent recevoir la classe `font-mono` sur les éléments contenant des valeurs numériques formatées.

### `projects/webapp/src/app/ui/financial-summary/financial-summary.ts`

- Localiser l'élément affichant le montant (ligne ~44 avec CurrencyPipe)
- Ajouter `font-mono` à la classe de l'élément contenant `{{ ... | currency }}`

### `projects/webapp/src/app/feature/current-month/components/financial-entry.ts`

- Localiser l'élément affichant le montant (ligne ~100 avec DecimalPipe)
- Ajouter `font-mono` à la classe de l'élément `<span>` contenant le montant

### `projects/webapp/src/app/feature/budget/budget-details/budget-financial-overview.ts`

- 4 montants à traiter (lignes ~41, 56, 71, 98)
- Ajouter `font-mono` aux éléments contenant `{{ totals().income | number }}`, etc.

### `projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`

- Localiser les cellules de montants (lignes ~169-172)
- Ajouter `font-mono` aux éléments `<td>` ou `<span>` contenant les montants

### `projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-mobile-card.ts`

- Localiser les éléments affichant des montants
- Ajouter `font-mono` aux spans de montants

### `projects/webapp/src/app/feature/budget/ui/month-card-item.ts`

- Localiser les montants affichés dans la card
- Ajouter `font-mono` aux éléments de montants

### `projects/webapp/src/app/feature/current-month/components/financial-accordion.ts`

- Localiser les montants dans l'accordion
- Ajouter `font-mono` aux éléments de totaux

### `projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.ts`

- Localiser les montants dans les résultats de recherche
- Ajouter `font-mono` aux cellules de montants

### `projects/webapp/src/app/feature/budget/budget-list/create-budget/template-details-dialog.ts`

- Localiser les montants affichés dans le dialog
- Ajouter `font-mono` si des montants sont visibles

### `projects/webapp/src/app/feature/budget/budget-list/create-budget/ui/template-list-item.ts`

- Localiser les montants dans chaque item
- Ajouter `font-mono` aux spans de montants

### `projects/webapp/src/app/feature/budget/budget-details/allocated-transactions-dialog/allocated-transactions-dialog.ts`

- Localiser les montants des transactions allouées
- Ajouter `font-mono` aux cellules de montants

### `projects/webapp/src/app/feature/budget/budget-details/allocated-transactions-dialog/allocated-transactions-bottom-sheet.ts`

- Même traitement que le dialog
- Ajouter `font-mono` aux montants

### `projects/webapp/src/app/feature/budget-templates/details/components/transactions-table.ts`

- Localiser les colonnes de montants dans le tableau
- Ajouter `font-mono` aux cellules de montants

### `projects/webapp/src/app/feature/budget-templates/details/components/edit-transactions-dialog.ts`

- Localiser les champs de montants
- Ajouter `font-mono` si des montants sont affichés (pas les inputs)

### `projects/webapp/src/app/ui/realized-balance-progress-bar/realized-balance-progress-bar.ts`

- Localiser les montants affichés dans la progress bar
- Ajouter `font-mono` aux labels de montants

### `projects/webapp/src/app/ui/calendar/month-tile.ts`

- Localiser les montants dans la tuile calendrier
- Ajouter `font-mono` aux montants affichés

### `projects/webapp/src/app/feature/current-month/components/budget-progress-bar.ts`

- Localiser les montants dans la barre de progression
- Ajouter `font-mono` aux labels numériques

---

## Testing Strategy

### Tests visuels manuels
1. Vérifier que Plus Jakarta Sans charge correctement (DevTools > Network > Fonts)
2. Vérifier que JetBrains Mono charge correctement
3. Vérifier l'apparence sur les pages principales:
   - Dashboard / Current Month
   - Budget Details
   - Budget List
4. Vérifier en mode sombre (dark theme)
5. Vérifier sur mobile (responsive)

### Pas de tests unitaires requis
- Les changements sont purement CSS/styling
- Aucun changement de logique métier

---

## Documentation

Aucune documentation à mettre à jour - changement purement visuel.

---

## Rollout Considerations

### Risques
- **FOUT (Flash of Unstyled Text)**: Déjà mitigé par le pattern `media="print" onload="this.media='all'"` existant
- **Performance**: +1 font à charger (~50KB pour JetBrains Mono 400+500), impact mineur

### Rollback
- Simple: revenir aux imports Poppins dans index.html et _variables.scss
- Les classes `font-mono` peuvent rester (inoffensives avec Poppins)

---

## Summary

| Phase | Fichiers | Effort estimé |
|-------|----------|---------------|
| 1. Fonts | index.html, _variables.scss, styles.scss | 10 min |
| 2. Composants | ~17 fichiers (ajout classe) | 30 min |
| 3. Tests | Vérification visuelle | 15 min |

**Total estimé: ~1 heure**
