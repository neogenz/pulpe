# Cache & State Management Pattern Implementation

> Complete architecture guide for Pulpe's cache and state management system using Angular 21+ Signals.

**Last Updated:** 2026-01-31
**Author:** Architecture Review
**Status:** Production

---

## Table of Contents

1. [Overview](#overview)
2. [Three-Layer Architecture](#three-layer-architecture)
3. [The Data Flow Journey](#the-data-flow-journey)
4. [Critical Implementation Details](#critical-implementation-details)
5. [The Two Invalidation Strategies](#the-two-invalidation-strategies)
6. [Store Pattern Guide](#store-pattern-guide)
7. [Testing Patterns](#testing-patterns)
8. [Design Principles](#design-principles)
9. [Common Pitfalls](#common-pitfalls)

---

## Overview

Pulpe uses a **signal-based reactive state management system** with three architectural layers:

1. **Feature Stores** (lazy-loaded, component-scoped) - User interactions and UI state
2. **Core Cache** (eager-loaded, singleton) - Global data persistence and coordination
3. **API Layer** (Observable-based) - HTTP communication with backend

**Key Characteristics:**
- Zero external state management libraries (no NgRx, no TanStack Query)
- Angular 21+ native signals for reactivity
- Stale-While-Revalidate (SWR) for instant navigation
- Optimistic updates for premium UX
- Appropriate complexity (simple where possible, advanced where needed)

---

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FEATURE STORES                            │
│  (BudgetDetailsStore, CurrentMonthStore, etc.)              │
│  ──────────────────────────────────────────────────────────  │
│  • Component-scoped (@Injectable, not providedIn: 'root')   │
│  • Created on navigation, destroyed on leave                │
│  • Optimistic updates for instant feedback                  │
│  • Coordinates with global cache                            │
└──────────────────┬──────────────────────────────────────────┘
                   │ inject()
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    CORE CACHE LAYER                          │
│  (BudgetCache, TemplateCache, InvalidationService)          │
│  ──────────────────────────────────────────────────────────  │
│  • Global singleton (@Injectable({ providedIn: 'root' }))   │
│  • Survives navigation (persists across page changes)       │
│  • Reactive invalidation (toObservable + subscription)      │
│  • Preloading & deduplication                                │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP calls
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                         API LAYER                            │
│  (BudgetApi, TransactionApi, etc.)                          │
│  ──────────────────────────────────────────────────────────  │
│  • Observable-based HTTP requests                           │
│  • No caching logic (separation of concerns)                │
└─────────────────────────────────────────────────────────────┘
```

### Why This Separation?

| Layer | Lifecycle | Purpose | Scope |
|-------|-----------|---------|-------|
| **Feature Stores** | Component-scoped | UI state, user interactions | Single page/feature |
| **Core Cache** | Application-scoped | Data persistence, coordination | Entire app |
| **API Layer** | Stateless | Server communication | Network boundary |

**Key Insight:** Feature stores can be destroyed and recreated without data loss because the cache layer persists.

---

## The Data Flow Journey

### Example: User Opens Budget Details Page

```typescript
┌─────────────────────────────────────────────────────────────┐
│ 1. NAVIGATION: /budgets/abc123                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. COMPONENT: BudgetDetailsPage created                     │
│                                                              │
│    @Component({                                             │
│      providers: [BudgetDetailsStore], // ← New instance     │
│    })                                                        │
│    export class BudgetDetailsPage {                         │
│      readonly store = inject(BudgetDetailsStore);           │
│                                                              │
│      ngOnInit() {                                           │
│        const id = this.route.snapshot.params['id'];         │
│        this.store.setBudgetId(id); // ← Triggers flow       │
│      }                                                       │
│    }                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. STORE: Cache-first lookup                                │
│                                                              │
│    setBudgetId(budgetId: string): void {                    │
│      // Step A: Check global cache (synchronous)            │
│      const cached = this.#budgetCache                       │
│        .getBudgetDetails(budgetId);                         │
│                                                              │
│      // Step B: Seed stale data BEFORE params change        │
│      this.#swr.setStaleData(                                │
│        cached ? { ...cached.budget, ... } : null            │
│      );                                                      │
│                                                              │
│      // Step C: Change params → triggers resource           │
│      this.#state.budgetId.set(budgetId);                    │
│    }                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RESOURCE: Loader executes                                │
│                                                              │
│    loader: async ({ params: budgetId }) => {                │
│      const cached = this.#budgetCache                       │
│        .getBudgetDetails(budgetId);                         │
│                                                              │
│      // Check cache freshness (DR-009)                      │
│      if (cached && !this.#budgetCache                       │
│          .isBudgetDetailStale(budgetId)) {                  │
│        return cached; // ✅ Fresh cache: no API call        │
│      }                                                       │
│                                                              │
│      // Cache miss or stale: fetch from API                 │
│      const response = await firstValueFrom(                 │
│        this.#budgetApi.getBudgetWithDetails$(budgetId)      │
│      );                                                      │
│      return response.data;                                  │
│    }                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SWR WRAPPER: Computes display data (DR-006)              │
│                                                              │
│    const data = computed<T | null>(() => {                  │
│      const fresh = this.#resource.value();                  │
│      const stale = this.#staleData();                       │
│      return fresh ?? stale ?? null;                         │
│    });                                                       │
│                                                              │
│    Priority: fresh > stale > null                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. TEMPLATE: Renders                                        │
│                                                              │
│    @if (store.budgetDetails(); as details) {                │
│      <!-- Data from step 5 (fresh or stale) -->             │
│      <div>{{ details.name }}</div>                          │
│    }                                                         │
│    @if (store.isInitialLoading()) {                         │
│      <!-- Only shows if no data available -->               │
│      <spinner />                                            │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘

RESULT:
- Cached: 0 API calls, instant display (2ms)
- Stale: 0 API calls initially, 1 API call in background, smooth update
- Miss: 1 API call, instant display if stale data exists
```

### Timeline: Cached Data (Happy Path)

```
0ms    User clicks link
1ms    Component created
1ms    setBudgetId() called
1ms    ├─ Cache check → Found fresh cache
1ms    ├─ setStaleData(cached) → Stale signal set
1ms    └─ budgetId.set() → Params change
2ms    Resource loader starts
2ms    ├─ Cache check → Fresh (not stale)
2ms    └─ Return cached data (no HTTP)
2ms    Template renders with cached data
       ✅ NO SPINNER, instant display
```

### Timeline: Stale Data (Background Revalidation)

```
0ms    User clicks link
1ms    setBudgetId() called
1ms    ├─ Cache check → Found STALE cache
1ms    ├─ setStaleData(stale) → Old data displayed
1ms    └─ budgetId.set() → Params change
2ms    Template renders STALE data
       ✅ Instant display (no spinner)
2ms    Resource loader starts
2ms    ├─ Cache check → Stale (needs refresh)
5ms    ├─ HTTP GET /budgets/abc123 starts
205ms  └─ Fresh data arrives
206ms  Template updates smoothly
       ✅ Data freshness guaranteed, UX uninterrupted
```

---

## Critical Implementation Details

### Detail #1: Signal Read Order Matters

**The Bug:**

```typescript
// ❌ SHORT-CIRCUIT PREVENTS TRACKING
const data = computed(() =>
  this.resource.value() ?? this.#staleData()
);

// When resource.value() is non-null:
// - #staleData() is NEVER called (JavaScript short-circuit)
// - Angular doesn't track #staleData as dependency
// - If #staleData changes, computed won't re-evaluate

// Real-world impact:
// User on January budget (resource has data)
// Navigate to February → setStaleData(febCache) called
// computed() doesn't re-evaluate (staleData not tracked)
// User still sees January data! 😢
```

**The Fix (DR-007):**

```typescript
// ✅ EAGER READ ENSURES TRACKING
const data = computed(() => {
  const fresh = this.resource.value();  // Always read
  const stale = this.#staleData();      // Always read
  return fresh ?? stale ?? null;        // Then apply logic
});

// Both signals are ALWAYS read
// Angular tracks both as dependencies
// Changes to either signal trigger re-evaluation ✅
```

**Pattern Rule:** In `computed()`, always read all signals before applying conditional logic (`??`, `&&`, `||`).

---

### Detail #2: setStaleData() Must Come BEFORE setBudgetId()

**The Order:**

```typescript
// ✅ CORRECT ORDER
setBudgetId(budgetId: string): void {
  const cached = this.#budgetCache.getBudgetDetails(budgetId);

  this.#swr.setStaleData(cached ? {...} : null); // FIRST
  this.#state.budgetId.set(budgetId);            // SECOND
}

// ❌ WRONG ORDER (causes spinner flash)
setBudgetId(budgetId: string): void {
  const cached = this.#budgetCache.getBudgetDetails(budgetId);

  this.#state.budgetId.set(budgetId);            // FIRST
  this.#swr.setStaleData(cached ? {...} : null); // SECOND
}
```

**Why This Matters:**

```typescript
// Signals involved:
#state.budgetId → params() → resource.value() → data() → isInitialLoading()

// WRONG order signal cascade:
Step 1: budgetId.set('new')
        ↓
        params() changes
        ↓
        resource.value() → undefined (loading starts)
        ↓
        data() re-evaluates: fresh=undefined, stale=null → returns null
        ↓
        isInitialLoading() re-evaluates: isLoading=true && data=null → TRUE
        ↓
        SPINNER SHOWS 😢

Step 2: setStaleData(cached)
        ↓
        data() re-evaluates: fresh=undefined, stale=cached → returns cached
        ↓
        isInitialLoading(): isLoading=true && data=cached → FALSE
        ↓
        Spinner disappears (1-2ms flash)

// CORRECT order signal cascade:
Step 1: setStaleData(cached)
        ↓
        staleData signal set (but nothing re-evaluates yet)

Step 2: budgetId.set('new')
        ↓
        params() changes
        ↓
        resource.value() → undefined (loading starts)
        ↓
        data() re-evaluates: fresh=undefined, stale=cached → returns cached
        ↓
        isInitialLoading(): isLoading=true && data=cached → FALSE
        ↓
        NO SPINNER ✅
```

**Rule:** When seeding stale data, set it **before** changing resource params.

---

### Detail #3: skip(1) Prevents False Invalidation

**The Pattern:**

```typescript
@Injectable({ providedIn: 'root' })
export class BudgetCache {
  constructor() {
    toObservable(this.#invalidationService.version)
      .pipe(
        skip(1),              // ← Skip initial emission
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.markAllDetailsStale();
        this.#listCache.invalidate();
      });
  }
}
```

**Why skip(1)?**

```typescript
// WITHOUT skip(1):
App initializes
├─ InvalidationService created → version = signal(0)
├─ BudgetCache created
│  └─ toObservable(version) emits initial value: 0
│      └─ Subscription fires
│          └─ markAllDetailsStale() called
│              └─ All cache marked stale on startup! 😢

// WITH skip(1):
App initializes
├─ InvalidationService created → version = signal(0)
├─ BudgetCache created
│  └─ toObservable(version) emits initial value: 0 → SKIPPED ✅
│
First mutation
├─ invalidate() called → version.update(v => v + 1) → version = 1
└─ toObservable emits: 1 (first non-skipped emission)
    └─ Subscription fires
        └─ markAllDetailsStale() ✅
```

**Rule:** When converting signal to observable for side effects, use `skip(1)` to ignore initial value.

---

### Detail #4: Atomic set() vs Sequential update() Calls

**The Problem:**

```typescript
// ❌ RACE CONDITION: Multiple set/update calls
async mutation() {
  const updated = transform(data);
  this.resource.set(updated);        // First set

  const serverData = await fetch();
  this.resource.update(d => ({       // Second update (race window!)
    ...d,
    serverField: serverData
  }));
}

// If concurrent mutation happens between the two:
0ms:   First set(updated) - resource has updated data
50ms:  Concurrent mutation modifies resource
100ms: Second update() - reads concurrent mutation, overwrites it!
```

**The Solution:**

```typescript
// ✅ ATOMIC: Single set() at the end
async mutation() {
  const updated = transform(data);
  const serverData = await fetch();
  const latestData = this.resource.value(); // Read latest just before set

  // Single atomic set with all changes
  this.resource.set({
    ...updated,
    serverField: serverData,
    // Preserve concurrent changes:
    budgetLines: mergeToggleStates(updated.budgetLines, latestData.budgetLines),
  });
}
```

**Pattern:** One `set()` call at the end = atomic merge of all concurrent changes.

**Location:** `current-month-store.ts:318-342`

---

### Detail #5: The Toggle Merge Pattern

**Problem:** User toggles items while mutations are in-flight.

**Example Scenario:**

```
0ms:   User clicks "Add transaction" (API call starts, takes 200ms)
50ms:  User toggles budget line (API call starts, takes 150ms)
200ms: Toggle completes → checkedAt updated
250ms: Create completes → Response has snapshot from 0ms (before toggle)
       ⚠️  Need to preserve toggle state from 200ms
```

**The mergeToggleStates() Function:**

```typescript
/**
 * Preserves concurrent toggle updates during mutation reconciliation.
 *
 * @param items - Items with mutation applied (from reconcile callback)
 * @param latestItems - Items with latest toggle states (from current resource value)
 * @returns Merged items with mutation + latest toggle states
 */
function mergeToggleStates<T extends { id: string; checkedAt: string | null }>(
  items: T[],
  latestItems: T[],
): T[] {
  // Create lookup map for O(1) access to latest checkedAt values
  const latestCheckedAtMap = new Map(
    latestItems.map((item) => [item.id, item.checkedAt]),
  );

  return items.map((item) => {
    const latestCheckedAt = latestCheckedAtMap.get(item.id);
    if (latestCheckedAt !== undefined) {
      // Preserve structure from items, but use checkedAt from latestItems
      return { ...item, checkedAt: latestCheckedAt };
    }
    return item; // New item (not in latestItems) - keep as is
  });
}
```

**How It Works:**

```
items (from reconcile):          latestItems (from resource):
[                                [
  { id: '1', amt: 100, checkedAt: null },    { id: '1', amt: 50, checkedAt: '2026-01-31' },
  { id: 'new', amt: 200, checkedAt: null }   // doesn't have 'new' (was added)
]                                ]
           ↓                              ↓
           └──── mergeToggleStates ───────┘
                        ↓
                  RESULT:
                  [
                    { id: '1', amt: 100, checkedAt: '2026-01-31' }, ← Toggle preserved, amount from reconcile
                    { id: 'new', amt: 200, checkedAt: null }        ← New item kept
                  ]
```

**Key Insight:**
- Structure (budgetLines array, amounts, IDs) comes from `items` (has the mutation)
- Toggle state (`checkedAt`) comes from `latestItems` (has concurrent toggles)
- Best of both worlds

**When to Use:**
- ✅ CurrentMonthStore - High interaction frequency, concurrent toggles common
- ⚠️ BudgetDetailsStore - Low concurrency, merge not needed (yet)

**Location:** `current-month-store.ts:33-48` (will be extracted to `core/cache/merge-toggles.ts`)

---

## The Two Invalidation Strategies

### Overview

Different stores use different strategies based on **when data is needed after mutation**.

| Strategy | When to Use | Implementation | Trade-off |
|----------|-------------|----------------|-----------|
| **Version-Based Eager Reload** | Data displayed immediately | Include `version` in params | More API calls, always fresh |
| **Lazy Stale Marking** | Data accessed later | Check `isBudgetDetailStale()` | Fewer API calls, may show stale |

See **DR-009** in `memory-bank/techContext.md` for full decision context.

---

### Strategy A: Version-Based (Eager Reload)

**Implementation:**

```typescript
// Example: BudgetListStore, CurrentMonthStore
readonly #resource = resource<Data, { params, version }>({
  params: () => ({
    month: this.currentMonth(),
    year: this.currentYear(),
    version: this.#invalidationService.version(), // ← Reactivity trigger
  }),
  loader: async ({ params }) => {
    // Fetch fresh data (no cache check needed)
    return await fetchFresh(params);
  },
});
```

**How It Works:**

```
Mutation occurs
└─→ invalidationService.invalidate()
    └─→ version: 5 → 6
        └─→ Resource params: { ..., version: 5 } → { ..., version: 6 }
            └─→ Angular detects param change
                └─→ Resource transitions: 'resolved' → 'loading'
                    └─→ Loader executes automatically
                        └─→ Fresh API call
                            └─→ UI updates
```

**Pros:**
- Automatic reload (no manual `reload()` calls)
- Always fresh data after mutations
- Declarative (version in params = "react to invalidation")

**Cons:**
- API call happens even if user navigated away
- Cannot prevent reload (params changed = must reload)

**Use Cases:**
- **BudgetListStore:** List displayed in sidebar, always visible
- **CurrentMonthStore:** Dashboard where user actively works

---

### Strategy B: Lazy Stale Marking

**Implementation:**

```typescript
// Example: BudgetDetailsStore
readonly #budgetDetailsResource = resource<Data, string | null>({
  params: () => this.#state.budgetId(), // NO version param
  loader: async ({ params: budgetId }) => {
    if (!budgetId) throw new Error('Budget ID required');

    // Check cache freshness
    const cached = this.#budgetCache.getBudgetDetails(budgetId);
    if (cached && !this.#budgetCache.isBudgetDetailStale(budgetId)) {
      return cached; // Fresh cache: skip API
    }

    // Stale or missing: fetch from API
    const response = await firstValueFrom(
      this.#budgetApi.getBudgetWithDetails$(budgetId)
    );
    return response.data;
  },
});
```

**How Cache Becomes Stale:**

```typescript
// BudgetCache listens to version changes:
toObservable(this.#invalidationService.version)
  .pipe(skip(1), takeUntilDestroyed())
  .subscribe(() => {
    this.markAllDetailsStale(); // Mark all entries as stale
  });

// markAllDetailsStale():
markAllDetailsStale(): void {
  const currentIds = this.#budgetDetailsMap().keys();
  this.#staleDetailIds.set(new Set(currentIds)); // Add all IDs to stale set
}
```

**Flow:**

```
Mutation occurs
└─→ invalidationService.invalidate()
    └─→ version: 5 → 6
        └─→ BudgetCache subscription fires
            └─→ markAllDetailsStale()
                └─→ All cached budgets marked as stale
                    └─→ NO reload happens yet (params unchanged)

Later: User navigates to budget abc123
└─→ setBudgetId('abc123')
    └─→ Resource loader executes
        └─→ Cache check: isBudgetDetailStale('abc123') → TRUE
            └─→ Skips cache, fetches fresh from API
                └─→ UI gets fresh data
```

**Pros:**
- Fewer API calls (only when accessing stale data)
- Stale data still available for instant display (SWR)
- Efficient for data that's not always viewed

**Cons:**
- May show stale data briefly on first access
- Requires manual cache freshness check in loader

**Use Cases:**
- **BudgetDetailsStore:** Historical budget details rarely viewed after mutation

---

### Choosing the Right Strategy

```
┌─────────────────────────────────────────┐
│ Is data displayed immediately           │
│ after mutation?                         │
└─────────────┬───────────────────────────┘
              │
        ┌─────┴─────┐
        │           │
       YES         NO
        │           │
        ▼           ▼
┌───────────────┐  ┌────────────────────┐
│ Strategy A:   │  │ Strategy B:        │
│ Version-Based │  │ Lazy Stale Marking │
│ Eager Reload  │  │                    │
│               │  │ Examples:          │
│ Examples:     │  │ • BudgetDetails    │
│ • BudgetList  │  │ • TemplateDetails  │
│ • CurrentMonth│  │                    │
└───────────────┘  └────────────────────┘
```

**Rule of Thumb:** Prefer Strategy B (lazy) unless immediate freshness is required.

---

## Store Pattern Guide

### Standard Store Template

```typescript
@Injectable() // NOT providedIn: 'root' (feature-scoped)
export class MyFeatureStore {
  // ──────────────────────────────────────────────
  // 1. DEPENDENCIES (inject at top)
  // ──────────────────────────────────────────────
  readonly #api = inject(MyFeatureApi);
  readonly #cache = inject(MyCache);
  readonly #invalidationService = inject(BudgetInvalidationService);
  readonly #logger = inject(Logger);

  // ──────────────────────────────────────────────
  // 2. INTERNAL STATE (private writable signals)
  // ──────────────────────────────────────────────
  readonly #state = signal<MyState>(createInitialState());

  // ──────────────────────────────────────────────
  // 3. RESOURCE (async data loading)
  // ──────────────────────────────────────────────
  readonly #resource = resource<MyData, Params>({
    params: () => this.#state.myParam(),
    loader: async ({ params }) => {
      // Cache-first lookup (if applicable)
      const cached = this.#cache.get(params.id);
      if (cached && !this.#cache.isStale(params.id)) {
        return cached;
      }

      // Fetch fresh from API
      const response = await firstValueFrom(
        this.#api.getData$(params)
      );
      return response.data;
    },
  });

  // ──────────────────────────────────────────────
  // 4. SWR WRAPPER (if cache-first display needed)
  // ──────────────────────────────────────────────
  readonly #swr = createStaleFallback({
    resource: this.#resource,
  });

  // ──────────────────────────────────────────────
  // 5. PUBLIC SELECTORS (readonly computed)
  // ──────────────────────────────────────────────
  readonly data = this.#swr.data;
  readonly isLoading = this.#swr.isInitialLoading; // Not isLoading!
  readonly hasValue = this.#swr.hasValue;
  readonly error = computed(() =>
    this.#resource.error() || this.#state.errorMessage()
  );

  // Derived selectors
  readonly totalAmount = computed(() =>
    this.data()?.items.reduce((sum, item) => sum + item.amount, 0) ?? 0
  );

  // ──────────────────────────────────────────────
  // 6. PUBLIC ACTIONS (mutations)
  // ──────────────────────────────────────────────

  // Initialize pattern (cache-first)
  setId(id: string): void {
    const cached = this.#cache.get(id);
    this.#swr.setStaleData(cached); // BEFORE params change!
    this.#state.id.set(id);
  }

  // CRUD mutations
  async createItem(item: ItemCreate): Promise<void> {
    return this.#runMutation({
      optimisticUpdate: (data) => addItem(data, tempItem),
      apiCall: () => firstValueFrom(this.#api.create$(item)),
      reconcile: (data, response) => replaceItem(data, tempId, response.data),
      errorMessage: 'Failed to create item',
    });
  }

  async updateItem(id: string, updates: ItemUpdate): Promise<void> {
    return this.#runMutation({
      optimisticUpdate: (data) => updateItem(data, id, updates),
      apiCall: () => firstValueFrom(this.#api.update$(id, updates)),
      errorMessage: 'Failed to update item',
    });
  }

  async deleteItem(id: string): Promise<void> {
    return this.#runMutation({
      optimisticUpdate: (data) => removeItem(data, id),
      apiCall: () => firstValueFrom(this.#api.delete$(id)),
      errorMessage: 'Failed to delete item',
    });
  }

  // ──────────────────────────────────────────────
  // 7. MUTATION HELPER (private)
  // ──────────────────────────────────────────────
  async #runMutation<T>(options: {
    optimisticUpdate?: (d: MyData) => MyData;
    apiCall: () => Promise<T>;
    reconcile?: (d: MyData, response: T) => MyData;
    errorMessage: string;
  }): Promise<void> {
    // Apply optimistic update
    if (options.optimisticUpdate) {
      this.#resource.update((d) =>
        d ? options.optimisticUpdate!(d) : d
      );
    }

    try {
      const response = await options.apiCall();

      // Reconcile server response
      if (options.reconcile) {
        this.#resource.update((d) =>
          d ? options.reconcile!(d, response) : d
        );
      }

      // Invalidate cache
      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      // Rollback: reload from server
      this.#resource.reload();
      this.#state.errorMessage.set(options.errorMessage);
      this.#logger.error(options.errorMessage, error);
    }
  }

  #invalidateCache(): void {
    this.#invalidationService.invalidate();
  }
}
```

**Key Pattern Elements:**

1. **Private signals** (`#state`, `#resource`) - Implementation detail
2. **Public readonly** - Exposed via `asReadonly()` or computed
3. **Pure updaters** - Extracted to separate file (Redux pattern)
4. **Mutation helper** - Centralizes optimistic update + reconcile + error handling
5. **Cache coordination** - Invalidates after successful mutations

