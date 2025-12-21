# Implementation Plan: Remove Redundant Wait Code

## Overview

Supprimer le code d'attente arbitraire (`#waitForPageReady`, `#waitForNextFrame`, `#delay`, `LAZY_LOAD_MOUNT_DELAY_MS`) du `TutorialService`.

**Justification:** Chaque step avec `attachTo` a déjà un `beforeShowPromise` avec `MutationObserver` qui attend l'élément de manière réactive. Le code de delay de 200ms + 2 RAF dans le service est redondant et représente un code smell.

## Dependencies

Aucune dépendance externe. Pure suppression de code.

**Vérification préalable effectuée:** Les 13 steps avec `attachTo` ont tous un `beforeShowPromise` correspondant.

## File Changes

### `projects/webapp/src/app/core/tutorial/tutorial.service.ts`

**1. Supprimer la constante `LAZY_LOAD_MOUNT_DELAY_MS`**
- Ligne 28-31: Supprimer le JSDoc et la constante `const LAZY_LOAD_MOUNT_DELAY_MS = 200;`

**2. Supprimer l'appel à `#waitForPageReady()` dans `#prepareAndExecuteTour()`**
- Ligne 180: Supprimer `await this.#waitForPageReady();`
- La méthode `#prepareAndExecuteTour()` passera directement de la navigation à la validation de route

**3. Supprimer la méthode `#waitForNextFrame()`**
- Lignes 232-248: Supprimer le JSDoc et la méthode complète

**4. Supprimer la méthode `#waitForPageReady()`**
- Lignes 250-263: Supprimer le JSDoc et la méthode complète

**5. Supprimer la méthode `#delay()`**
- Lignes 265-270: Supprimer le JSDoc et la méthode complète

## Testing Strategy

**Tests existants:**
- `tutorial.service.spec.ts` - Aucun test ne couvre les méthodes privées supprimées
- Les tests existants doivent continuer à passer car ils mockent le router

**Validation manuelle:**
1. Lancer l'app en dev : `pnpm dev`
2. Naviguer vers une page différente (ex: /app/budgets)
3. Déclencher un tour avec navigation (ex: depuis le menu aide, relancer "dashboard-welcome")
4. Vérifier que le tour démarre correctement après navigation vers /app/current-month
5. Vérifier que les steps s'attachent aux bons éléments

## Quality Checks

Après les modifications :
```bash
cd frontend && pnpm test -- tutorial.service
cd frontend && pnpm lint
pnpm quality
```

## Rollout Considerations

- **Breaking changes:** Aucun - API publique inchangée
- **Feature flags:** Non nécessaire
- **Migration:** Aucune

## Summary

| Action | Lignes supprimées |
|--------|-------------------|
| Constante `LAZY_LOAD_MOUNT_DELAY_MS` | 4 |
| Appel `await this.#waitForPageReady()` | 1 |
| Méthode `#waitForNextFrame()` | 17 |
| Méthode `#waitForPageReady()` | 14 |
| Méthode `#delay()` | 6 |
| **Total** | **~42 lignes** |

Code smell éliminé, comportement préservé grâce au mécanisme `beforeShowPromise` existant dans chaque step.
