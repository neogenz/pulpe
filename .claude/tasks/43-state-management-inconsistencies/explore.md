# Task: State Management - Issues à Améliorer

## Executive Summary

Après analyse approfondie avec 6 agents spécialisés, **3 vrais problèmes** identifiés dans le frontend state management.

| Issue | Priorité | Effort | Impact | Risque |
|-------|----------|--------|--------|--------|
| 1. localStorage objet → ID | 🔴 High | Low | Performance + simplicité | Low |
| 2. Ajouter TTL au cache | 🟡 Medium | Medium | Fiabilité données | Medium |
| 3. Event-based invalidation | 🟡 Medium | Medium | Maintenabilité | Low |

---

## Issue 1: localStorage stocke l'objet complet au lieu de l'ID

### Constat

```typescript
// budget-api.ts - Écriture (3 call sites)
#saveBudgetToStorage(budget: Budget): void {
  this.#storageService.set(STORAGE_KEYS.CURRENT_BUDGET, budget);  // ~400-2KB
}

// Appelé dans:
// Line 70:  createBudget$()         → #saveBudgetToStorage(validated.data)
// Line 144: getBudgetWithDetails$() → #saveBudgetToStorage(validated.data.budget)
// Line 193: updateBudget$()         → #saveBudgetToStorage(validated.data)
```

```typescript
// budget-api.ts - Lecture (SEUL USAGE dans toute l'app - Line 264)
#removeBudgetFromStorage(budgetId: string): void {
  const currentBudget = this.getCurrentBudgetFromStorage();  // Parse JSON + Zod validation
  if (currentBudget?.id === budgetId) {                      // Compare JUSTE l'ID!
    this.#storageService.remove(STORAGE_KEYS.CURRENT_BUDGET);
  }
}
```

### Analyse Deep Dive

**Budget Object Structure (13 fields):**
```typescript
// shared/schemas.ts:63-84
{
  id: string,               // UUID - SEUL CHAMP UTILISÉ
  month: number,
  year: number,
  description: string,      // max 500 chars
  userId?: string,
  templateId: string,
  endingBalance?: number | null,
  rollover?: number,
  remaining?: number,
  previousBudgetId?: string | null,
  createdAt: string,
  updatedAt: string
}
```

**Waste Analysis:**
| Aspect | Stocké | Utilisé | Overhead |
|--------|--------|---------|----------|
| Champs | 13 | 1 (`id`) | 12 champs inutiles |
| Taille | ~400-2000 bytes | ~36 bytes | 90-98% gaspillé |
| CPU | JSON.parse + Zod 13 fields | String comparison | O(n) → O(1) |

**Verification: Zero External Callers**
```bash
# Grep results
getCurrentBudgetFromStorage: 1 fichier, 1 usage (#removeBudgetFromStorage)
#saveBudgetToStorage:        private, 3 call sites dans budget-api.ts
CURRENT_BUDGET:              uniquement dans budget-api.ts et storage-keys.ts
```

### StorageService API Existant

```typescript
// storage.service.ts - Methods disponibles
getString(key: StorageKey): string | null  // ✅ EXISTE DÉJÀ!
setString(key: StorageKey, value: string): void  // ✅ EXISTE DÉJÀ!

// Exemple d'usage correct (demo-mode.service.ts):
this.#storageService.setString(STORAGE_KEYS.DEMO_MODE, 'true');
```

### Solution

```typescript
// storage-keys.ts:14
CURRENT_BUDGET_ID: 'pulpe-current-budget-id',  // Nouveau

// budget-api.ts - Simplification
#saveBudgetIdToStorage(budgetId: string): void {
  this.#storageService.setString(STORAGE_KEYS.CURRENT_BUDGET_ID, budgetId);
}

getCurrentBudgetIdFromStorage(): string | null {
  return this.#storageService.getString(STORAGE_KEYS.CURRENT_BUDGET_ID);
}

#removeBudgetFromStorage(budgetId: string): void {
  const currentId = this.getCurrentBudgetIdFromStorage();
  if (currentId === budgetId) {
    this.#storageService.remove(STORAGE_KEYS.CURRENT_BUDGET_ID);
  }
}
```

### Migration Strategy

**Option A: Silent Migration (Recommandée)**
```typescript
getCurrentBudgetIdFromStorage(): string | null {
  // Try new format first
  const newFormatId = this.#storageService.getString(STORAGE_KEYS.CURRENT_BUDGET_ID);
  if (newFormatId) return newFormatId;

  // Fallback: migrate from old format
  const oldFormat = this.#storageService.get<unknown>(STORAGE_KEYS.CURRENT_BUDGET);
  if (oldFormat && typeof oldFormat === 'object' && 'id' in oldFormat) {
    const budgetId = String(oldFormat.id);
    this.#saveBudgetIdToStorage(budgetId);  // Migrate
    this.#storageService.remove(STORAGE_KEYS.CURRENT_BUDGET);  // Cleanup
    return budgetId;
  }
  return null;
}
```

