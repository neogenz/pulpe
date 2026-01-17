# Implementation Plan: State Management Improvements

## Overview

3 issues à résoudre dans l'ordre de dépendance:
1. **localStorage objet → ID** (High priority, Low effort)
2. **TTL sur le cache localStorage** (Medium priority, Medium effort) - dépend de Issue 1
3. **Event-based invalidation** (Medium priority, Medium effort) - indépendant

Approches validées par agents spécialisés:
- Issue 1: Pattern standard de migration silencieuse
- Issue 2: Format `{ value, ttl }` (convention industrie) au lieu de `{ data, timestamp }`
- Issue 3: Pattern hybrid Signals + Event Bus RxJS

---

## Issue 1: localStorage objet → ID

### Dependencies
Aucune

### File Changes

### `frontend/src/app/core/storage/storage-keys.ts`
- Action: Ajouter nouvelle clé `CURRENT_BUDGET_ID: 'pulpe-current-budget-id'`
- Note: Garder l'ancienne clé `CURRENT_BUDGET` temporairement pour migration

### `frontend/src/app/core/budget/budget-api.ts`
- Action: Créer méthode privée `#saveBudgetIdToStorage(budgetId: string): void`
  - Utiliser `this.#storageService.setString(STORAGE_KEYS.CURRENT_BUDGET_ID, budgetId)`
- Action: Modifier `createBudget$()` ligne 70
  - Remplacer `this.#saveBudgetToStorage(validated.data)` par `this.#saveBudgetIdToStorage(validated.data.id)`
- Action: Modifier `getBudgetWithDetails$()` ligne 144
  - Remplacer `this.#saveBudgetToStorage(validated.data.budget)` par `this.#saveBudgetIdToStorage(validated.data.budget.id)`
- Action: Modifier `updateBudget$()` ligne 193
  - Remplacer `this.#saveBudgetToStorage(validated.data)` par `this.#saveBudgetIdToStorage(validated.data.id)`
- Action: Créer méthode publique `getCurrentBudgetIdFromStorage(): string | null`
  - Essayer nouvelle clé d'abord: `this.#storageService.getString(STORAGE_KEYS.CURRENT_BUDGET_ID)`
  - Si null, migration silencieuse depuis ancienne clé `CURRENT_BUDGET`
  - Si ancienne clé contient objet avec `.id`, migrer vers nouvelle clé et nettoyer
- Action: Simplifier `#removeBudgetFromStorage(budgetId: string): void`
  - Utiliser `getCurrentBudgetIdFromStorage()` au lieu de parser l'objet complet
  - Supprimer via `STORAGE_KEYS.CURRENT_BUDGET_ID`
- Action: Supprimer ancienne méthode `#saveBudgetToStorage()` après modifications
- Action: Supprimer ou déprécier `getCurrentBudgetFromStorage()` (actuellement inutilisée)
- Action: Nettoyer imports inutiles (`budgetSchema` si plus utilisé)

### `frontend/src/app/core/budget/budget-api.spec.ts`
- Action: Mettre à jour tests lignes 88-91, 148-177, 179-206
  - Changer assertions pour vérifier stockage de l'ID string au lieu de l'objet
  - Utiliser `getString` au lieu de `get` dans les vérifications
- Action: Ajouter test de migration silencieuse
  - Setup: ancienne clé avec objet Budget
  - Act: appeler `getCurrentBudgetIdFromStorage()`
  - Assert: nouvelle clé contient ID, ancienne clé supprimée

### Risques Issue 1
- LOW: Données utilisateurs existants → Mitigation: migration silencieuse
- CERTAIN: Tests à mettre à jour → Impact: LOW

---

## Issue 2: TTL sur le cache localStorage

### Dependencies
- Issue 1 doit être complétée d'abord (format de stockage simplifié)

### File Changes

### `frontend/src/app/core/storage/storage.service.ts`
- Action: Créer interface `CachedValue<T>` en haut du fichier
  ```typescript
  interface CachedValue<T> {
    value: T;
    ttl: number; // Timestamp d'expiration (Date.now() + ttlMs)
  }
  ```
- Action: Modifier méthode `get<T>(key: StorageKey, ttlMs?: number): T | null`
  - Ajouter paramètre optionnel `ttlMs`
  - Si données parsées ont structure `{ value, ttl }`:
    - Vérifier `Date.now() > cached.ttl` → supprimer et retourner null
    - Sinon retourner `cached.value`
  - Si données legacy (pas de structure `{ value, ttl }`):
    - Si `ttlMs` fourni → considérer comme expiré, supprimer, retourner null
    - Sinon → retourner données legacy as-is (rétrocompatibilité)
