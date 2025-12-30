# Implementation Plan: Fix breadcrumb localStorage and effect cleanup issues

## Overview

Deux corrections ciblées :
1. **sessionStorage** : Remplacer `localStorage` par `sessionStorage` dans `breadcrumb-context.ts` (amélioration de propreté)
2. **Effect cleanup** : Ajouter un cleanup via `DestroyRef` dans `budget-list-page.ts` (fix de bug réel)

## Dependencies

Aucune dépendance externe. Les modifications sont indépendantes et peuvent être faites dans n'importe quel ordre.

---

## File Changes

### `frontend/projects/webapp/src/app/core/routing/breadcrumb-context.ts`

- **Action 1** : Remplacer `localStorage.setItem` par `sessionStorage.setItem` dans la fonction `saveBreadcrumbContext` (ligne 10)
- **Action 2** : Remplacer `localStorage.getItem` par `sessionStorage.getItem` dans la fonction `getBreadcrumbContext` (ligne 15)
- **Rationale** : Le contexte de breadcrumb n'a pas besoin de persister entre sessions ; sessionStorage se nettoie automatiquement à la fermeture de l'onglet

---

### `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`

- **Action 1** : Ajouter `DestroyRef` à l'import depuis `@angular/core` (ligne 5-10)
- **Action 2** : Ajouter l'injection de `DestroyRef` dans les propriétés privées du composant (après ligne 134)
  ```
  readonly #destroyRef = inject(DestroyRef);
  ```
- **Action 3** : Ajouter le callback de cleanup dans le constructor, après l'effect existant (après ligne 143)
  - Utiliser `this.#destroyRef.onDestroy()` pour réinitialiser `#loadingIndicator.setLoading(false)`
- **Rationale** : Évite que l'indicateur de chargement global reste bloqué si l'utilisateur quitte la page pendant un reloading

---

## Testing Strategy

### Tests existants
- Aucun test unitaire existant pour `breadcrumb-context.ts`
- Aucun test unitaire existant pour `budget-list-page.ts`

### Vérification manuelle
1. **sessionStorage** :
   - Naviguer vers un budget détail
   - Vérifier dans DevTools > Application > Session Storage que `pulpe-breadcrumb-context` est présent
   - Fermer l'onglet et rouvrir l'app : vérifier que la clé n'existe plus

2. **Effect cleanup** :
   - Naviguer vers la liste des budgets
   - Pendant le chargement (si possible simuler un delay réseau), naviguer vers une autre page
   - Vérifier que l'indicateur de chargement global n'est pas bloqué

### Run quality check
```bash
pnpm quality
```

---

## Documentation

Aucune mise à jour de documentation requise.

---

## Rollout Considerations

- **Breaking changes** : Aucun
- **Migration** : Aucune migration requise
- **Impact utilisateur** : Transparent - amélioration de la robustesse
