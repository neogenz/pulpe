# Pulpe - Technical Context & Decision Records

> Technical decisions and stack details following MADR (Markdown Any Decision Records) 2026 standard.

---

## Tech Stack Overview

| Layer | Technology |
|-------|------------|
| Frontend | Angular 21+, Signals, Material 21, Tailwind v4 |
| Backend | NestJS 11+, Bun runtime |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Shared | TypeScript strict, Zod schemas |
| Orchestration | pnpm workspaces + Turborepo |

---

## Active Decisions

| ID | Title | Date | Status |
|----|-------|------|--------|
| DR-001 | Backend-First Demo Mode | 2024-06-15 | Accepted |
| DR-002 | Automated Demo Cleanup | 2024-06-15 | Accepted |
| DR-003 | Remove Variable Transaction Recurrence | 2024-07-20 | Accepted |
| DR-004 | Typed & Versioned Storage Service | 2024-11-10 | Pending |
| DR-005 | Cache-First Data Loading in Dashboard | 2026-01-30 | Accepted |
| DR-006 | Cache-First Budget Details & Full Preload | 2026-01-30 | Superseded by DR-009 |
| DR-007 | Eager Signal Reading in computed() with ?? | 2026-01-30 | Accepted |
| DR-008 | Keep imperative `#staleData` signal over alternatives | 2026-01-30 | Accepted |
| DR-009 | Selective + Lazy Cache Revalidation | 2026-01-30 | Accepted |
| DR-010 | Toggle Merge + No-Reload for Race Condition Fix | 2026-01-31 | Accepted |

---

## DR-010: Toggle Merge + No-Reload for Race Condition Fix

**Date**: 2026-01-31
**Status**: Accepted

### Context

Race condition bug discovered: when user toggles a transaction/budget line during a CRUD mutation (slow network), the toggle state is lost when mutation reconciles. This breaks user trust when their actions "disappear".

### Problem

**Bug #1**: Toggles overwritten during CRUD mutations
- `#performOptimisticMutation` reads `currentData` before toggle, calculates `updatedData`, then sets it → overwrites concurrent toggle in `checkedAt` field

