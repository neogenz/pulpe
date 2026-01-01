# Implementation Plan: Current Month - Optimistic Toggle + Slide Toggle UI

## Overview

Deux modifications indépendantes :
1. **Optimistic Update** : Modifier `toggleCheck()` pour mettre à jour l'UI instantanément sans recharger toute la page
2. **UI Component** : Remplacer `mat-checkbox` par `mat-slide-toggle` dans `financial-entry.ts`

## Dependencies

- Aucune dépendance externe à installer (mat-slide-toggle fait partie de @angular/material)
- L'API `POST /budget-lines/{id}/toggle-check` existe déjà et fonctionne

---

## File Changes

### `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

**Action 1** : Réécrire la méthode `toggleCheck()` (lignes 386-390) avec optimistic update

Le pattern actuel :
```
API call → refreshData() (reload complet)
```

Le nouveau pattern :
```
1. Sauvegarder originalData
2. Mettre à jour localement budgetLines (toggle checkedAt)
3. Appeler l'API en arrière-plan
4. Rollback si erreur
```

**Détails de l'implémentation** :
- Trouver la budget line par `budgetLineId` dans `this.#dashboardResource.value()?.budgetLines`
- Toggle `checkedAt` : si `null` → `new Date().toISOString()`, sinon → `null`
- Mettre à jour le resource avec `this.#dashboardResource.set()` (comme fait pour les transactions)
- Le `realizedBalance` sera automatiquement recalculé car c'est un `computed()` qui dépend de `budgetLines()`
- Ne PAS appeler `refreshData()` après l'API call
- En cas d'erreur API, rollback avec `this.#dashboardResource.set(originalData)`

**Pattern à suivre** : S'inspirer de `#performOptimisticUpdateDelete()` (lignes 319-380) mais simplifier car :
- Pas besoin de recalculer `endingBalance` (non impacté par checkedAt)
- Pas besoin de sync backend après (l'API toggle-check est définitive)

---

### `frontend/projects/webapp/src/app/feature/current-month/components/financial-entry.ts`

**Action 1** : Modifier l'import (ligne 13)
- Remplacer `MatCheckboxModule` par `MatSlideToggleModule`
- Import depuis `@angular/material/slide-toggle`

**Action 2** : Modifier les imports du composant (ligne 37)
- Remplacer `MatCheckboxModule` par `MatSlideToggleModule`

**Action 3** : Modifier le template (lignes 60-65)
- Remplacer `<mat-checkbox>` par `<mat-slide-toggle>`
- Conserver les mêmes bindings :
  - `[checked]="data().checkedAt !== null"`
  - `(change)="toggleCheck.emit()"`
  - `(click)="$event.stopPropagation()"`
  - `[attr.data-testid]="'check-budget-line-' + data().id"`

**Note UX** : Le slide-toggle a une taille plus grande qu'un checkbox. Le layout existant avec `matListItemAvatar` devrait s'adapter.

---

## Testing Strategy

### Tests à créer

**`frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.spec.ts`**

Ajouter une section `describe('User can toggle budget line check')` avec les tests :

1. **Test optimistic update success** :
   - Given: budget line avec `checkedAt: null`
   - When: `store.toggleCheck(lineId)`
   - Then: `checkedAt` devient une date ISO string AVANT la fin de l'appel API

2. **Test toggle off** :
   - Given: budget line avec `checkedAt: '2024-01-15T00:00:00Z'`
   - When: `store.toggleCheck(lineId)`
   - Then: `checkedAt` devient `null`

3. **Test rollback on error** :
   - Given: API qui échoue
   - When: `store.toggleCheck(lineId)`
   - Then: L'état original est restauré après l'erreur

4. **Test realized balance update** :
   - Given: budget line income non cochée
   - When: toggle check ON
   - Then: `realizedBalance` augmente du montant

### Tests manuels

1. Ouvrir la page current-month
2. Cliquer sur un slide-toggle d'une budget line
3. Vérifier que l'UI se met à jour instantanément (pas de spinner/reload)
4. Vérifier que le "Solde réalisé" se met à jour
5. Rafraîchir la page et vérifier que l'état persiste (API a bien fonctionné)

---

## Documentation

Aucune documentation à mettre à jour.

---

## Rollout Considerations

- **Breaking changes** : Aucun
- **Migration** : Non nécessaire
- **Feature flag** : Non nécessaire (amélioration UX pure)
- **Risque** : Faible - le rollback protège contre les erreurs API
