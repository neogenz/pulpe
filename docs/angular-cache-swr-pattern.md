# Angular Cache & SWR Pattern

A zero-dependency, signal-native caching layer for Angular 21+ that brings stale-while-revalidate semantics to `resource()` — instant navigations, background refreshes, and no spinners on return visits.

## Overview

Angular's `resource()` API elegantly manages the **fetch lifecycle** — loading, resolved, error. But it has no opinion on the **data lifecycle**: when should data be considered fresh? When should it be silently refreshed? What happens when the user navigates away and comes back?

This pattern fills that gap. It introduces a thin `DataCache` layer that sits between your Feature API services and the HTTP client, giving every read operation a three-state freshness model (fresh, stale, expired) and automatic stale-while-revalidate behavior.

The result: users see data instantly on every navigation after the first visit. Background fetches keep it fresh. Spinners only appear on genuinely cold screens. All of this with zero external dependencies — just Angular signals, `resource()`, and an in-memory `Map`.

## Key Features

- **Stale-while-revalidate (SWR)** — return cached data immediately, refresh in the background
- **Three-state freshness** — every cache entry transitions through fresh → stale → expired
- **Hierarchical cache keys** — prefix-based invalidation (invalidate a whole domain or a single entity)
- **Request deduplication** — concurrent fetches for the same key share a single in-flight Promise
- **Predictive prefetching** — preload data the user is likely to need next
- **Seeding on params change** — inject cached data into a resource before it fetches, eliminating navigation spinners
- **Version-signal invalidation** — mutations increment a signal that triggers automatic resource reloads

## Mental Model

```
resource()  → manages the fetch lifecycle  → loading | resolved | error
DataCache   → manages the data lifecycle   → fresh   | stale    | expired
```

`resource()` knows **how** to fetch. `DataCache` knows **when** to re-fetch and **what** to keep. They compose naturally: the resource loader consults the cache first, and the cache decides whether to return data, trigger a background refresh, or let the fetch proceed.

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌───────────┐
│  Component  │────▶│    Store     │────▶│  Feature API  │────▶│ ApiClient │
│  (template) │     │  (signals)  │     │  (singleton)  │     │  (HTTP)   │
└─────────────┘     └─────────────┘     └──────┬───────┘     └───────────┘
                                               │
                                          ┌────▼────┐
                                          │DataCache│
                                          │  (Map)  │
                                          └─────────┘
```

## Layer Responsibilities

| Layer | Lifetime | Responsibility | Returns |
|-------|----------|----------------|---------|
| **Component** | View lifecycle | Read signals, call store methods | — |
| **Store** | Route-scoped | Resource loaders, selectors, mutations, optimistic updates | Signals |
| **Feature API** | Singleton | Domain endpoints, cache ownership, invalidation | Observable |
| **DataCache** | Singleton (session) | Freshness tracking, dedup, invalidation, prefetch | Sync data |
| **ApiClient** | Singleton | HTTP transport + Zod response validation | Observable |

## Types of State

Not all state is equal. The architecture above exists because each layer manages a **different kind** of state, with different lifetimes and different homes:

| Type | Examples | Where it lives | Lifetime |
|------|----------|----------------|----------|
| **UI state** | Modal open, active tab, field focus | Component (local signal) | View |
| **Application state** | Authenticated user, theme, feature flags | Root service | Session |
| **Server state** | API data, entity lists, details | Store (route-scoped) | Route |
| **Cached state** | Data persisted across navigations | DataCache (API layer) | Session |

A store is a **server state + UI state manager** scoped to a feature route. The DataCache is a **cached state manager** that outlives any individual store. This is why they're separate layers — they manage state with fundamentally different lifetimes.

## Why Cache Lives in the API Layer

**1. Survival.** Feature API services are `providedIn: 'root'` singletons — they survive route navigations. Stores are route-scoped and get destroyed when the user navigates away. Putting cache in the store would lose it on every navigation.

**2. Sharing.** Multiple stores can consume the same API. An order list store and an order dashboard store both call `orderApi.getAll$()`. A single cache in the API layer serves both without duplication.

**3. Transparency.** Stores don't need to know the cache exists. They call the API, the API consults the cache, and data flows back through the same Observable interface. Caching is an implementation detail of the API layer.

## Data Flow

### Read Flow

```
Component reads signal
       │
       ▼