---

### Pure State Updaters (Separate File)

```typescript
// my-feature-updaters.ts
import type { MyData, Item } from './types';

// Redux-like reducers: (state, payload) => newState

export function addItem(data: MyData, item: Item): MyData {
  return { ...data, items: [...data.items, item] };
}

export function updateItem(
  data: MyData,
  id: string,
  updates: Partial<Item>,
): MyData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    ),
  };
}

export function replaceItem(
  data: MyData,
  oldId: string,
  newItem: Item,
): MyData {
  return {
    ...data,
    items: data.items.map((item) => (item.id === oldId ? newItem : item)),
  };
}

export function removeItem(data: MyData, id: string): MyData {
  return {
    ...data,
    items: data.items.filter((item) => item.id !== id),
  };
}
```

**Benefits:**
- ✅ Testable in isolation (no mocks needed)
- ✅ Reusable across stores
- ✅ Pure functions (no side effects)
- ✅ Type-safe transformations

**Location:** `budget-details-updaters.ts`, `template-details-updaters.ts`

---

## Testing Patterns

### Pattern 1: Concurrent Mutation Tests

**Purpose:** Verify that concurrent operations don't lose data.

```typescript
describe('CurrentMonthStore - Concurrent Mutations', () => {
  it('preserves toggle state during createTransaction', async () => {
    // Setup: Existing budget line
    const existingLine = { id: 'line-1', amount: 100, checkedAt: null };
    mockResource.value.set({ budgetLines: [existingLine], ... });

    // Control API timing with Subject
    const createSubject = new Subject<{ data: Transaction }>();
    mockTransactionApi.create$.and.returnValue(createSubject.asObservable());

    // Action 1: Start create (doesn't complete yet)
    const createPromise = store.addTransaction({ name: 'Coffee', amount: 5 });
    // → Optimistic: new transaction appears

    // Action 2: Toggle while create is in-flight
    await store.toggleBudgetLineCheck('line-1');
    // → Optimistic: line-1.checkedAt = '2026-01-31'

    // Complete create mutation
    createSubject.next({ data: newTransaction });
    createSubject.complete();
    await createPromise;

    // Verify: Both changes preserved
    const finalState = store.dashboardData();
    expect(finalState.transactions).toContainEqual(newTransaction); // Create ✅
    expect(finalState.budgetLines[0].checkedAt).not.toBeNull();     // Toggle ✅
  });
});
```