**Avantages:**
- Users existants migrent automatiquement
- Aucune perte de données
- Transparent pour l'utilisateur

### Fichiers à Modifier

| Fichier | Lignes | Modification |
|---------|--------|--------------|
| `core/storage/storage-keys.ts` | 14 | Ajouter `CURRENT_BUDGET_ID` |
| `core/budget/budget-api.ts` | 70 | `this.#saveBudgetIdToStorage(validated.data.id)` |
| `core/budget/budget-api.ts` | 144 | `this.#saveBudgetIdToStorage(validated.data.budget.id)` |
| `core/budget/budget-api.ts` | 193 | `this.#saveBudgetIdToStorage(validated.data.id)` |
| `core/budget/budget-api.ts` | 238-257 | Remplacer par `getCurrentBudgetIdFromStorage()` |
| `core/budget/budget-api.ts` | 259-261 | Remplacer par `#saveBudgetIdToStorage()` |
| `core/budget/budget-api.ts` | 263-268 | Simplifier `#removeBudgetFromStorage()` |
| `core/budget/budget-api.ts` | 6, 13 | Supprimer import `budgetSchema` si plus utilisé |
| `core/budget/budget-api.spec.ts` | 88-91, 148-177, 179-206 | Update test assertions |

**Total Impact:** 3 files, ~20 lignes modifiées

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Breaking existing data | LOW | HIGH | Silent migration (Option A) |
| Hidden dependencies | NONE | - | Vérifié: 0 callers externes |
| Test failures | CERTAIN | LOW | 3 tests à mettre à jour |

---

## Issue 2: Pas de TTL sur le cache localStorage

### Constat

```typescript
// storage.service.ts:43-54 - Aucun TTL
get<T>(key: StorageKey): T | null {
  const item = localStorage.getItem(key);
  if (!item) return null;
  try {
    return JSON.parse(item) as T;
  } catch {
    this.#logger.warn(`Erreur parsing localStorage: ${key}`);
    return null;
  }
}
```

### Scénarios de Staleness

**Scénario 1: Cross-Device Deletion**
```
Day 1: User crée budget sur Device A
       → localStorage[CURRENT_BUDGET] = { id: "abc-123", ... }

Day 7: User supprime budget sur Device B (autre navigateur)
       → Serveur supprime budget "abc-123"

Day 8: User retourne sur Device A
       → localStorage a toujours "abc-123"
       → App tente fetch budget → 404 Error
       → UX cassée
```

**Scénario 2: Long Session**
```
Session longue (24h+) sans refresh
→ Budget modifié/supprimé par un autre moyen
→ Cache stale jusqu'au prochain refresh manuel
```

### Storage Keys Inventory

| Key | Type | Taille | TTL Recommandé |
|-----|------|--------|----------------|
| `CURRENT_BUDGET` | Budget object | ~2KB | 24h (après fix Issue 1: ID seulement) |
| `DEMO_MODE` | String "true" | ~10 bytes | Aucun (session-scoped, logout cleanup) |
| `DEMO_USER_EMAIL` | String email | ~30 bytes | Aucun (session-scoped) |
| `pulpe-tour-*` | String "true" | ~10 bytes | 30 days |

### Solution

```typescript
// storage.service.ts - Interface
interface CachedValue<T> {
  data: T;
  timestamp: number;
}

// storage.service.ts - Méthodes modifiées
get<T>(key: StorageKey, ttlMs?: number): T | null {
  const item = localStorage.getItem(key);
  if (!item) return null;

  try {
    const parsed = JSON.parse(item);

    // Check if new format (has timestamp)
    if ('timestamp' in parsed && 'data' in parsed) {
      const cached = parsed as CachedValue<T>;

      if (ttlMs && Date.now() - cached.timestamp > ttlMs) {
        this.remove(key);
        return null;
      }

      return cached.data;
    }

    // Legacy format - migrate or expire based on TTL
    if (ttlMs) {
      this.#logger.debug(`Migrating legacy storage key: ${key}`);
      this.remove(key);  // Force refresh from API
      return null;
    }

    // No TTL requested, return legacy as-is
    return parsed as T;
  } catch {
    return null;
  }
}

set<T>(key: StorageKey, value: T): void {
  const cached: CachedValue<T> = {
    data: value,
    timestamp: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(cached));
}

// getString avec TTL optionnel
getString(key: StorageKey, ttlMs?: number): string | null {
  const item = localStorage.getItem(key);
  if (!item) return null;

  // String values: check if wrapped with timestamp
  try {
    const parsed = JSON.parse(item);
    if ('timestamp' in parsed && 'data' in parsed) {
      if (ttlMs && Date.now() - parsed.timestamp > ttlMs) {
        this.remove(key);
        return null;
      }
      return String(parsed.data);
    }
  } catch {
    // Not JSON, treat as raw string (legacy)
  }

  return item;  // Return raw string for backwards compat
}
```