- Action: Modifier méthode `set<T>(key: StorageKey, value: T, ttlMs?: number): void`
  - Ajouter paramètre optionnel `ttlMs`
  - Si `ttlMs` fourni: wrapper avec `{ value, ttl: Date.now() + ttlMs }`
  - Sinon: stocker valeur directement (rétrocompatibilité)
- Action: Modifier méthode `getString(key: StorageKey, ttlMs?: number): string | null`
  - Ajouter paramètre optionnel `ttlMs`
  - Tenter parse JSON pour détecter format `{ value, ttl }`
  - Si format moderne: vérifier expiration
  - Si raw string: retourner directement (rétrocompatibilité `DEMO_MODE`)
- Action: Modifier méthode `setString(key: StorageKey, value: string, ttlMs?: number): void`
  - Ajouter paramètre optionnel `ttlMs`
  - Si `ttlMs` fourni: wrapper avec `{ value, ttl }`
  - Sinon: stocker raw string (rétrocompatibilité)
- Action: Modifier méthode `has(key: StorageKey, ttlMs?: number): boolean`
  - Ajouter paramètre optionnel `ttlMs`
  - Utiliser la logique de `get()` pour vérifier existence ET validité TTL
- Action: Ajouter gestion d'erreur pour `QuotaExceededError`
  - Try/catch autour de `localStorage.setItem`
  - Log warning si quota dépassé

### `frontend/src/app/core/storage/storage.service.spec.ts`
- Action: Ajouter suite de tests "TTL functionality"
  - Test: données avec TTL expiré retournent null
  - Test: données avec TTL valide retournent valeur
  - Test: `set()` avec TTL stocke au format `{ value, ttl }`
  - Test: `set()` sans TTL stocke valeur directement
  - Test: données legacy (sans TTL) sont rétrocompatibles
  - Test: migration implicite des données legacy quand TTL demandé
- Action: Ajouter tests pour `getString()` avec TTL
- Action: Ajouter tests pour `has()` avec TTL

### `frontend/src/app/core/budget/budget-api.ts`
- Action: Passer TTL 24h (86400000ms) aux appels `getString()` pour `CURRENT_BUDGET_ID`
  - Dans `getCurrentBudgetIdFromStorage()`: `this.#storageService.getString(STORAGE_KEYS.CURRENT_BUDGET_ID, 86_400_000)`

### Risques Issue 2
- LOW: Breaking legacy data → Mitigation: rétrocompatibilité gracieuse
- LOW: Storage quota increase → Impact: +20 bytes par entrée, négligeable
- NEGLIGIBLE: Performance → `Date.now()` est O(1)

---

## Issue 3: Event-based Cache Invalidation

### Dependencies
Aucune (peut être fait en parallèle avec Issues 1-2)

### File Changes

### `frontend/src/app/core/budget/budget-events.service.ts` (CRÉER)
- Action: Créer nouveau service injectable `BudgetEventsService`
  - 3 Subjects privés: `#budgetCreated`, `#budgetDeleted`, `#budgetUpdated`
  - 3 Observables publics: `budgetCreated$`, `budgetDeleted$`, `budgetUpdated$`
  - 3 méthodes: `notifyBudgetCreated(budget)`, `notifyBudgetDeleted(budgetId)`, `notifyBudgetUpdated(budget)`
- Pattern: Suivre le même style que `HasBudgetCache` existant
- Note: Service léger, `providedIn: 'root'`

### `frontend/src/app/core/budget/budget-events.service.spec.ts` (CRÉER)
- Action: Créer tests unitaires pour le service
  - Test: `notifyBudgetCreated` émet sur `budgetCreated$`
  - Test: `notifyBudgetDeleted` émet sur `budgetDeleted$`
  - Test: `notifyBudgetUpdated` émet sur `budgetUpdated$`

### `frontend/src/app/core/budget/budget-api.ts`
- Action: Injecter `BudgetEventsService`
  - `readonly #budgetEvents = inject(BudgetEventsService);`
- Action: Dans `createBudget$()` ligne ~70-73
  - Ajouter dans le `tap`: `this.#budgetEvents.notifyBudgetCreated(validated.data)`
- Action: Dans `deleteBudget$()` ligne ~210-215
  - Ajouter dans le `tap`: `this.#budgetEvents.notifyBudgetDeleted(budgetId)`
- Action: Dans `updateBudget$()` ligne ~193-195
  - Ajouter dans le `tap`: `this.#budgetEvents.notifyBudgetUpdated(validated.data)`
  - Note: Actuellement aucune invalidation n'existe pour update!

### `frontend/src/app/feature/budget/budget-list/budget-list-store.ts`
- Action: Injecter `BudgetEventsService`
- Action: Dans le constructor, ajouter subscriptions avec `takeUntilDestroyed()`
  - `budgetCreated$` → `this.budgets.reload()`
  - `budgetDeleted$` → `this.budgets.reload()`
  - `budgetUpdated$` → `this.budgets.reload()`