**Key Technique:** Subject-based timing control allows testing race conditions deterministically.

**Location:** `current-month-store.spec.ts:1221-1410`

---

### Pattern 2: Optimistic Update with Rollback

```typescript
describe('BudgetDetailsStore - Optimistic Updates', () => {
  it('shows new line immediately then replaces temp ID', async () => {
    const createPromise = store.createBudgetLine({ name: 'Food', amount: 100 });

    // Immediate feedback (before API completes)
    await tick();
    const optimisticState = store.budgetDetails();
    expect(optimisticState.budgetLines).toHaveLength(1);
    expect(optimisticState.budgetLines[0].id).toMatch(/^temp-/);

    // After API completes
    await createPromise;
    const finalState = store.budgetDetails();
    expect(finalState.budgetLines[0].id).not.toMatch(/^temp-/);
    expect(finalState.budgetLines[0].id).toBe('real-server-id');
  });

  it('rolls back optimistic update on API error', async () => {
    mockApi.create$.and.returnValue(throwError(() => new Error('Network error')));

    const originalState = store.budgetDetails();
    await expectAsync(store.createBudgetLine({ ... })).toBeRejected();

    // State rolled back
    expect(store.budgetDetails()).toEqual(originalState);
    expect(store.error()).toBe('Erreur lors de l\'ajout de la prévision');
  });
});
```

