---
description: "Angular DataCache & SWR pattern for cache-first resource loading"
paths:
  - "frontend/**/*-api.ts"
  - "frontend/**/*-store.ts"
  - "frontend/**/*cache*.ts"
  - "frontend/**/*preload*.ts"
---

# Cache & SWR Pattern

> **Full documentation**: `docs/angular-cache-swr-pattern.md`

## DataCache: Where & Why

Cache lives in the **Feature API layer** (singleton), never in stores (route-scoped).

```
Component → Store → Feature API → ApiClient
                        │
                    DataCache (Map)
```

- Singletons survive navigation → cache persists
- Multiple stores share one cache → no duplication
- Stores don't know cache exists → transparent

## DataCache Class

```typescript
interface CacheEntry<T> { data: T; createdAt: number; }

class DataCache<T> {
  readonly #entries = new Map<string, CacheEntry<T>>();
  readonly #inFlight = new Map<string, Promise<T>>();

  constructor(readonly config: { freshTime: number; gcTime: number }) {}

  get(key: string[]): { data: T; fresh: boolean } | null {
    const s = JSON.stringify(key);
    const entry = this.#entries.get(s);
    if (!entry) return null;
    const age = Date.now() - entry.createdAt;
    if (age > this.config.gcTime) { this.#entries.delete(s); return null; }
    return { data: entry.data, fresh: age <= this.config.freshTime };
  }

  set(key: string[], data: T): void {
    this.#entries.set(JSON.stringify(key), { data, createdAt: Date.now() });
  }

  has(key: string[]): boolean { return this.get(key) !== null; }

  invalidate(prefix: string[]): void {
    const p = JSON.stringify(prefix).slice(0, -1);
    for (const [k, entry] of this.#entries) {
      if (k.startsWith(p)) entry.createdAt = Date.now() - this.config.freshTime - 1;
    }
  }

  clear(): void { this.#entries.clear(); this.#inFlight.clear(); }

  async deduplicate(key: string[], fn: () => Promise<T>): Promise<T> {
    const s = JSON.stringify(key);
    const existing = this.#inFlight.get(s);
    if (existing) return existing;
    const p = fn().finally(() => this.#inFlight.delete(s));
    this.#inFlight.set(s, p);
    return p;
  }
}
```

## Freshness: 3 States

```
FRESH (return, no fetch) → STALE (return + background fetch) → EXPIRED (evict, fetch)
```

| Data type | freshTime | gcTime |
|-----------|-----------|--------|
| Rarely changes | 60s | 10min |
| Normal entities | 30s | 5min |
| Frequently updated | 15s | 3min |

**Rule: invalidation = mark STALE, never delete.**

## Cache Keys

Convention: `['domain', 'scope', ...identifiers]`

```typescript
['order', 'list']
['order', 'details', '42']
```

Prefix invalidation: `invalidate(['order'])` → matches ALL order entries.

## Resource Loader: Cache-First

```typescript
readonly #resource = resource({
  params: () => ({ version: this.#invalidation.version() }),
  loader: async () => {
    const key = ['order', 'list'];
    const cached = this.#cache.get(key);
    if (cached?.fresh) return cached.data;
    if (cached) this.#staleData.set(cached.data);
    const data = await this.#cache.deduplicate(key, () =>
      firstValueFrom(this.#orderApi.getAll$()),
    );
    this.#cache.set(key, data);
    return data;
  },
});
```

## SWR Computed

```typescript
readonly #staleData = signal<Order[] | null>(null);

readonly orders = computed(() =>
  this.#resource.error() ? this.#staleData() : (this.#resource.value() ?? this.#staleData()),
);

readonly isInitialLoading = computed(
  () => this.#resource.status() === 'loading' && !this.#staleData(),
);
```

Only show spinner when `isInitialLoading()` is true.

## Seeding on Params Change

Set stale data **before** changing the param:

```typescript
setOrderId(id: string): void {
  const cached = this.#cache.get(['order', 'details', id]);
  this.#staleData.set(cached?.data ?? null);
  this.#orderId.set(id);
}
```

## Prefetch

### App-level (PreloadService)

```typescript
effect(() => {
  if (this.#auth.isAuthenticated() && !untracked(this.#done)) {
    this.#done.set(true);
    untracked(() => Promise.allSettled([
      firstValueFrom(this.#orderApi.getAll$()),
      firstValueFrom(this.#productApi.getCategories$()),
    ]));
  }
});
```

### Contextual (adjacent items)

```typescript
effect(() => {
  const idx = this.#currentIndex();
  const items = this.#list();
  const ids = [items[idx - 1]?.id, items[idx + 1]?.id].filter(Boolean);
  untracked(() => {
    for (const id of ids) {
      if (!this.#cache.has(['item', 'details', id])) {
        firstValueFrom(this.#api.getDetails$(id))
          .then((d) => this.#cache.set(['item', 'details', id], d));
      }
    }
  });
});
```

## Mutation → Invalidation

```typescript
// In Feature API
delete$(id: string): Observable<void> {
  return this.#api.deleteVoid$(`/items/${id}`).pipe(
    tap(() => {
      this.cache.invalidate(['item']);
      this.#invalidation.invalidate();
    }),
  );
}
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Cache in the store | Cache in Feature API (singleton) |
| Delete entries on invalidation | Mark them stale |
| Cache mutation responses | Invalidate + refetch |
| Show spinner during SWR | Use `isInitialLoading` |
| Skip cache for "just this call" | Always go through cache |
| `gcTime: Infinity` | Finite eviction |