- Pattern: Suivre le style existant dans le store

### `frontend/src/app/feature/current-month/services/current-month-store.ts`
- Action: Injecter `BudgetEventsService`
- Action: Dans le constructor, ajouter subscriptions avec `takeUntilDestroyed()`
  - `budgetUpdated$` → filter par mois courant → `refreshData()`
  - `budgetCreated$` → filter par mois courant → `refreshData()`
  - `budgetDeleted$` → `refreshData()`
- Action: Créer méthode privée `#isCurrentMonthBudget(budget: Budget): boolean`
  - Comparer `budget.month` et `budget.year` avec la période courante

### `frontend/src/app/feature/budget-templates/services/budget-templates-store.ts`
- Action: Évaluer si ce store a besoin d'écouter les events budget
  - Probablement NON: les templates sont indépendants des budgets
  - Laisser tel quel sauf si dépendance identifiée

### `frontend/src/app/feature/budget/budget-list/budget-list-page.ts`
- Action: Supprimer appel manuel `this.state.refreshData()` ligne 282
  - Le store s'auto-rafraîchit maintenant via event bus
- Action: Supprimer appel manuel `this.state.refreshData()` ligne 321
  - Même raison
- Note: Garder la navigation/notification après dialog, juste supprimer le refresh

### `frontend/src/app/feature/budget-templates/list/template-list-page.ts`
- Action: Évaluer ligne 215 - appel manuel `refreshData()`
  - Si c'est pour templates (pas budgets), garder tel quel
  - Les templates ont leur propre cycle de vie

### `frontend/src/app/feature/budget-templates/details/template-detail.ts`
- Action: Évaluer lignes 401, 461 - appels manuels
  - Si c'est pour template lines, garder tel quel
  - Le pattern event-based peut être étendu plus tard pour templates si nécessaire

### Tests à Mettre à Jour

### `frontend/src/app/core/budget/budget-api.spec.ts`
- Action: Ajouter mock de `BudgetEventsService`
- Action: Vérifier que les méthodes `notify*` sont appelées après mutations
  - Test: `createBudget$` appelle `notifyBudgetCreated`
  - Test: `deleteBudget$` appelle `notifyBudgetDeleted`
  - Test: `updateBudget$` appelle `notifyBudgetUpdated`

### `frontend/src/app/feature/budget/budget-list/budget-list-store.spec.ts`
- Action: Ajouter tests pour auto-reload sur events
  - Mock `BudgetEventsService`
  - Émettre event → vérifier `reload()` appelé

### Risques Issue 3
- LOW: Circular dependencies → Mitigation: service léger, bien scopé
- LOW: Memory leaks → Mitigation: `takeUntilDestroyed()` partout
- LOW: Over-notification → Mitigation: filter events par pertinence (mois courant)

---

## Testing Strategy

### Tests Unitaires
| Fichier | Action |
|---------|--------|
| `storage.service.spec.ts` | Ajouter suite TTL |
| `budget-api.spec.ts` | Update assertions stockage ID, ajouter tests events |
| `budget-events.service.spec.ts` | Créer (nouveau service) |
| `budget-list-store.spec.ts` | Ajouter tests auto-reload |

### Tests Manuels
1. **Migration Issue 1**:
   - Simuler ancienne donnée dans localStorage
   - Recharger l'app → vérifier migration automatique
2. **TTL Issue 2**:
   - Stocker donnée avec TTL court (5s)
   - Attendre expiration → vérifier retour null
3. **Event Bus Issue 3**:
   - Créer budget dans BudgetListPage
   - Naviguer vers CurrentMonth → vérifier données à jour sans refresh manuel

---

## Rollout Considerations

### Ordre d'Implémentation
1. **Issue 1** (localStorage ID) - Base pour Issue 2
2. **Issue 2** (TTL) - Dépend du format simplifié de Issue 1
3. **Issue 3** (Event Bus) - Indépendant, peut être fait en parallèle

### Migration Path
- Issue 1: Migration silencieuse automatique, aucune action utilisateur
- Issue 2: Rétrocompatibilité totale, données legacy supportées
- Issue 3: Aucune migration, nouveau comportement transparent

### Breaking Changes
**Aucun** - Toutes les modifications sont rétrocompatibles

---

## Summary

| Issue | Files to Modify | Files to Create | Estimated Lines Changed |
|-------|-----------------|-----------------|------------------------|
| 1 | 3 | 0 | ~40 |
| 2 | 2 | 0 | ~60 |
| 3 | 6 | 2 | ~80 |
| **Total** | **8** | **2** | **~180** |