**Location:** `budget-details-store.spec.ts:524-588`

---

### Pattern 3: Toggle Serialization

```typescript
describe('BudgetDetailsStore - Toggle Serialization', () => {
  it('queues rapid toggles sequentially', async () => {
    const callOrder: string[] = [];

    mockApi.toggleCheck$.and.callFake((id: string) => {
      callOrder.push(`start:${id}`);
      return of(response).pipe(delay(50));
    });

    // Fire two toggles rapidly (no await)
    store.toggleCheck('line-1');
    store.toggleCheck('line-2');

    await tick(100); // Wait for both to complete

    // Verify sequential execution (not parallel)
    expect(callOrder).toEqual([
      'start:line-1',  // First toggle starts
      'start:line-2',  // Second toggle starts AFTER first completes
    ]);
  });
});
```

**Key Insight:** Tests verify that toggles are queued (via `#enqueue()`), not parallelized.

**Location:** `budget-details-store.spec.ts:1205-1305`

---

## Design Principles

### 1. Cache-First, Validate in Background

```
Display speed > Data freshness (within acceptable staleness window)
```

**Rationale:** Users prefer instant display of slightly old data over waiting for fresh data. Fresh data fetched in background, UI updates smoothly when ready.

**Implementation:** `createStaleFallback()` wrapper + `setStaleData()` seeding