Store resource loader fires
       │
       ▼
Feature API checks DataCache
       │
       ├── FRESH hit  → return cached data (no fetch)
       │
       ├── STALE hit  → return cached data + fire background fetch
       │                       │
       │                       └── fetch completes → update cache → version++ → resource reloads
       │
       └── MISS        → fetch from server → populate cache → return data
```

### Mutation Flow

```
User action (create / update / delete)
       │
       ▼
Store calls Feature API mutation
       │
       ▼
Server confirms
       │
       ▼
Feature API invalidates cache (prefix-based)
       │
       ▼
Invalidation service increments version signal
       │
       ▼
All stores with version() in params auto-reload
       │
       ▼
Resource loaders find STALE cache → instant display + background refresh
```

---

## Data Freshness

Every cache entry has a birthday. From the moment it's written, it moves through three states:

```
  write          freshTime              gcTime
    │                │                     │
    ▼                ▼                     ▼
    ├───── FRESH ────┤───── STALE ────────┤───── EXPIRED (evicted) ─▶
    │                │                     │
    │  return as-is  │  return + revalidate │  fetch from server
```

**Fresh** — the entry was recently fetched. Return it directly, no network request needed. Like milk you just bought today.

**Stale** — the entry is still usable but might be outdated. Return it immediately (the user sees data) and silently re-fetch in the background. Like milk that's past its best-by date but still drinkable — you serve it and go buy a new one.

**Expired** — the entry is too old to trust. Evict it from the cache and fetch from the server. The user sees a loading state.

### Configuration

| Parameter | Description | Default suggestion |
|-----------|-------------|-------------------|
| `freshTime` | Duration (ms) an entry stays FRESH | 30 000 (30s) |
| `gcTime` | Duration (ms) before an entry is evicted | 300 000 (5min) |

Choose values based on data volatility:

| Data type | freshTime | gcTime | Rationale |
|-----------|-----------|--------|-----------|
| User profile | 60s | 10min | Rarely changes |
| Entity list | 30s | 5min | May change on mutations |
| Dashboard aggregates | 15s | 3min | Changes frequently |
| Notification count | 5s | 1min | Near real-time |

**Golden rule: invalidation marks entries as STALE, it never deletes them.** This ensures users always see something while fresh data loads.

## Cache Keys

Cache keys uniquely identify each piece of data. They're structured as arrays following a hierarchical convention:

```
['domain', 'scope', ...identifiers]
```

Examples:

```typescript
['order', 'list']                    // All orders
['order', 'details', '42']          // Order #42
['order', 'details', '42', 'items'] // Items of order #42
['product', 'list']                 // All products
['product', 'details', 'abc']       // Product abc
['user', 'profile']                 // Current user profile
```

Keys are serialized with `JSON.stringify()` for Map lookups. The array structure enables prefix-based invalidation (see next section).

## Prefix-Based Invalidation

Invalidation uses prefix matching — any entry whose key **starts with** the given prefix is marked stale:

```
invalidate(['order'])                       →  matches ALL order entries
invalidate(['order', 'list'])               →  matches only the order list
invalidate(['order', 'details', '42'])      →  matches only order #42 details
```

Visualized as a tree:

```
order
├── list                          ← invalidate(['order']) hits this
├── details
│   ├── 42                        ← invalidate(['order']) hits this too
│   │   └── items                 ← and this
│   └── 43
└── stats
product
├── list                          ← NOT hit by invalidate(['order'])
└── details
    └── abc
```

This is powerful for mutations: editing order #42 can invalidate just `['order', 'details', '42']` (that specific entity) plus `['order', 'list']` (the list that contains it), while leaving `['product', ...]` untouched.

## Request Deduplication

Without deduplication, two components mounting simultaneously and requesting the same data would trigger two identical HTTP requests.

The cache solves this by storing in-flight Promises. When a fetch is already in progress for a given key, subsequent callers receive the same Promise instead of starting a new request:

```
Component A requests ['order', 'list']  ──┐
                                          ├──▶  single HTTP request  ──▶  both receive same data
Component B requests ['order', 'list']  ──┘
```

Once the Promise resolves, it's removed from the in-flight map and the result is written to the cache normally.

## Stale-While-Revalidate (SWR)

SWR is the core UX optimization. Here's what happens when a user returns to a screen they've already visited:

### Without SWR

```
User navigates to Orders
       │
       ▼
  [ Spinner... ]     ← 200-500ms of nothing
       │
       ▼
  Data arrives → display