### Backwards Compatibility

**Migration Path:**
1. **Phase 1:** Deploy TTL-aware code, existing data still readable
2. **Phase 2:** Old data expires naturally when TTL is checked
3. **Phase 3:** New writes use `{ data, timestamp }` format
4. **No breaking changes** - Users don't lose data abruptly

### Edge Cases

| Case | Décision |
|------|----------|
| `setString()` wrapping | Garder raw pour `DEMO_MODE` compatibility |
| `has(key, ttlMs?)` | Ajouter TTL check pour consistance |
| Tour keys dynamiques | 30 jours TTL, cleanup on logout préservé |

### Fichiers à Modifier

| Fichier | Lignes | Modification |
|---------|--------|--------------|
| `core/storage/storage.service.ts` | 43-54 | Ajouter TTL à `get<T>()` |
| `core/storage/storage.service.ts` | 60-67 | Ajouter TTL à `getString()` |
| `core/storage/storage.service.ts` | 73-79 | Wrapper avec `{ data, timestamp }` |
| `core/storage/storage.service.ts` | 107-113 | Ajouter TTL à `has()` |
| `core/storage/storage.service.spec.ts` | - | Ajouter tests TTL |
| `core/budget/budget-api.ts` | 240 | Passer TTL 24h au get |

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Breaking legacy data | LOW | MEDIUM | Graceful degradation |
| Storage quota increase | LOW | LOW | +20 bytes par entry |
| Performance | NEGLIGIBLE | - | `Date.now()` is O(1) |

---

## Issue 3: Cache Invalidation Manuelle (Error-Prone)

### Constat

Après mutations, les développeurs doivent manuellement appeler `refreshData()`:

```typescript
// budget-list-page.ts:282-286
const result = await firstValueFrom(dialogRef.afterClosed());

if (result?.success) {
  this.state.refreshData();  // ← Manuel, facile d'oublier
}
```

### Store Inventory

| Store | Fichier | Méthode | Pattern |
|-------|---------|---------|---------|
| **BudgetListStore** | `budget-list-store.ts:157` | `refreshData()` | ❌ Manuel |
| **CurrentMonthStore** | `current-month-store.ts:220` | `refreshData()` | ❌ Manuel |
| **BudgetTemplatesStore** | `budget-templates-store.ts:54` | `refreshData()` | ❌ Manuel |
| **BudgetDetailsStore** | `budget-details-store.ts:518` | `reloadBudgetDetails()` | ✅ Optimistic + reload |
| **TemplateLineStore** | `template-line-store.ts` | Optimistic | ✅ Auto-synced |
| **HasBudgetCache** | `has-budget-cache.ts` | Signal | ✅ Auto-synced by BudgetApi |

**Naming Inconsistency:** `refreshData()` vs `reloadTemplates()` vs `reloadBudgetDetails()`

### HasBudgetCache: Le Gold Standard

```typescript
// has-budget-cache.ts - Pattern qui fonctionne
@Injectable({ providedIn: 'root' })
export class HasBudgetCache {
  readonly #hasBudget = signal<boolean | null>(null);

  hasBudget(): boolean | null { return this.#hasBudget(); }
  setHasBudget(value: boolean): void { this.#hasBudget.set(value); }
  clear(): void { this.#hasBudget.set(null); }
}

// budget-api.ts - Auto-sync embedded dans l'API
createBudget$(): Observable<...> {
  return this.#httpClient.post(...).pipe(
    tap(() => this.#hasBudgetCache.setHasBudget(true))  // Line 71
  );
}

deleteBudget$(): Observable<void> {
  return this.#httpClient.delete(...).pipe(
    tap(() => this.#hasBudgetCache.setHasBudget(response.hasBudget))  // Line 215
  );
}
```

