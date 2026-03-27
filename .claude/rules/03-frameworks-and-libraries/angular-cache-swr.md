---
description: "Angular ngx-ziflux SWR cache pattern for resource loading"
paths:
  - "frontend/**/*-api.ts"
  - "frontend/**/*-store.ts"
  - "frontend/**/*cache*.ts"
  - "frontend/**/*preload*.ts"
---

# Cache & SWR Pattern (ngx-ziflux)

> **Library**: `ngx-ziflux` — SWR caching for Angular `resource()` API
> **Expert skill**: Use `/ziflux-expert` for detailed API reference

## Architecture

Cache lives in the **Feature API layer** (singleton), never in stores (route-scoped).

```
Component → Store → Feature API → ApiClient
                        │
                    DataCache (ngx-ziflux)
```

- Singletons survive navigation → cache persists
- Multiple stores share one cache → no duplication
- Store reads `this.#api.cache`, never instantiates `DataCache`

## DataCache (ngx-ziflux)

```typescript
// In Feature API (providedIn: 'root')
readonly cache = new DataCache({
  name: 'orders',
  staleTime: 30_000,    // 30s — data considered fresh
  expireTime: 300_000,  // 5min — data evicted
});
```

Key methods:
- `cache.get<T>(key: string[])` → `{ data: T; fresh: boolean } | null`
- `cache.set<T>(key: string[], data: T)` → write to cache
- `cache.invalidate(prefix: string[])` → marks stale (never deletes)
- `cache.prefetch<T>(key: string[], fn)` → one in-flight per key
- `cache.clear()` → full wipe
- `cache.version` → `Signal<number>`, bumps on invalidate/clear

## Freshness: 3 States

```
FRESH (return, no fetch) → STALE (return + background fetch) → EXPIRED (evict, fetch)
```

| Data type | staleTime | expireTime |
|-----------|-----------|------------|
| Rarely changes | 60s | 10min |
| Normal entities | 30s | 5min |
| Frequently updated | 15s | 3min |

**Rule: invalidation = mark STALE, never delete.**

## cachedResource (replaces manual resource + cache wiring)

```typescript
readonly orders = cachedResource({
  cache: this.#api.cache,
  cacheKey: ['orders', 'list'],
  loader: () => this.#api.getOrders(),
});
```

Returns `CachedResourceRef<T>` with: `value()`, `status()`, `isLoading()`, `isInitialLoading()`, `isStale()`, `error()`, `reload()`, `set()`, `update()`.

Only show spinner when `isInitialLoading()` is true (cold cache only).

## cachedMutation (replaces manual mutation + invalidation)

```typescript
readonly deleteOrder = cachedMutation({
  cache: this.#api.cache,
  mutationFn: (id: string) => this.#api.deleteOrder(id),
  invalidateKeys: (id) => [['orders']],
  onMutate: (id) => { /* optimistic update; return context */ },
  onSuccess: (result, id) => { /* after invalidation */ },
  onError: (err, id, context) => { /* rollback */ },
});
```

Key behaviors:
- `mutate()` **never rejects** — errors go to `error` signal
- `error` is **reset to `undefined`** at the start of each `mutate()` call
- Returns `undefined` on error, result on success

## Cache Keys

Convention: `['domain', 'scope', ...identifiers]`

```typescript
['budget', 'list']
['budget', 'details', budgetId]
['budget', 'dashboard', month, year]
```

Prefix invalidation: `invalidate(['budget'])` → matches ALL budget entries.

**Gotcha:** `invalidate(['order'])` does NOT match `['orders']`.
**Gotcha:** `invalidate([])` is a no-op — use `clear()` for full wipe.

## Prefetch

```typescript
// In PreloadService or store
await this.#api.cache.prefetch(['budget', 'list'], () =>
  firstValueFrom(this.#api.getAllBudgets$()),
);
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `DataCache` in route-scoped service | `DataCache` in `providedIn: 'root'` API |
| Manual resource + cache wiring | `cachedResource()` from ngx-ziflux |
| `tap(() => cache.invalidate(...))` in API methods | `invalidateKeys` in `cachedMutation` |
| `try/catch` on `mutate()` for errors | Check `mutation.error()` signal |
| Show spinner during SWR | Use `isInitialLoading` (cold cache only) |
| `cache.clear()` for partial invalidation | `cache.invalidate(prefix)` |
| `staleTime > expireTime` | Constructor throws |