**Bug #2**: Reload after toggle causes more race conditions
- Toggles called `#invalidateCache()` → triggers async reload
- If CRUD mutation happens during reload, either mutation or toggle gets overwritten

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Merge concurrent toggles | `mergeToggleStates()` helper preserves `checkedAt` from `latestData` while keeping structure from `updatedData` | Simple (15 LOC), preserves both toggle + mutation, no breaking changes |
| Remove reload after toggles | Delete `#invalidateCache()` calls in toggle methods | Toggles are UI-only (don't affect calculations), server is synced, next mutation reload will include toggle |
| Reject mutex queue | Not implemented | Would block user during mutations (bad UX), unnecessary complexity |
| Reject CRDT/OT | Not implemented | Overkill for simple last-write-wins on `checkedAt` field |

### Impact

**User Experience:**
- ✅ Toggles no longer lost during slow mutations
- ✅ Better performance (no reload after every toggle)
- ✅ Trust restored (actions don't "disappear")

**Technical:**
- ✅ 1082/1082 unit tests pass (2 new race condition tests added)
- ✅ 5/5 E2E cache invalidation tests pass
- ✅ No breaking changes (mutation behavior unchanged)
- ✅ Minimal code change (4 lines modified, 15 lines added)

**Code Changes:**
```typescript
// frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts

// 1. Helper function to merge toggle states (lines 25-48)
function mergeToggleStates<T extends { id: string; checkedAt: string | null }>(
  items: T[],
  latestItems: T[],
): T[] {
  const latestCheckedAtMap = new Map(
    latestItems.map((item) => [item.id, item.checkedAt]),
  );
  return items.map((item) => {
    const latestCheckedAt = latestCheckedAtMap.get(item.id);
    return latestCheckedAt !== undefined
      ? { ...item, checkedAt: latestCheckedAt }
      : item;
  });
}

// 2. Apply merge in #performOptimisticMutation (lines 321-334)
this.#dashboardResource.set({
  ...updatedData,
  budgetLines: mergeToggleStates(updatedData.budgetLines, latestData.budgetLines),
  transactions: mergeToggleStates(updatedData.transactions, latestData.transactions),
  budget: { /* ... */ }
});

// 3. Remove cache invalidation from toggles (lines 247, 275)
// - toggleBudgetLineCheck: removed #invalidateCache() call
// - toggleTransactionCheck: removed #invalidateCache() call
```

### Alternative Considered

**Queue-based locking** (rejected): Would serialize all operations, blocking user during mutations. Poor UX for a problem solved simply by merging state.

---

## DR-009: Selective + Lazy Cache Revalidation

**Date**: 2026-01-30
**Status**: Accepted
**Supersedes**: DR-006 (revalidation strategy only — cache-first display unchanged)

### Context

After every budget mutation, `BudgetCache.#revalidate()` cleared the entire cache and re-fetched the list + all budget details (1 + N API calls). For 12 budgets, that meant 13 API calls per single edit. Disproportionate given only the list summary actually needs fresh data immediately.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Revalidation re-fetches list only | 1 API call instead of 1 + N | List summary (remaining, balance) changes on every mutation — must be fresh |
| Mark detail entries as stale, don't delete them | `#staleDetailIds` signal | Stale data remains available for instant display via `#staleData` (DR-008) |
| Lazy re-fetch details on navigation | `preloadBudgetDetails()` re-fetches stale entries | Detail is only needed when user actually navigates to it |
| Resource loader skips stale cache hits | `!isBudgetDetailStale(id)` guard | Forces API call for stale entries while allowing fresh cache hits |
| Initial preload unchanged | Still loads list + all details at login | First load fills cache for zero-spinner navigation across all months |

### Two Invalidation Strategies

Different stores use different invalidation strategies based on their use case:

**Strategy A: Eager Reload (Version-Based)**
```typescript
// Example: BudgetListStore, CurrentMonthStore
resource({
  params: () => ({ version: invalidationService.version() })
})
```
- **When:** Data displayed immediately after mutation (list pages, current month dashboard)
- **How:** Include `version` in resource params → auto-reload when version increments
- **Trade-off:** More API calls, always fresh data
- **Use case:** Pages where mutations happen frequently and fresh data is critical

**Strategy B: Lazy Stale Marking**
```typescript
// Example: BudgetDetailsStore
loader: async ({ params }) => {
  if (cached && !isStale(id)) return cached;
  return await fetchFresh();
}
```
- **When:** Detail pages where freshness can wait until next access
- **How:** Mark cache as stale but don't reload until user navigates to that budget
- **Trade-off:** Fewer API calls, may show stale data briefly on next access
- **Use case:** Historical budget details that rarely change after creation

**Decision:** Use Strategy A for lists/dashboards, Strategy B for detail pages.

### API Call Volume Comparison

| Scenario | Before (DR-006) | After (DR-009) |
|----------|-----------------|----------------|
| Edit in budget details | 1 + N (list + all details) | 1 (list only) |
| Navigate to another budget | 0 (already re-fetched) | 1 (lazy fetch) |
| Total for edit + 1 navigation | N + 1 | 2 |

### Consequences

- **Positive**: ~85% fewer API calls after mutations (13 → 2 for typical 12-budget user)
- **Positive**: Stale data still provides instant display — no spinner regression
- **Trade-off**: Navigating to a budget after mutation triggers 1 extra API call (vs 0 with full bust) — acceptable since the data shown is guaranteed fresh
- **Impact**: `budget-cache.ts`, `budget-details-store.ts`

### Sources

- Inspired by TanStack Query's stale-while-revalidate pattern
- DR-006 for original cache-first display strategy
- DR-008 for `#staleData` instant display mechanism

---

## DR-008: Keep imperative `#staleData` signal over alternatives

**Date**: 2026-01-30
**Status**: Accepted

### Context

Evaluated alternatives to the `#staleData = signal<T | null>(null)` pattern used in `budget-details-store.ts` and `template-details-store.ts` for cache-first display.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Keep imperative `signal()` seeded in `setBudgetId()` | `#staleData` signal | Precise reactivity, no timing issues, clear intent |
| Reject `resource.update()` seeding (Option B) | Not viable | Resource effect on microtask wipes value to `undefined` on param change |
| Reject `linkedSignal` reading cache (Option A) | Functional but imprecise | Tracks entire `#budgetDetailsMap` signal → réévalues on any budget preload/invalidation |
| Reject computed reading cache (Option C) | Same problem as A | Same dependency on the cache Map signal |

### Alternatives Evaluated

**Option B — `resource.update()` to seed cached value**: Broken. `setBudgetId()` sets params synchronously, then `resource.update()` seeds the value. But the resource effect runs on the next microtask, detects new params, transitions to `'loading'`, and wipes `value` to `undefined`. Confirmed by [angular/angular#58602](https://github.com/angular/angular/issues/58602).

**Option A — `linkedSignal` reading `BudgetCache`**: `linkedSignal(() => cache.getBudgetDetails(budgetId))` works but `getBudgetDetails()` reads `#budgetDetailsMap()` internally, so the linkedSignal tracks the entire Map. Any preload or invalidation of *another* budget triggers re-evaluation.

**Option C — `computed` reading cache**: Same Map dependency problem as Option A.

### Consequences

- **Positive**: No over-reactivity, no race condition, signal represents "last known stale data" explicitly
- **Trade-off**: Imperative `.set()` call in `setBudgetId()` — less declarative than reactive alternatives
- **Impact**: `budget-details-store.ts`, `template-details-store.ts`

### Sources

- [angular/angular#58602 — resource value wiped on param change](https://github.com/angular/angular/issues/58602)
- [Angular resource API — status/value behavior](https://angular.dev/guide/signals/resource)

---

## DR-007: Eager Signal Reading in computed() with ??

**Date**: 2026-01-30
**Status**: Accepted

### Context

Angular's `computed()` tracks dependencies dynamically — only signals actually read during the last evaluation are tracked. JavaScript's `??` operator short-circuits: `A ?? B` skips reading B when A is non-null, causing Angular to stop tracking B as a dependency.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Read all signals eagerly before `??` | Assign to local variables first | Ensures both signals are always tracked regardless of short-circuit |
| Boolean `&&` / `\|\|` are safe as-is | No fix needed | Short-circuit cannot produce incorrect boolean result |
| `??` with data signals requires eager read | Mandatory pattern | Stale context can cause wrong data to be returned |

### Problem

```typescript
// BUG: if resource.value() is non-null, #staleData() is never tracked
readonly details = computed(() => this.resource.value() ?? this.#staleData());
```

When navigating between entities, `#staleData` updates to new context but the computed doesn't re-evaluate because `#staleData` isn't tracked.

### Decision

Always read all signals into local variables before applying `??`:

```typescript
readonly details = computed(() => {
  const fresh = this.resource.value();
  const stale = this.#staleData();
  return fresh ?? stale ?? null;
});
```

### Consequences

- **Positive**: Eliminates a class of subtle reactivity bugs
- **Trade-off**: Slightly more verbose computed expressions
- **Impact**: `budget-details-store.ts`, `template-details-store.ts`

---

## DR-006: Cache-First Budget Details & Full Preload

**Date**: 2026-01-30
**Status**: Accepted (revalidation strategy superseded by DR-009)

### Context

Budget details page showed a spinner on every navigation, even for cached data. Three root causes: (a) `BudgetDetailsStore` provided at component level → recreated on every navigation, (b) `resource()` always enters loading state for at least one tick, (c) only current month was preloaded.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Seed cached data in `setBudgetId()` | `#staleData` signal populated from `BudgetCache` | Provides instant display before resource loader runs |
| Distinguish initial loading from reloading | `isInitialLoading = isLoading && !budgetDetails()` | Spinner only when truly no data available |
| Preload all budget details at startup | `preloadBudgetDetails(allIds)` in `AppPreloader` | Maximizes cache hits across all months |
| Keep store at component level | No architecture change | Follows feature isolation rules |

### Problem

`resource()` always transitions through loading state when params change. Template `@if (store.isLoading())` showed spinner even when cache had data. `AppPreloader` only preloaded current month — other months triggered real API calls.

### Decision

- `setBudgetId()` checks `BudgetCache` synchronously and populates `#staleData` signal
- `budgetDetails` computed falls back to `#staleData` when resource is loading
- `isInitialLoading` only true when loading AND no cached data exists
- `AppPreloader` preloads all budget IDs in parallel

### Consequences

- **Positive**: No spinner flash for cached budgets, all months preloaded in parallel
- **Trade-off**: All budget details loaded at startup (acceptable: typical users have 12-24 budgets)
- **Impact**: `budget-details-store.ts`, `budget-details-page.html`, `app-preloader.ts`

---

## DR-005: Cache-First Data Loading in Dashboard

**Date**: 2026-01-30
**Status**: Accepted

### Context

Le dashboard rechargait `GET /budgets` à chaque navigation (retour depuis Budgets, Modèles, etc.) malgré un système de cache (`BudgetCache`) et un preloader (`AppPreloader`) déjà en place.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data loader vérifie le cache avant l'API | Cache-first lookup dans `createDashboardDataLoader` | Même pattern que `BudgetListStore` et `BudgetDetailsStore` |
| `getBudgetForMonth$` reste inchangé | Fallback API conservé | Évite les régressions sur les autres consommateurs |
| Race condition initiale acceptée | Pas de restructuration de l'init | Ne se produit qu'une fois au login/reload |

### Problem

`current-month-data-loader.ts` appelait `budgetApi.getBudgetForMonth$()` qui exécute systématiquement `getAllBudgets$()` (HTTP GET brut), ignorant le cache `BudgetCache.budgets()` rempli par le preloader. Chaque retour au dashboard déclenchait un appel réseau inutile.

### Decision

Le data loader consulte d'abord `budgetCache.budgets()` pour trouver le budget du mois courant. Si le cache contient les données, aucun appel HTTP. Le fallback API reste en place pour les cache miss.

### Rationale

- Le pattern cache-first existait déjà dans `BudgetListStore` (ligne 179) et `BudgetDetailsStore` (ligne 148) — seul le dashboard ne l'appliquait pas
- Le preloader remplit le cache au login, donc les navigations suivantes sont instantanées
- Changement minimal (1 fichier) avec impact maximal sur la réactivité perçue

### Consequences

- **Positive**: 0 requêtes réseau lors des navigations inter-écrans après le chargement initial
- **Trade-off**: Doublon `GET /budgets` au premier chargement (race preloader/store) — accepté
- **Impact**: `current-month-data-loader.ts` uniquement

---

## DR-001: Backend-First Demo Mode

**Date**: 2024-06-15
**Status**: Accepted

### Problem

Needed demo mode for product exploration without signup.

### Decision Drivers

- Must behave identically to production
- Cannot maintain parallel frontend-only simulation
- Must reuse existing RLS policies

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Real ephemeral users | Create Supabase users with `is_demo: true` | Chosen |
| B: Frontend localStorage mock | Simulate state in browser | Rejected |

### Decision

Create real ephemeral Supabase users with JWT tokens.

### Rationale

- Guarantees identical behavior to production (no simulation drift)
- Reuses existing RLS policies and business logic
- Simplifies frontend (same code paths for demo/real users)

### Consequences

- **Positive**: No simulation drift, full backend validation
- **Trade-off**: Requires cleanup cron job (see DR-002)
- **Dependencies**: Supabase Auth, RLS policies

### Notes

Stack-specific: Supabase cascade delete handles cleanup of related tables automatically.

---

## DR-002: Automated Demo Cleanup Strategy

**Date**: 2024-06-15
**Status**: Accepted

### Problem

Need to prevent database bloat from abandoned demo users.

### Decision Drivers

- Must run automatically without manual intervention
- Should balance cleanup frequency vs DB load
- Must not affect active demo sessions

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Automated cron job | Every 6 hours, 24h retention | Chosen |
| B: Manual cleanup only | Admin triggers manually | Rejected |

### Decision

Automated cron job cleanup with:
- Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Retention: 24 hours from user creation
- Manual endpoint: Dev-only for testing/emergency cleanup

### Rationale

- 24h retention: Sufficient exploration time without excessive DB usage
- 6h interval: Balances cleanup frequency vs DB load
- Supabase cascade delete: Automatic cleanup of budgets/transactions/templates

### Consequences

- **Positive**: Zero maintenance overhead
- **Trade-off**: Users lose demo data after 24h (acceptable for demo)
- **Dependencies**: Supabase scheduled functions, cascade delete

### Notes

Consider adding warning toast at 23h mark if user session is still active.

---

## DR-003: Remove Variable Transaction Recurrence

**Date**: 2024-07-20
**Status**: Accepted

### Problem

Initial design included `monthly`/`one_off` recurrence for transactions, adding unnecessary complexity.

### Decision Drivers

- Aligns with "Planning > Tracking" philosophy
- Reduces frontend/backend complexity
- YAGNI principle

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Remove recurrence | Transactions always one-off | Chosen |
| B: Keep recurrence | Support recurring transactions | Rejected |

### Decision

Remove recurrence entirely from transactions:
- Budget lines: Keep frequency (`fixed`/`one_off`) for planning
- Transactions: Always one-off manual entries

### Rationale

- Budget lines = plan, transactions = reality
- Recurring patterns belong in templates/budget lines, not transactions
- Simplifies transaction model significantly

### Consequences

- **Positive**: Cleaner separation between planning and tracking
- **Trade-off**: No automated recurring transaction support
- **Impact**: Removed `recurrence` column from transaction table

### Notes

If users request recurring transactions in future, implement as "auto-generated budget lines" rather than transaction recurrence.

---

## DR-004: Typed & Versioned Storage Service

**Date**: 2024-11-10
**Status**: Pending

### Problem

Bug de fuite de données entre utilisateurs (données localStorage persistantes après logout). Fix initial par nettoyage des clés `pulpe-*` mais approche fragile.

### Decision Drivers

- Type-safety required for compile-time errors
- Need automatic migrations when schema changes
- Must distinguish user-scoped vs app-scoped data

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Typed storage service | Centralized registry with versioning | Chosen |
| B: Prefix convention | Clean `pulpe-*` keys on logout | Rejected |

### Decision

Implement a typed storage service with:
- Centralized registry with strong typing
- Zod validation on read
- Versioning per key: `{ version, data, updatedAt }`
- Automatic migrations at startup
- `user-scoped` vs `app-scoped` distinction

### Rationale

- Type-safety: Compile-time errors for wrong key/value
- Evolvability: Automatic migrations on schema changes
- Maintainability: Single source of truth for all keys
- Debugging: Versioning enables state tracing

### Consequences

- **Positive**: Eliminates class of storage bugs
- **Trade-off**: Initial implementation overhead
- **Dependencies**: Zod schemas

### Notes

Implementation pending. Priority: Medium (bug was hotfixed, this is preventive).

---

*See `systemPatterns.md` for architecture patterns.*
*See `INFRASTRUCTURE.md` for deployment and CI/CD.*