---

### 2. Selective Invalidation

```
Invalidate what changed, preserve what didn't
```

**Rationale:** Editing January budget shouldn't require refetching February budget details. Only invalidate affected data.

**Implementation:**
- Specific: `budgetCache.invalidateBudgetDetails(budgetId)` - Remove one entry
- Global: `invalidationService.invalidate()` - Bump version for cascade
- Stores react based on their invalidation strategy

---

### 3. Appropriate Complexity

```
Simple stores stay simple, complex stores get advanced patterns
```

**Rationale:** Not all stores need the same features. BudgetDetailsStore doesn't need toggle merge (low concurrency). CurrentMonthStore does (high interaction).

**Implementation:**
- BudgetDetailsStore: Simple `#runMutation()` without merge
- CurrentMonthStore: Advanced `#performOptimisticMutation()` with merge
- Both patterns are valid for their use cases

---

### 4. Pure Core, Effectful Shell

```
State transformations = pure functions (updaters)
Side effects = store methods (mutations)
```

**Rationale:** Separating pure logic from I/O makes testing easier and code more predictable.

**Implementation:**
- Pure updaters in `*-updaters.ts` files (e.g., `addBudgetLine()`)
- Mutation methods in store use updaters + API calls
- Tests can verify logic without mocking HTTP

---

### 5. Signal-Based Reactivity

```
Change source signal → All computed signals update automatically
```

**Rationale:** Angular's reactivity graph handles propagation. You declare relationships once, Angular maintains them.

**Implementation:**
- Writable signals for mutable state (`#state`, `#resource`)
- Computed signals for derived state (`totalExpenses`, `remaining`)
- Template binds to computed signals
- Changes propagate automatically (no manual subscriptions)

---

## Common Pitfalls

### Pitfall 1: Wrong Order in setBudgetId()

```typescript
// ❌ WRONG - Causes spinner flash
setBudgetId(id: string): void {
  this.#state.budgetId.set(id);     // Params change first
  this.#swr.setStaleData(cached);    // Stale data too late
}

// ✅ CORRECT
setBudgetId(id: string): void {
  this.#swr.setStaleData(cached);    // Stale data first
  this.#state.budgetId.set(id);     // Then params change
}
```

---

### Pitfall 2: Short-Circuit in computed()

```typescript
// ❌ WRONG - Breaks tracking
const data = computed(() =>
  this.resource.value() ?? this.#staleData()
);

// ✅ CORRECT - Always tracks both
const data = computed(() => {
  const fresh = this.resource.value();
  const stale = this.#staleData();
  return fresh ?? stale ?? null;
});
```

---

### Pitfall 3: Forgetting skip(1) in toObservable

```typescript
// ❌ WRONG - Fires on initialization
toObservable(version).subscribe(() => invalidate());

// ✅ CORRECT - Skips initial emission
toObservable(version).pipe(skip(1)).subscribe(() => invalidate());
```

---

### Pitfall 4: Multiple set() Calls in Mutations

```typescript
// ❌ WRONG - Race condition window
async mutation() {
  this.resource.set(updated);
  const serverData = await fetch();
  this.resource.update(d => ({ ...d, serverData }));
}

// ✅ CORRECT - Single atomic set
async mutation() {
  const updated = transform(data);
  const serverData = await fetch();
  const latestData = this.resource.value();

  this.resource.set({
    ...updated,
    serverField: serverData,
    // Merge concurrent changes
  });
}
```

---

### Pitfall 5: Using isLoading Instead of isInitialLoading

```typescript
// ❌ WRONG - Shows spinner during background revalidation
@if (store.isLoading()) {
  <spinner />
}

// ✅ CORRECT - Only shows spinner when no data available
@if (store.isInitialLoading()) {
  <spinner />
}
```

---

## Real-World Examples

### Example 1: BudgetDetailsStore (Simple Pattern)

**Use Case:** Historical budget detail page, low concurrency

**Pattern Choices:**
- ✅ Lazy stale invalidation (DR-009 Strategy B)
- ✅ Simple `#runMutation()` without toggle merge
- ✅ Cache-first display with SWR
- ✅ Toggle queue for serialization (`#enqueue()`)

**File:** `frontend/projects/webapp/src/app/feature/budget/budget-details/store/budget-details-store.ts`

**Key Lines:**
- Resource: 85-120 (cache-first loader)
- SWR: 122-124 (`createStaleFallback`)
- Mutation helper: 251-282 (`#runMutation`)
- Toggle queue: 58, 77-81 (`#toggleQueue`, `#enqueue`)

---

### Example 2: CurrentMonthStore (Advanced Pattern)

**Use Case:** Current month dashboard, high interaction frequency

**Pattern Choices:**
- ✅ Version-based eager reload (DR-009 Strategy A)
- ✅ Advanced mutation with toggle merge (DR-010)
- ✅ Atomic `set()` to prevent race conditions
- ✅ No cache invalidation after toggles

**File:** `frontend/projects/webapp/src/app/feature/current-month/services/current-month-store.ts`

**Key Lines:**
- Resource with version: 75-88 (auto-reload on invalidation)
- Toggle merge function: 33-48 (`mergeToggleStates`)
- Advanced mutation: 284-353 (`#performOptimisticMutation`)
- Atomic set with merge: 318-342
- No invalidation comment: 247, 276

---

### Example 3: BudgetCache (Coordination Layer)

**Use Case:** Global cache for all budget data

**Pattern Choices:**
- ✅ Two-tier caching (list + details)
- ✅ Reactive invalidation (toObservable subscription)
- ✅ Batch preloading with deduplication
- ✅ Stale marking instead of deletion

**File:** `frontend/projects/webapp/src/app/core/budget/budget-cache.ts`

**Key Lines:**
- Invalidation subscription: 22-31 (`toObservable` + `skip(1)`)
- List cache: 33-38 (`createListCache`)
- State tracking: 40-45 (maps + sets)
- Batch preloading: 100-124 (`preloadBudgetDetails`)
- Stale marking: 170-173 (`markAllDetailsStale`)

---

## Macro Implications

### Implication 1: Feature Isolation + Global Persistence

