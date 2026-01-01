# Task: Ajouter la checkbox dans l'UI budget-table et current-month

## Problem
L'utilisateur n'a pas de moyen visuel de cocher/décocher une ligne budgétaire.

## Proposed Solution
Ajouter une `mat-checkbox` dans la zone actions (à droite) des composants d'affichage. Au clic, appeler l'API toggle et mettre à jour l'état optimistiquement.

## Dependencies
- Task #2: L'endpoint API doit être disponible

## Context

### Composants cibles

**Budget Table (desktop)**
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`
- Zone actions: lignes 494-592 (mat-menu avec Edit, Delete, etc.)
- Pattern: menu items conditionnels basés sur `line.metadata.*`

**Budget Table Mobile Card**
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table-mobile-card.ts`
- Actions dans mat-menu (lignes 113-164)

**Financial Entry (current-month)**
- `frontend/projects/webapp/src/app/feature/current-month/components/financial-entry.ts`
- A déjà `MatCheckboxModule` importé (ligne 37)
- Code checkbox commenté existant (lignes 56-66) - pattern réutilisable

### Stores

**Budget Details Store**
- `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`
- Méthode `updateBudgetLine()` lignes 160-192
- Pattern optimistic update existant

**Current Month Store**
- `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`
- Pattern `#performOptimisticUpdate` lignes 236-301

### API Frontend
- `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-line-api/budget-line-api.ts`
- Ajouter méthode `toggleCheck$(id: string)` qui appelle `POST /budget-lines/:id/toggle-check`

### Pattern checkbox existant
```html
<mat-checkbox
  [checked]="line.data.checkedAt !== null"
  (change)="onToggleCheck(line.data.id)"
  (click)="$event.stopPropagation()"
/>
```

### Fichiers à modifier

1. **budget-line-api.ts** - Ajouter `toggleCheck$(id: string): Observable<BudgetLineResponse>`

2. **budget-details-store.ts** - Ajouter méthode `toggleCheck(id: string)`

3. **budget-table.ts**:
   - Ajouter `MatCheckboxModule` aux imports
   - Ajouter checkbox dans la zone actions
   - Ajouter output `toggleCheck`

4. **budget-table-mobile-card.ts**:
   - Ajouter `MatCheckboxModule` aux imports
   - Ajouter checkbox dans le menu mobile

5. **budget-details-page.ts** - Connecter l'event toggle au store

6. **current-month-store.ts** - Ajouter méthode `toggleCheck(id: string)`

7. **financial-entry.ts** - Ajouter checkbox (décommenter et adapter le code existant)

8. **current-month.ts** - Connecter l'event toggle au store

## Success Criteria
- [ ] Checkbox visible à droite dans budget-table (desktop et mobile)
- [ ] Checkbox visible dans financial-entry (current-month)
- [ ] Clic toggle l'état (optimistic update)
- [ ] État synchronisé avec le backend
- [ ] `pnpm quality` passe
