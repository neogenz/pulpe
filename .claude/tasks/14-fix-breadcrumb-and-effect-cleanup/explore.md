# Task: Fix breadcrumb localStorage and effect cleanup issues

## Summary

Analysis of two potential issues flagged in code review.

---

## Issue 1: localStorage in breadcrumb-context.ts

### Fichiers concernés
- `frontend/projects/webapp/src/app/core/routing/breadcrumb-context.ts:9-11` - saveBreadcrumbContext
- `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts:224-228` - caller
- `frontend/projects/webapp/src/app/feature/budget/budget.routes.ts:17-24` - resolver using getBreadcrumbContext

### Analyse

**La préoccupation initiale était incorrecte.** Il n'y a PAS de fuite mémoire :

1. **Une seule entrée stockée** : `saveBreadcrumbContext` écrase toujours la même clé (`pulpe-breadcrumb-context`). Pas d'accumulation.

2. **Validation de l'ID** : `getBreadcrumbContext(id)` vérifie que l'ID stocké correspond à l'ID demandé (ligne 19). Si non, retourne `null`.

3. **Taille fixe** : Les données sont petites (~50 bytes) : `{id, month, year}`.

### Recommandation

**sessionStorage serait plus approprié** car :
- Le contexte est uniquement utile pour la navigation dans la même session
- Si l'utilisateur ferme le navigateur et revient, il commencerait de toute façon de zéro
- sessionStorage se nettoie automatiquement à la fermeture de l'onglet

**Priorité : Basse** - Amélioration de propreté, pas de bug réel.

### Changement proposé

```typescript
// Changer de localStorage à sessionStorage
export function saveBreadcrumbContext(context: BreadcrumbContext): void {
  sessionStorage.setItem(BREADCRUMB_CONTEXT_KEY, JSON.stringify(context));
}

export function getBreadcrumbContext(id: string): BreadcrumbContext | null {
  try {
    const stored = sessionStorage.getItem(BREADCRUMB_CONTEXT_KEY);
    // ... reste identique
  }
}
```

---

## Issue 2: Effect sans cleanup dans budget-list-page.ts

### Fichiers concernés
- `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts:140-143` - effect problématique
- `frontend/projects/webapp/src/app/core/loading/loading-indicator.ts` - service global singleton

### Analyse

**C'est un BUG RÉEL.**

L'effect modifie un service global (`LoadingIndicator` est `providedIn: 'root'`) :

```typescript
effect(() => {
  const status = this.state.budgets.status();
  this.#loadingIndicator.setLoading(status === 'reloading');
});
```

**Scénario problématique :**
1. L'utilisateur navigue vers la page des budgets
2. Le refresh démarre, `status` passe à `'reloading'`
3. L'effect exécute `setLoading(true)`
4. L'utilisateur navigue ailleurs AVANT que le loading soit terminé
5. L'effect est détruit (Angular le nettoie automatiquement)
6. MAIS `LoadingIndicator.#isLoading` reste à `true` car aucun cleanup n'a été exécuté
7. L'indicateur de chargement global reste affiché indéfiniment

### Patterns similaires dans le codebase

Recherche dans le codebase pour des patterns similaires :
- `demo-mode.service.ts:35` - effect pour sync localStorage (pas de side-effect global)
- `budget-creation-dialog.ts:294` - effect pour sync form (pas de side-effect global)
- `analytics.ts:54` - effect stocké dans une variable privée

Aucun exemple de cleanup explicite avec DestroyRef n'a été trouvé dans le codebase.

### Recommandation

**Ajouter un cleanup explicite via DestroyRef :**

```typescript
readonly #destroyRef = inject(DestroyRef);

constructor() {
  // ... existing code ...

  effect(() => {
    const status = this.state.budgets.status();
    this.#loadingIndicator.setLoading(status === 'reloading');
  });

  // Cleanup: s'assurer que l'indicateur est reset à la destruction
  this.#destroyRef.onDestroy(() => {
    this.#loadingIndicator.setLoading(false);
  });
}
```

**Priorité : Moyenne** - Bug réel qui peut causer un indicateur de chargement bloqué.

---

## Key Files

| Fichier | Ligne | Rôle |
|---------|-------|------|
| `core/routing/breadcrumb-context.ts` | 9-11 | save/get localStorage |
| `feature/budget/budget-list/budget-list-page.ts` | 140-143 | effect sans cleanup |
| `core/loading/loading-indicator.ts` | 1-14 | Service singleton global |
| `feature/budget/budget.routes.ts` | 17-24 | Resolver utilisant breadcrumb context |

## Dependencies

- `DestroyRef` de `@angular/core` pour le cleanup

## Patterns à suivre

1. Pour les effects modifiant des états globaux, toujours ajouter un cleanup via `DestroyRef.onDestroy()`
2. Préférer `sessionStorage` à `localStorage` pour les données de navigation temporaires