**Architecture:**
- Feature stores are component-scoped (destroyed on navigation)
- Cache layer is global (survives navigation)

**Result:**
- Features remain isolated (changes don't affect siblings)
- Data persists across navigation (no reload when revisiting)
- Memory is freed when leaving feature (garbage collection)

**Trade-off:** Must coordinate between scoped store and global cache.

---

### Implication 2: Single Source of Truth

**The version signal:**

```typescript
// InvalidationService.version is THE single source of truth for cache state
// All cache invalidation flows through this one signal

Mutation completes
  └─→ invalidationService.invalidate()
      └─→ version: N → N+1
          ├─→ BudgetCache reacts (marks stale, clears list)
          ├─→ BudgetListStore reacts (reloads via params)
          └─→ CurrentMonthStore reacts (reloads via params)
```

**Why this matters:**
- No scattered `reload()` calls throughout the codebase
- One signal change → cascade updates automatically
- Impossible to "forget" to invalidate (it's centralized)

---

### Implication 3: Optimistic Updates = State Duplication

**The cost of instant feedback:**

```
User's perceived state (optimistic)
        ≠
Server's actual state (authoritative)

Timeline:
0ms:   User creates item → Optimistic state includes it
200ms: Server responds → States reconcile

Between 0-200ms: Two sources of truth exist simultaneously
```

**How we handle it:**
- Optimistic state is **temporary guess**
- Server response is **source of truth**
- Reconcile step **merges** server truth with concurrent local changes
- On error: **Rollback** to server state (via `reload()`)

**Trade-off:** Complexity of reconciliation logic for better UX.

---

### Implication 4: The Two-Strategy Model

**Why not one strategy for everything?**

```
If everything used version-based:
  ├─ Pro: Always fresh data
  └─ Con: 13 API calls per mutation (1 list + 12 details)
      → Wasteful, slow

If everything used lazy stale:
  ├─ Pro: Minimal API calls
  └─ Con: Budget list shows stale totals after mutation
      → Confusing UX

Hybrid approach:
  ├─ List/Dashboard: Version-based (user sees them after mutation)
  └─ Details: Lazy stale (user rarely returns immediately)
  → Optimal: 1-2 API calls, fresh where needed, instant display everywhere
```

**Rule:** Choose strategy based on **user journey**, not theoretical consistency.

---

## Advanced Topics

### Topic 1: Why Component-Scoped Stores?

**Architectural Rule:**

```typescript
// Feature stores are provided at route level (NOT root)
@Injectable() // No providedIn
export class BudgetDetailsStore { }

// Route configuration:
{
  path: 'budgets/:id',
  providers: [BudgetDetailsStore], // ← Scoped to this route
  loadComponent: () => import('./budget-details-page'),
}
```

**Lifecycle:**

```
User navigates to /budgets/abc123
  ├─ Route activates
  ├─ Angular creates NEW BudgetDetailsStore instance
  ├─ Component injects store
  ├─ Component initializes: store.setBudgetId('abc123')
  └─ Page displays

User navigates away to /templates
  ├─ Route deactivates
  ├─ Component destroyed
  ├─ BudgetDetailsStore destroyed (no references left)
  └─ Garbage collected (memory freed)

User returns to /budgets/xyz789
  ├─ NEW BudgetDetailsStore instance created
  ├─ Fresh initialization
  └─ But data loads from cache (instant display) ✅
```

**Benefits:**

| Aspect | Component-Scoped | Root-Scoped |
|--------|------------------|-------------|
| **Isolation** | ✅ Feature changes don't leak | ❌ Global state can leak |
| **Memory** | ✅ Freed when leaving feature | ❌ Lives forever |
| **Testing** | ✅ Clean slate per test | ❌ Must reset state manually |
| **State** | ✅ Fresh instance each visit | ❌ Can have stale state from previous visit |

**Trade-off:** Must use global cache (BudgetCache) to persist data across visits.

**Why This Works:**
- Global cache provides persistence
- Scoped store provides isolation
- Best of both worlds

---

### Topic 2: The rxResource vs resource Choice

**Both APIs exist:**

```typescript
// resource() - Generic async loader
readonly data = resource({
  params: () => this.id(),
  loader: async ({ params }) => fetch(params)
});

// rxResource() - RxJS Observable stream
readonly data = rxResource({
  params: () => this.id(),
  stream: ({ params }) => this.http.get(params)
});
```

**When to use which?**

| Use Case | API | Reason |
|----------|-----|--------|
| New async code | `resource()` | Simpler (async/await), no Observable boilerplate |
| Existing Observable APIs | `rxResource()` | No conversion needed, leverages RxJS operators |
| Complex stream operations | `rxResource()` | Access to RxJS operators (retry, debounce, etc.) |

**In this codebase:**
- **BudgetDetailsStore:** Uses `resource()` (async/await pattern)
- **CurrentMonthStore:** Uses `rxResource()` (integrates with Observable APIs)
- **Both are valid choices** - pick based on API shape

---

### Topic 3: Why No Mutation Queue in CurrentMonthStore?

**Comment at line 182:**

```typescript
// No mutation queue needed: the dashboard is a single-action-at-a-time view
// with low concurrency risk. Toggle methods use snapshot-based rollback
// for optimistic updates. CRUD mutations go through #performOptimisticMutation
// which does a single atomic set() after API + server reconciliation.
```

**Explanation:**

**BudgetDetailsStore HAS queue:**
```typescript
readonly #toggleQueue = Promise.resolve();

#enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = this.#toggleQueue.then(() => operation());
  this.#toggleQueue = result.catch(() => undefined).then(() => undefined);
  return result;
}
```

**Why?** Users can rapidly click toggles → Must serialize to preserve order.

**CurrentMonthStore NO queue for CRUD:**

**Why?** Dashboard actions are deliberate:
- User adds transaction → waits for confirmation before next action
- User deletes item → waits for it to disappear
- Low probability of concurrent CRUD operations

**BUT:** CurrentMonth DOES need toggle merge because:
- Users toggle many items rapidly (high frequency)
- CRUD can overlap with toggles (create while toggling)
- Merge pattern handles this without blocking user

**Design Decision:** Queue only where needed (toggles in BudgetDetails), merge concurrent state where needed (CurrentMonth), keep simple where possible.

---

## Store Decision Tree

```
┌────────────────────────────────────────┐
│ New store needed?                      │
└─────────────┬──────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│ Is data displayed immediately          │
│ after mutations?                       │
└──────┬─────────────────────────────────┘
       │
   ┌───┴────┐
   │        │
  YES      NO
   │        │
   ▼        ▼
┌──────────────┐  ┌──────────────────┐
│ Use Strategy │  │ Use Strategy B:  │
│ A: Version-  │  │ Lazy Stale       │
│ Based Reload │  │ Marking          │
│              │  │                  │
│ Add version  │  │ Cache check in   │
│ to params    │  │ loader           │
└──────────────┘  └──────────────────┘
       │                  │
       │                  │
       ▼                  ▼
┌────────────────────────────────────────┐
│ Does store need SWR (instant display)? │
└──────┬─────────────────────────────────┘
       │
   ┌───┴────┐
   │        │
  YES      NO
   │        │
   ▼        ▼
┌──────────────┐  ┌──────────────────┐
│ Wrap with    │  │ Use resource     │
│ createStale  │  │ directly         │
│ Fallback()   │  │                  │
└──────────────┘  └──────────────────┘
       │                  │
       │                  │
       ▼                  ▼
┌────────────────────────────────────────┐
│ High interaction frequency?            │
│ (Many concurrent toggles/mutations)    │
└──────┬─────────────────────────────────┘
       │
   ┌───┴────┐
   │        │
  YES      NO
   │        │
   ▼        ▼
┌──────────────┐  ┌──────────────────┐
│ Add toggle   │  │ Simple mutation  │
│ merge pattern│  │ pattern OK       │
│              │  │                  │
│ Use merge    │  │ Basic optimistic │
│ ToggleStates │  │ + reconcile      │
└──────────────┘  └──────────────────┘
```

---

## Complete Mutation Flow (Annotated)

Let's trace **every signal update** when user creates a budget line on CurrentMonth dashboard:

```typescript
// ════════════════════════════════════════════════════════════
// TIME: 0ms - USER ACTION
// ════════════════════════════════════════════════════════════

User clicks "Add Transaction: Coffee, 5 CHF"
└─→ Component calls: store.addTransaction({ name: 'Coffee', amount: 5, ... })

// ════════════════════════════════════════════════════════════
// TIME: 1ms - METHOD ENTRY
// ════════════════════════════════════════════════════════════

async addTransaction(data: TransactionCreate): Promise<void> {
  return this.#performOptimisticMutation<Transaction>(
    () => this.#transactionApi.create$(data),
    (currentData, response) => ({
      ...currentData,
      transactions: [...currentData.transactions, response],
    }),
  );
}

// ════════════════════════════════════════════════════════════
// TIME: 2ms - OPTIMISTIC UPDATE (no server response yet)
// ════════════════════════════════════════════════════════════

// Inside #performOptimisticMutation - API call starts
const response = await firstValueFrom(operation());

// Signal cascade:
#dashboardResource.value() changes
  ↓
dashboardData() = computed(() => this.#dashboardResource.value())
  ↓ re-evaluates
transactions() = computed(() => dashboardData()?.transactions || [])
  ↓ re-evaluates (new transaction in array)
totalExpenses() = computed(() => BudgetFormulas.calculate(...))
  ↓ re-evaluates (5 CHF added)
remaining() = computed(() => available - expenses)
  ↓ re-evaluates (5 CHF less)
  ↓
TEMPLATE updates (Angular change detection)
  ↓
USER SEES: Transaction appears instantly ✅

// ════════════════════════════════════════════════════════════
// TIME: 50ms - CONCURRENT ACTION
// ════════════════════════════════════════════════════════════

User toggles budget line (while create is still in-flight)
└─→ store.toggleBudgetLineCheck('line-1')

// Snapshot-based rollback pattern:
const originalData = this.#dashboardResource.value();

this.#dashboardResource.set({
  ...originalData,
  budgetLines: originalData.budgetLines.map(line =>
    line.id === 'line-1' ? { ...line, checkedAt: new Date().toISOString() } : line
  )
});

// Signal cascade:
budgetLines() re-evaluates → line-1 now checked
  ↓
TEMPLATE updates → Checkmark appears ✅

// No cache invalidation (comment line 247):
// "Cache invalidation removed: toggles are UI-only, no need to reload"

// ════════════════════════════════════════════════════════════
// TIME: 200ms - CREATE API COMPLETES
// ════════════════════════════════════════════════════════════

// Server responds: { data: { id: 'real-id', amount: 5, ... } }
const response = await firstValueFrom(operation());

// Get current data (after API call completed)
const currentData = this.#dashboardResource.value();

// Apply updateData callback:
const updatedData = updateData(currentData, response.data);
// → Adds new transaction to array

// ════════════════════════════════════════════════════════════
// TIME: 201ms - FETCH SERVER BUDGET
// ════════════════════════════════════════════════════════════

// Fetch server-computed budget fields (endingBalance, etc.)
const serverBudget = await firstValueFrom(
  this.#budgetApi.getBudgetById$(currentData.budget.id)
);

// ════════════════════════════════════════════════════════════
// TIME: 202ms - MERGE CONCURRENT CHANGES (THE CRITICAL PART)
// ════════════════════════════════════════════════════════════

// Read LATEST data (includes toggle from 50ms)
const latestData = this.#dashboardResource.value();

// Single atomic set with merged state:
this.#dashboardResource.set({
  ...updatedData,                          // Has new transaction
  budgetLines: mergeToggleStates(
    updatedData.budgetLines,               // Old toggle states (from 0ms snapshot)
    latestData.budgetLines                 // Latest toggle states (includes 50ms toggle)
  ),
  transactions: mergeToggleStates(
    updatedData.transactions,
    latestData.transactions
  ),
  budget: {
    ...(serverBudget ?? latestData.budget),
    rollover: latestData.budget.rollover,
  },
});

// mergeToggleStates() result:
// - budgetLines has line-1 with checkedAt from 50ms toggle ✅
// - transactions has new transaction from 200ms create ✅
// - Both changes preserved!

// Signal cascade (second wave):
#dashboardResource.value() changes
  ↓
dashboardData() re-evaluates
  ↓
budgetLines() → line-1 still checked ✅
transactions() → new transaction with real ID ✅
totalExpenses() → recalculates with server budget
remaining() → recalculates
  ↓
TEMPLATE updates smoothly

// ════════════════════════════════════════════════════════════
// TIME: 203ms - CACHE INVALIDATION CASCADE
// ════════════════════════════════════════════════════════════

this.#invalidateCache();

// Specific invalidation:
this.#budgetCache.invalidateBudgetDetails(budgetId);
// → Removes this budget from cache
// → Next access will fetch fresh

// Global invalidation:
this.#invalidationService.invalidate();
// → version: 5 → 6

// ════════════════════════════════════════════════════════════
// TIME: 203ms - CASCADE TO OTHER STORES
// ════════════════════════════════════════════════════════════

// BudgetCache reacts:
toObservable(invalidationService.version)
  .pipe(skip(1))
  .subscribe(() => {
    this.markAllDetailsStale();     // All details now stale
    this.#listCache.invalidate();   // List cache cleared
  });

// BudgetListStore reacts:
params: () => ({ version: invalidationService.version() })
// → params change: { version: 5 } → { version: 6 }
// → Resource auto-reloads
// → Loader executes

// ════════════════════════════════════════════════════════════
// TIME: 403ms - SIDEBAR UPDATES
// ════════════════════════════════════════════════════════════

// BudgetListStore GET /budgets completes
// Fresh budget list with updated totals
// Sidebar displays accurate remaining/balance ✅

// ════════════════════════════════════════════════════════════
// FINAL STATE (403ms total)
// ════════════════════════════════════════════════════════════

Dashboard: ✅ New transaction visible (0ms perceived, 202ms actual)
Sidebar: ✅ Updated totals (403ms)
Cache: ✅ Stale (will refresh on next access)
Server: ✅ Fully synced

Total API calls: 1 POST + 1 GET (budget) + 1 GET (list) = 3 calls
Total time: 403ms from click to fully consistent state
User perception: Instant (saw feedback at 2ms)
```

---

## Key Architectural Decisions

### Decision: Why Not NgRx?

**Considered:** NgRx Global Store with actions, reducers, effects, selectors

**Rejected Because:**
- Massive boilerplate for small-to-medium app
- Actions/reducers add indirection without benefit
- Effects are more complex than async/await
- DevTools are nice but not worth the cost

**Chosen Instead:** Signal-based stores with resource()

**Trade-off:** Less "standardized" but simpler and more maintainable for this team size.

---

### Decision: Why Not TanStack Query?

**Considered:** TanStack Query for Angular (port of React Query)

**Rejected Because:**
- +50KB dependency for patterns we already implemented in 200 lines
- React-inspired API doesn't feel Angular-native
- Over-engineered for this use case (don't need infinite scroll, parallel queries, etc.)

**Chosen Instead:** Custom SWR with `createStaleFallback()`

**Trade-off:** Less "industry standard" but zero dependencies and perfect Angular integration.

---

### Decision: Why Two Mutation Patterns?

**Pattern A (BudgetDetailsStore):**
```typescript
#runMutation({
  optimisticUpdate,
  apiCall,
  reconcile,
  errorMessage
})
```

**Pattern B (CurrentMonthStore):**
```typescript
#performOptimisticMutation(
  operation,
  updateData
)
```

**Why Different?**

**BudgetDetailsStore needs:**
- Optimistic update for instant feedback
- Simple reconciliation (no server-computed fields)
- Error messages for user display

**CurrentMonthStore needs:**
- Multi-step reconciliation (fetch server budget for endingBalance)
- Concurrent toggle merge (high interaction frequency)
- Atomic final set() to prevent race conditions

**Forcing same pattern would:**
- Make BudgetDetails more complex (unnecessary toggle merge)
- OR make CurrentMonth less robust (missing merge = data loss)

**Decision:** Keep both patterns, document the difference.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Forgetting Cache-First Order

```typescript
// ❌ WRONG
setBudgetId(id: string): void {
  this.#state.budgetId.set(id);           // Params change first
  const cached = this.#cache.get(id);
  this.#swr.setStaleData(cached);         // Too late!
}

// User sees spinner flash before cached data appears
```

---

### Anti-Pattern 2: Using providedIn: 'root' for Feature Stores

```typescript
// ❌ WRONG - Breaks feature isolation
@Injectable({ providedIn: 'root' })
export class BudgetDetailsStore { }

// Store lives forever, shared across all instances
// Memory leak, state pollution risk

// ✅ CORRECT - Feature scoped
@Injectable() // No providedIn
export class BudgetDetailsStore { }

// Provided at route level
{ path: 'budgets/:id', providers: [BudgetDetailsStore] }
```

---

### Anti-Pattern 3: Multiple Invalidation Calls

```typescript
// ❌ WRONG - Triggers multiple reloads
async createBudgetLine() {
  await api.create();
  this.#invalidationService.invalidate(); // Version: 5 → 6 (reload triggered)
  this.#budgetCache.invalidate();         // Redundant!
  this.#resource.reload();                // Redundant!
}

// ✅ CORRECT - Single invalidation cascades
async createBudgetLine() {
  await api.create();
  this.#invalidationService.invalidate(); // Version bump → auto-cascade
}
```

---

### Anti-Pattern 4: Optimistic Update Without Rollback

```typescript
// ❌ WRONG - No error handling
async createItem(item: ItemCreate): Promise<void> {
  this.#resource.update(d => addItem(d, item));
  await api.create(item); // If this fails, optimistic state persists!
}

// ✅ CORRECT - Rollback on error
async createItem(item: ItemCreate): Promise<void> {
  this.#resource.update(d => addItem(d, tempItem));

  try {
    const response = await api.create(item);
    this.#resource.update(d => replaceItem(d, tempId, response.data));
  } catch (error) {
    this.#resource.reload(); // Rollback to server state
    throw error;
  }
}
```

---

## File Reference Guide

### Core Cache Files

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `core/cache/list-cache.ts` | Generic list caching factory | 18-66 (createListCache) |
| `core/cache/stale-fallback.ts` | SWR wrapper for resources | 42-69 (createStaleFallback) |
| `core/cache/invalidation-signal.ts` | Version-based invalidation | 8-17 (version signal) |
| `core/cache/cache-config.ts` | Cache constants | 10-13 (batch size, timeout) |
| `core/budget/budget-cache.ts` | Budget-specific cache | 22-31 (reactive invalidation) |
| `core/budget/budget-invalidation.service.ts` | Central invalidation service | 5-12 (version signal wrapper) |

### Feature Store Files

| File | Pattern | Key Sections |
|------|---------|--------------|
| `feature/budget/budget-details/store/budget-details-store.ts` | Simple mutation | 85-120 (loader), 251-282 (mutation helper) |
| `feature/current-month/services/current-month-store.ts` | Advanced mutation | 75-88 (version param), 284-353 (merge pattern) |
| `feature/budget-templates/details/services/template-details-store.ts` | Read-only | 14-35 (resource + SWR) |

### Pure Updater Files

| File | Purpose |
|------|---------|
| `feature/budget/budget-details/store/budget-details-updaters.ts` | Redux-like pure reducers |

### Test Files

| File | Coverage |
|------|----------|
| `feature/current-month/services/current-month-store.spec.ts` | Concurrent mutations (1221-1410), cache invalidation (1083-1208) |
| `feature/budget/budget-details/store/budget-details-store.spec.ts` | Toggle serialization (1205-1305), optimistic updates (524-588) |
| `e2e/tests/features/cache-invalidation.spec.ts` | Navigation flows with cache consistency |

---

## Summary: The Philosophy

**This architecture achieves:**

1. **Premium UX** - Instant feedback (optimistic), zero spinners (SWR), smooth updates
2. **Correctness** - Race conditions handled, concurrent changes merged, rollback on errors
3. **Performance** - Minimal API calls, smart caching, lazy loading
4. **Maintainability** - Pure functions, appropriate complexity, feature isolation
5. **Angular Idioms** - Native signals, resource API, OnPush compatible

**Without:**
- ❌ External state libraries (NgRx, TanStack Query)
- ❌ Over-abstraction (forced uniformity)
- ❌ Over-engineering (complex solutions for simple problems)

**The Craftsman's Touch:**
- Simple where possible (BudgetDetailsStore)
- Complex where needed (CurrentMonthStore)
- Documented so future developers understand WHY

---

## References

- **DR-006:** Cache-First Display (`memory-bank/techContext.md:243-277`)
- **DR-007:** Eager Signal Reading (`memory-bank/techContext.md:197-240`)
- **DR-008:** Imperative staleData Signal (`memory-bank/techContext.md:158-194`)
- **DR-009:** Lazy Stale vs Eager Reload (`memory-bank/techContext.md:115-156`)
- **DR-010:** Toggle Merge Pattern (`memory-bank/techContext.md:36-113`)

- Angular Signals Guide: https://angular.dev/guide/signals
- Angular Resource API: https://angular.dev/guide/signals/resource
- Stale-While-Revalidate: https://web.dev/stale-while-revalidate/

---

**End of Document**