```

### With SWR

```
User navigates to Orders
       │
       ├──▶ Cache returns stale data → display instantly (0ms)
       │
       └──▶ Background fetch starts silently
                    │
                    ▼
              Fresh data arrives → display updates (no spinner)
```

The user sees data **immediately**. If the background fetch returns identical data, nothing changes visually. If the data has changed, the UI updates seamlessly. Either way, there's no spinner.

---

## Implementation Guide

### DataCache Class

```typescript
interface CacheEntry<T> {
  data: T;
  createdAt: number;
}

interface DataCacheConfig {
  freshTime: number; // ms before entry becomes stale
  gcTime: number;    // ms before entry is evicted
}

class DataCache<T> {
  readonly #entries = new Map<string, CacheEntry<T>>();
  readonly #inFlight = new Map<string, Promise<T>>();
  readonly #config: DataCacheConfig;

  constructor(config: DataCacheConfig) {
    this.#config = config;
  }

  get(key: string[]): { data: T; fresh: boolean } | null {
    const serialized = JSON.stringify(key);
    const entry = this.#entries.get(serialized);
    if (!entry) return null;

    const age = Date.now() - entry.createdAt;
    if (age > this.#config.gcTime) {
      this.#entries.delete(serialized);
      return null; // expired → evict
    }

    return { data: entry.data, fresh: age <= this.#config.freshTime };
  }

  set(key: string[], data: T): void {
    this.#entries.set(JSON.stringify(key), { data, createdAt: Date.now() });
  }

  has(key: string[]): boolean {
    return this.get(key) !== null;
  }

  invalidate(keyPrefix: string[]): void {
    const prefix = JSON.stringify(keyPrefix).slice(0, -1); // remove trailing ]
    for (const key of this.#entries.keys()) {
      if (key.startsWith(prefix)) {
        const entry = this.#entries.get(key)!;
        entry.createdAt = Date.now() - this.#config.freshTime - 1; // mark stale
      }
    }
  }

  clear(): void {
    this.#entries.clear();
    this.#inFlight.clear();
  }

  async deduplicate(key: string[], fetchFn: () => Promise<T>): Promise<T> {
    const serialized = JSON.stringify(key);
    const existing = this.#inFlight.get(serialized);
    if (existing) return existing;

    const promise = fetchFn().finally(() => this.#inFlight.delete(serialized));
    this.#inFlight.set(serialized, promise);
    return promise;
  }
}
```

### Invalidation Service

A shared signal that stores include in their resource params. When it increments, all listening resources automatically reload.

```typescript
@Injectable({ providedIn: 'root' })
export class OrderInvalidationService {
  readonly #version = signal(0);
  readonly version = this.#version.asReadonly();

  invalidate(): void {
    this.#version.update((v) => v + 1);
  }
}
```

Create one per domain (orders, products, users) or share a single one if your domains are tightly coupled.

### Resource Loader Pattern

This is the core integration point — a resource loader that consults the cache before fetching:

```typescript
readonly #cache = inject(OrderApi).cache; // DataCache instance owned by the API

readonly orders = resource<Order[], { version: number }>({
  params: () => ({ version: this.#invalidationService.version() }),
  loader: async () => {
    const key = ['order', 'list'];
    const cached = this.#cache.get(key);

    if (cached?.fresh) return cached.data;            // FRESH → return, no fetch
    if (cached) this.#staleData.set(cached.data);     // STALE → seed display

    const data = await this.#cache.deduplicate(key, () =>
      firstValueFrom(this.#orderApi.getAll$()),
    );
    this.#cache.set(key, data);
    return data;
  },
});
```

The `#staleData` signal provides instant display while the resource is in `loading` state (see Seeding below).

### Seeding on Params Change

When the user navigates from entity #3 to entity #4, the resource enters `loading` state. Seeding injects cached data so the user never sees a spinner:

```typescript
readonly #staleData = signal<Order | null>(null);

readonly orderDetails = computed(() =>
  this.#orderResource.error()
    ? this.#staleData()
    : (this.#orderResource.value() ?? this.#staleData()),
);

readonly isInitialLoading = computed(
  () => this.#orderResource.status() === 'loading' && !this.#staleData(),
);

setOrderId(id: string): void {
  const cached = this.#cache.get(['order', 'details', id]);
  this.#staleData.set(cached?.data ?? null); // seed before params change
  this.#orderId.set(id);                     // triggers resource reload
}
```

Key: set stale data **before** changing the param. This way, when the resource transitions to `loading`, `isInitialLoading` is already `false` because `#staleData` has a value.

### Prefetching

#### App-Level Prefetch

Preload critical data at startup so the first navigation is instant:

```typescript
@Injectable({ providedIn: 'root' })
export class PreloadService {
  readonly #orderApi = inject(OrderApi);
  readonly #productApi = inject(ProductApi);
  readonly #hasPreloaded = signal(false);

  constructor() {
    effect(() => {
      if (this.#authState.isAuthenticated() && !untracked(this.#hasPreloaded)) {
        this.#hasPreloaded.set(true);
        untracked(() => this.#preload());
      }
    });
  }

  async #preload(): Promise<void> {
    await Promise.allSettled([
      firstValueFrom(this.#orderApi.getAll$()),
      firstValueFrom(this.#productApi.getCategories$()),
    ]);
  }
}
```

Register it with `provideAppInitializer(() => inject(PreloadService))`.

#### Contextual Prefetch

Preload adjacent items when viewing a list item detail:

```typescript
constructor() {
  effect(() => {
    const currentIndex = this.#currentIndex();
    const items = this.#itemList();
    if (!items.length) return;

    // Prefetch previous and next items
    const adjacentIds = [items[currentIndex - 1]?.id, items[currentIndex + 1]?.id]
      .filter(Boolean);

    untracked(() => {
      for (const id of adjacentIds) {
        if (!this.#cache.has(['item', 'details', id])) {
          firstValueFrom(this.#itemApi.getDetails$(id)).then((data) =>
            this.#cache.set(['item', 'details', id], data),
          );
        }
      }
    });
  });
}
```

---

## Integration Workflows

### Workflow 1: Tab Navigation

User switches between tabs that display different data sets.

```
1. App launches
   └── PreloadService fetches Tab A + Tab B data → cache populated

2. User on Tab A
   └── resource loader → cache FRESH → instant display, no fetch

3. User switches to Tab B
   └── resource loader → cache FRESH → instant display, no fetch

4. 45 seconds later, user returns to Tab A
   └── resource loader → cache STALE → instant display + background refresh
   └── fresh data arrives → UI updates silently
```

### Workflow 2: Detail Navigation (Next/Previous)

User navigates between items in a list.

```
1. User views Item #3
   └── display Item #3
   └── effect() prefetches Item #2 and Item #4

2. User navigates to Item #4
   └── setItemId('4') → seeds staleData from cache
   └── resource reloads → cache FRESH → instant display
   └── effect() prefetches Item #3 (already cached) and Item #5

3. User goes back to Item #3
   └── setItemId('3') → seeds staleData from cache
   └── instant display, no spinner
```

### Workflow 3: Mutation with Cascade Invalidation

A mutation on one entity impacts related data.

```
1. User edits Item #3
   └── optimistic update → UI reflects change immediately

2. Server confirms
   └── cache.invalidate(['item', 'details', '3'])   → marks item #3 stale
   └── cache.invalidate(['item', 'list'])            → marks list stale
   └── invalidationService.invalidate()              → version++

3. All listening stores reload
   └── resource loaders find STALE cache → instant display + background fetch
   └── fresh data arrives → UI updates if different

4. User navigates to Item #4
   └── STALE cache → instant display + background refresh
```

### Workflow 4: First Visit (Cold Cache)

No cached data exists yet.

```
1. App launches → PreloadService starts fetching in background

2. User navigates to Orders
   ├── IF preload finished  → cache FRESH → instant display, no spinner
   └── IF preload pending   → cache MISS  → spinner → data arrives → display

3. All subsequent navigations benefit from cache
   └── return visits show stale data instantly
   └── other screens may already be prefetched
```

---

## Loading States

### Decision Table

| Situation | Cache state | Resource status | Display |
|-----------|-------------|-----------------|---------|
| First visit, no prefetch | MISS | `loading` | Spinner |
| First visit, prefetched | FRESH | `resolved` | Data (instant) |
| Return visit | STALE | `loading` → `resolved` | Data (stale → fresh) |
| After mutation | STALE | `reloading` | Data + silent refresh |
| Network error on refresh | STALE | `error` | Stale data (no crash) |
| Network error, cold cache | MISS | `error` | Error state |

### isInitialLoading Pattern

The key insight: only show a spinner when there's truly nothing to display — no cached data and no stale seed.

```typescript
/** true only on first load with empty cache, false during SWR revalidation */
readonly isInitialLoading = computed(
  () => this.#resource.status() === 'loading' && !this.#staleData(),
);
```

In the template:

```html
@if (store.isInitialLoading()) {
  <loading-spinner />
} @else if (store.orderDetails(); as details) {
  <order-detail [order]="details" />
} @else {
  <empty-state />
}
```

---

## Best Practices

### When to Cache

- **Read operations** (GET) returning entity or list data
- **Data consumed by multiple screens** — a shared cache avoids redundant fetches
- **Data with predictable access patterns** — next/previous navigation, tab switching
- **Aggregated data** — dashboards, summaries, counts

### When NOT to Cache

- **Mutations** (POST, PUT, DELETE) — these change server state, they don't read it
- **Search and filter results** — volatile keys that rarely repeat
- **One-time operations** — authentication, file uploads, password resets
- **Real-time data** — WebSocket streams, SSE, polling with sub-second intervals
- **Large binaries** — files, images, blobs (use browser cache or CDN)

### Adding Cache to a New Domain

1. **Create a `DataCache` instance** in the Feature API service:
   ```typescript
   readonly cache = new DataCache<YourType>({ freshTime: 30_000, gcTime: 300_000 });
   ```

2. **Define key conventions** for the domain:
   ```typescript
   // Convention: ['domain', 'scope', ...ids]
   ['invoice', 'list']
   ['invoice', 'details', invoiceId]
   ```

3. **Wire the API methods** to read/write the cache:
   ```typescript
   getAll$(): Observable<Invoice[]> {
     return this.#api.get$('/invoices', schema).pipe(
       tap((res) => this.cache.set(['invoice', 'list'], res.data)),
     );
   }
   ```

4. **Update resource loaders** in stores to use the cache-first pattern (see Implementation Guide).

5. **Connect invalidation** — call `cache.invalidate()` after mutations:
   ```typescript
   delete$(id: string): Observable<void> {
     return this.#api.deleteVoid$(`/invoices/${id}`).pipe(
       tap(() => {
         this.cache.invalidate(['invoice']);
         this.#invalidation.invalidate();
       }),
     );
   }
   ```

---

## Anti-Patterns

| Don't | Do | Why |
|-------|-----|-----|
| Cache in the store | Cache in the Feature API (singleton) | Stores are route-scoped — cache is lost on navigation |
| Delete cache entries on invalidation | Mark them stale | Deleting removes data the user could see instantly |
| Cache mutation responses | Invalidate + let resources refetch | Mutation responses may be partial; refetching ensures consistency |
| Use raw timestamps as cache keys | Use stable identifiers `['domain', 'scope', id]` | Timestamps create unique keys that never hit cache |
| Deduplicate with `shareReplay()` | Use the in-flight Promise map | `shareReplay` replays to late subscribers even after completion; Promise map is simpler and scoped |
| Show spinners during SWR | Use `isInitialLoading` pattern | Spinners during background refresh destroy the instant-feel UX |
| Prefetch everything at startup | Prefetch only critical-path data | Over-prefetching wastes bandwidth and slows initial load |
| Set `gcTime` to `Infinity` | Use finite eviction times | Memory grows unbounded in long-lived sessions |
| Cache user-specific data without scoping | Include user/session in keys or clear on logout | Stale user data leaking across sessions is a security risk |
| Bypass the cache for "just this one call" | Always go through the cache layer | Inconsistent paths lead to stale displays and hard-to-debug issues |

---

## Prior Art

This pattern draws inspiration from well-established approaches to client-side data caching:

- **RFC 5861** — the HTTP `stale-while-revalidate` cache-control extension that formalized the SWR concept
- **TanStack Query** — `staleTime`, `gcTime`, structured query keys, `prefetchQuery`, automatic background refetching
- **SWR by Vercel** — the React hook library that popularized stale-while-revalidate in the frontend ecosystem
- **@unkey/cache** — fresh/stale/expired TTL tiers with a clean layered API

Implemented without external dependencies. 100% Angular signals + `resource()` + in-memory `Map`.
