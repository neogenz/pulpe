# Task: Appliquer le style visuel des lignes cochées

## Problem
Les lignes cochées doivent être visuellement distinctes pour identifier rapidement ce qui est réalisé.

## Proposed Solution
Appliquer aux lignes cochées:
- `text-decoration: line-through`
- `opacity: 0.6`
- Afficher la date de coche au format `MM.DD`

## Dependencies
- Task #3: La checkbox et l'état coché doivent exister dans l'UI

## Context

### Patterns de style existants

**Opacité conditionnelle (loading state)**
```typescript
// budget-table.ts lignes 602-603
[class.opacity-50]="row.metadata.isLoading"
[class.pointer-events-none]="row.metadata.isLoading"
```

**Italique pour rollovers**
```typescript
// budget-table.ts ligne 374
[class.italic]="line.metadata.isRollover"

// financial-entry.ts ligne 91
[class.italic]="isRollover()"
```

**Classes Tailwind disponibles**
- `opacity-50`, `opacity-60`, `opacity-70`
- `line-through` (text-decoration)
- `text-on-surface-variant` (gris atténué)

### Format de date

**Pattern existant**
```html
<!-- financial-entry.ts ligne 88 -->
{{ data().createdAt | date: 'dd.MM.yyyy' : '' : 'fr-CH' }}
```

**Format demandé: MM.DD**
```html
{{ data().checkedAt | date: 'MM.dd' : '' : 'fr-CH' }}
```

### Application du style

**Budget Table - Style ligne**
```html
<tr
  [class.line-through]="row.data.checkedAt"
  [class.opacity-60]="row.data.checkedAt"
>
```

**Financial Entry - Style item**
```html
<mat-list-item
  [class.line-through]="data().checkedAt"
  [class.opacity-60]="data().checkedAt"
>
```

### Affichage de la date

**Placement suggéré**: Près du nom ou dans une colonne dédiée
```html
@if (line.data.checkedAt) {
  <span class="text-body-small text-on-surface-variant ml-2">
    {{ line.data.checkedAt | date: 'MM.dd' : '' : 'fr-CH' }}
  </span>
}
```

### Fichiers à modifier

1. **budget-table.ts**:
   - Ajouter classes conditionnelles sur `<tr>` et cellules texte
   - Afficher la date de coche

2. **budget-table-mobile-card.ts**:
   - Appliquer même style sur la card
   - Afficher la date de coche

3. **financial-entry.ts**:
   - Appliquer style sur `mat-list-item`
   - Afficher la date de coche

## Success Criteria
- [ ] Lignes cochées affichées en barré (`line-through`)
- [ ] Lignes cochées avec opacité réduite (`opacity-60`)
- [ ] Date de coche affichée au format `MM.DD` (ex: "01.15")
- [ ] Style cohérent entre budget-table et current-month
- [ ] Transition fluide au toggle (pas de flash)