**Auto-sync locations in BudgetApi:**
- Line 71: `createBudget$()` → `setHasBudget(true)`
- Line 90: `getAllBudgets$()` → `setHasBudget(budgets.length > 0)`
- Line 111: `checkBudgetExists$()` → `setHasBudget(response.hasBudget)`
- Line 215: `deleteBudget$()` → re-fetches `/exists` then `setHasBudget()`

### Dialog Handlers Requiring Manual Calls

| Dialog | Fichier | Ligne | Action |
|--------|---------|-------|--------|
| Create Budget | `budget-list-page.ts` | 282 | `state.refreshData()` |
| Create Budget (autre) | `budget-list-page.ts` | 321 | `state.refreshData()` |
| Delete Transaction | `current-month.ts` | 373 | Optimistic (OK) |
| Edit Transaction | `current-month.ts` | 418 | Optimistic (OK) |
| Add Budget Line | `budget-details-page.ts` | 333 | Store handles |
| Delete Budget Line | `budget-details-page.ts` | 387 | Store handles |
| Template Delete | `template-list-page.ts` | 215 | Manual |
| Template Line | `template-detail.ts` | 401, 461 | Manual |

### Cross-Store Invalidation: Missing

**Problème:**
```
1. User crée budget dans BudgetListPage
2. BudgetListStore.refreshData() ✓
3. CurrentMonthStore NOT invalidé ✗
4. User navigue vers CurrentMonth
5. Données potentiellement stales si même mois
```

### Solution: Event-Based Invalidation

```typescript
// core/budget/budget-events.service.ts (nouveau)
@Injectable({ providedIn: 'root' })
export class BudgetEventsService {
  readonly #budgetCreated = new Subject<Budget>();
  readonly #budgetDeleted = new Subject<string>();
  readonly #budgetUpdated = new Subject<Budget>();

  readonly budgetCreated$ = this.#budgetCreated.asObservable();
  readonly budgetDeleted$ = this.#budgetDeleted.asObservable();
  readonly budgetUpdated$ = this.#budgetUpdated.asObservable();

  emitCreated(budget: Budget): void { this.#budgetCreated.next(budget); }
  emitDeleted(budgetId: string): void { this.#budgetDeleted.next(budgetId); }
  emitUpdated(budget: Budget): void { this.#budgetUpdated.next(budget); }
}
```

```typescript
// budget-api.ts - Émettre événements
createBudget$(data: BudgetCreate): Observable<CreateBudgetApiResponse> {
  return this.#httpClient.post(...).pipe(
    tap(result => {
      this.#hasBudgetCache.setHasBudget(true);
      this.#budgetEvents.emitCreated(result.budget);  // NEW
    })
  );
}

deleteBudget$(budgetId: string): Observable<void> {
  return this.#httpClient.delete(...).pipe(
    tap(() => {
      this.#removeBudgetFromStorage(budgetId);
      this.#hasBudgetCache.setHasBudget(response.hasBudget);
      this.#budgetEvents.emitDeleted(budgetId);  // NEW
    })
  );
}

updateBudget$(budgetId: string, data: Partial<BudgetCreate>): Observable<Budget> {
  return this.#httpClient.patch(...).pipe(
    tap(result => {
      this.#saveBudgetIdToStorage(result.id);
      this.#budgetEvents.emitUpdated(result);  // NEW (actuellement aucune invalidation!)
    })
  );
}
```

```typescript
// budget-list-store.ts - Auto-invalidation
constructor() {
  // Auto-reload when budget changes
  this.#budgetEvents.budgetCreated$.pipe(
    takeUntilDestroyed()
  ).subscribe(() => this.budgets.reload());

  this.#budgetEvents.budgetDeleted$.pipe(
    takeUntilDestroyed()
  ).subscribe(() => this.budgets.reload());
}
```

```typescript
// current-month-store.ts - Auto-invalidation
constructor() {
  // Reload if current month budget was modified
  this.#budgetEvents.budgetUpdated$.pipe(
    takeUntilDestroyed(),
    filter(budget => this.#isCurrentMonthBudget(budget))
  ).subscribe(() => this.refreshData());
}
```

### Suppression du Code Manuel

**Avant (error-prone):**
```typescript
// budget-list-page.ts:282-286
if (result?.success) {
  this.state.refreshData();  // Développeur doit se souvenir
}
```

**Après (automatique):**
```typescript
// budget-list-page.ts:282-286
// Plus besoin de refreshData() - le store écoute les events
if (result?.success) {
  // Navigation ou notification seulement
}
```

### Alternative: Resource-Level Auto-Refresh (Minimal Change)

Si l'event bus semble over-engineered:

```typescript
// budget-list-store.ts - Trigger signal
readonly #invalidationTrigger = signal(0);

readonly budgets = resource({
  params: () => ({ trigger: this.#invalidationTrigger() }),
  loader: () => this.#budgetApi.getAllBudgets$()
});

invalidate(): void {
  this.#invalidationTrigger.update(v => v + 1);
}
```

Mais cela ne résout pas le cross-store problem.

### Fichiers à Créer/Modifier

| Fichier | Action |
|---------|--------|
| `core/budget/budget-events.service.ts` | **CRÉER** - Event bus |
| `core/budget/budget-events.service.spec.ts` | **CRÉER** - Tests |
| `core/budget/budget-api.ts` | Injecter et émettre events |
| `feature/budget/budget-list/budget-list-store.ts` | Subscribe aux events |
| `feature/current-month/services/current-month-store.ts` | Subscribe aux events |
| `feature/budget-templates/services/budget-templates-store.ts` | Subscribe aux events (si applicable) |
| `feature/budget/budget-list/budget-list-page.ts:282,321` | Supprimer `refreshData()` manuel |
| `feature/budget-templates/list/template-list-page.ts:215` | Supprimer `refreshData()` manuel |

### Comparaison des Approches

| Approche | Pros | Cons |
|----------|------|------|
| **Event Bus (Recommandé)** | Découplé, cross-store, scalable | Nouvelle abstraction |
| **Extend HasBudgetCache** | Simple, pattern existant | Ne scale pas pour listes |
| **Resource invalidation signal** | Minimal change | Pas de cross-store sync |

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Circular dependencies | LOW | HIGH | Services légers, bien scoped |
| Memory leaks | LOW | MEDIUM | `takeUntilDestroyed()` partout |
| Over-notification | LOW | LOW | Filter events par pertinence |

---

## Résumé des Actions

| Issue | Priorité | Effort | Impact | Dépendances |
|-------|----------|--------|--------|-------------|
| 1. localStorage objet → ID | 🔴 High | Low | Performance + simplicité | Aucune |
| 2. Ajouter TTL au cache | 🟡 Medium | Medium | Fiabilité données | Issue 1 first |
| 3. Event-based invalidation | 🟡 Medium | Medium | Maintenabilité | Aucune |

**Ordre d'implémentation recommandé:** 1 → 2 → 3

---

## Fichiers Clés (Référence Rapide)

### Storage
| Purpose | File | Lines |
|---------|------|-------|
| Storage keys | `core/storage/storage-keys.ts` | 14 |
| Storage service | `core/storage/storage.service.ts` | 43-91, 107-113 |
| Storage tests | `core/storage/storage.service.spec.ts` | * |

### Budget API
| Purpose | File | Lines |
|---------|------|-------|
| Budget API + storage | `core/budget/budget-api.ts` | 70, 144, 193, 208-221, 238-268 |
| Budget API tests | `core/budget/budget-api.spec.ts` | 88-91, 148-206 |
| HasBudgetCache | `core/auth/has-budget-cache.ts` | 1-33 |

### Stores avec Manual Refresh
| Purpose | File | Lines |
|---------|------|-------|
| Budget list store | `feature/budget/budget-list/budget-list-store.ts` | 157 |
| Current month store | `feature/current-month/services/current-month-store.ts` | 220 |
| Budget templates store | `feature/budget-templates/services/budget-templates-store.ts` | 54 |

### Dialog Handlers (à modifier Issue 3)
| Purpose | File | Lines |
|---------|------|-------|
| Budget list page | `feature/budget/budget-list/budget-list-page.ts` | 282, 321 |
| Template list page | `feature/budget-templates/list/template-list-page.ts` | 215 |
| Template detail | `feature/budget-templates/details/template-detail.ts` | 401, 461 |

### Reference Implementations
| Purpose | File | Lines |
|---------|------|-------|
| String storage pattern | `core/demo/demo-mode.service.ts` | 18-52 |
| Auto-sync pattern | `core/auth/has-budget-cache.ts` | 1-33 |
| Optimistic updates | `feature/budget/budget-details/store/budget-details-store.ts` | 161-209 |

---

## Technical Debt Observations

1. **Public method unused externally:** `getCurrentBudgetFromStorage()` devrait être private
2. **Naming inconsistency:** `CURRENT_BUDGET` implique "budget sélectionné" mais track le dernier écrit
3. **Missing JSDoc:** Aucune documentation sur why budget is stored ou migration strategy
4. **updateBudget$() has NO cache invalidation:** Ligne 184-203 - tous les stores gardent données stales

---

## Next Step

Run `/epct:plan 43-state-management-inconsistencies` to create implementation plan.
