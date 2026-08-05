---
description: "Angular signal-based store patterns for state management"
paths:
  - "frontend/**/*-store.ts"
  - "frontend/**/*-api.ts"
  - "frontend/**/*state*.ts"
---

# Store & API Pattern

> **Signal API Reference**: See `angular-signals.md` for `signal()`, `computed()`, `resource()` details.

## Architecture: 3 Layers

```
Component → Store → Feature API → ApiClient
             ↑           ↑            ↑
         signals    Observables   Zod + HTTP
```

| Layer | Responsibility | Returns |
|-------|---------------|---------|
| `ApiClient` (core) | HTTP + Zod parse + error normalization | `Observable<T>` |
| Feature API | Domain endpoints, cache sync | `Observable<T>` |
| Store | State, resource, selectors, mutations | Signals |
| Component | Read signals, call mutations | — |

## ApiClient Usage

All HTTP calls via `ApiClient`. Never inject `HttpClient` direct.

```typescript
@Service()
export class FeatureApi {
  readonly #api = inject(ApiClient);

  getItems$(): Observable<ItemListResponse> {
    return this.#api.get$('/items', itemListResponseSchema);
  }

  createItem$(data: ItemCreate): Observable<ItemResponse> {
    return this.#api.post$('/items', data, itemResponseSchema);
  }

  deleteItem$(id: string): Observable<void> {
    return this.#api.deleteVoid$(`/items/${id}`);
  }
}
```

Zod validation enforced by design — no schema, no call.

## Store Anatomy (5 sections)

```typescript
@Service({ autoProvided: false })
export class FeatureStore {
  // ── 1. Dependencies ──
  readonly #api = inject(FeatureApi);
  readonly #logger = inject(Logger);

  // ── 2. State ──
  readonly #budgetId = signal<string | null>(null);

  // ── 3. Resource (data loading) ──
  readonly #resource = cachedResource<Feature, { id: string }>({
    cache: this.#api.cache,
    cacheKey: (params) => ['feature', params.id],
    params: () => {
      const id = this.#budgetId();
      return id ? { id } : undefined;
    },
    // Hand the Observable over rather than awaiting it — only that form lets
    // the resource unsubscribe on `abortSignal` and cancel the request it left.
    loader: ({ params }) => this.#api.getById$(params.id),
  });

  // ── 4. Selectors (computed) ──
  readonly data = computed(() => this.#resource.value() ?? null);
  readonly isLoading = computed(() => this.#resource.isLoading());
  readonly error = this.#resource.error;

  // ── 5. Mutations (public methods) ──
  // `null` = it went through; a string = the reason the caller must surface.
  async createItem(data: ItemCreate): Promise<string | null> { /* ... */ }
  async deleteItem(id: string): Promise<string | null> { /* ... */ }
}
```

### Where a failure lands

A store's `error` signal says **one thing: the resource could not be loaded**.
Pages render it as a card that replaces the whole screen, so anything else
written there blanks the page. A refused mutation is not an unloadable
resource — it travels back through the mutation's own return value, and the
caller decides how to surface it (a toast, an inline message).

## Store Variants

### Variant A: Signals-Only Store
Local UI state or synced state, no async data loading.

| Element | Usage |
|---------|-------|
| `signal()` | Writable state |
| `computed()` | Derived selectors |
| Methods | Synchronous set/update |

Example: `CompleteProfileStore` — manages form steps + validation state.

### Variant B: Resource-Backed Store
API-fetched data, async loading, mutations, cache mgmt.

| Element | Usage |
|---------|-------|
| `resource()` / `rxResource()` | Async data loading |
| `signal()` | Internal state (filters, IDs) |
| `computed()` | Derived selectors, loading states |
| `async` methods | Mutations with optimistic updates |

Example: `BudgetDetailsStore` — loads budget details, optimistic CRUD.

## Data Loading

A store loads through `cachedResource()` — twelve files do, and it is what makes a
second visit render instantly instead of re-fetching. `params` returning `undefined`
is how you say "not ready yet"; the loader then never runs.

Bare `resource()` and `rxResource()` stay available for the cases the cache does not
serve: a one-shot lookup inside a component (`search-transactions-dialog.ts`,
`live-conversion-preview.ts`) or an Observable chain that must re-subscribe
(`tag-history-dialog.ts`). Neither belongs in a store.

## Mutations: async/await

```typescript
async createItem(data: ItemCreate): Promise<string | null> {
  const tempId = `temp-${uuidv4()}`;

  // 1. Optimistic update
  this.#resource.update((current) => {
    if (!current) return current;
    return { ...current, items: [...current.items, { ...data, id: tempId }] };
  });

  try {
    // 2. Persist
    const response = await firstValueFrom(this.#api.create$(data));

    // 3. Replace temp with real
    this.#resource.update((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === tempId ? response.data : item,
        ),
      };
    });
    return null;
  } catch {
    // 4. Rollback, then hand the reason back to the caller
    this.#resource.reload();
    return "Erreur lors de l'ajout";
  }
}
```

## Temp ID Rule (DR-005)

Creating item with temp ID: **always replace temp ID with real server ID BEFORE** cascade actions (invalidation, dependent API calls).

### Correct order:
```typescript
// 1. Optimistic update with temp ID
this.#resource.update(current => ({
  ...current,
  items: [...current.items, { ...data, id: tempId }],
}));

// 2. API call
const response = await firstValueFrom(this.#api.create$(data));

// 3. Replace temp → real (BEFORE cascade)
this.#resource.update(current => ({
  ...current,
  items: current.items.map(i => i.id === tempId ? response.data : i),
}));

// 4. NOW safe to cascade
this.#api.cache.invalidate(['items']);
```

### Bug if wrong order:
```typescript
// WRONG — cascade uses temp ID
const response = await firstValueFrom(this.#api.create$(data));
this.#api.cache.invalidate(['items']); // Other stores reload, see "temp-xxx"
this.#resource.update(...); // Too late, temp ID already leaked

// WRONG — using temp ID in follow-up call
await this.#api.toggleCheck$(tempId); // 404 — server doesn't know "temp-xxx"
```

## Cache Invalidation

Cross-store reloads go through the cache, by key prefix — `invalidate(['budget'])`
drops every entry under it, so the next `cachedResource()` reading `['budget', …]`
refetches. There is no version signal and no invalidation service.

```typescript
// Inside a cachedMutation — the write touched budget data, so say so
onSuccess: (_result, input) => {
  if (input.monthlyContribution != null) {
    this.#budgetApi.cache.invalidate(['budget']);
    this.#budgetTemplatesApi.cache.invalidate(['templates']);
  }
},
```

A mutation whose own keys are enough declares them as `invalidateKeys` instead of
calling `invalidate()` by hand. See `angular-cache-swr.md`.

## SWR (Stale-While-Revalidate)

```typescript
readonly isInitialLoading = computed(
  () => this.#resource.status() === 'loading',
);
// Use isInitialLoading for spinner — on 'reloading', show stale data
```

## DataCache (Shared SWR Cache)

See `angular-cache-swr.md` — cache placement, `staleTime` / `expireTime`, freshness
states, cache keys, `cachedResource()` and `cachedMutation()` are documented there.

A store never instantiates `DataCache`; it reads `this.#api.cache`.

### Cache-First Read in an Imperative Store Method

Store resources go through `cachedResource()`, which does the cache wiring itself.
Only a one-shot read triggered by a user action still touches the cache by hand —
`deduplicate()` keeps concurrent callers on a single request:

```typescript
async checkUsage(templateId: string): Promise<TemplateUsageResponse['data']> {
  const cacheKey: string[] = ['templates', 'usage', templateId];
  const cached = this.#api.cache.get<TemplateUsageResponse['data']>(cacheKey);

  if (cached?.fresh) return cached.data;

  const freshPromise = this.#api.cache.deduplicate(cacheKey, async () => {
    const response = await firstValueFrom(this.#api.checkUsage$(templateId));
    this.#api.cache.set(cacheKey, response.data);
    return response.data;
  });

  if (cached) return cached.data;  // stale — return while refetch runs
  return freshPromise;             // miss — await fresh data
}
```

## Scoping

| Scope | Usage | Example |
|-------|-------|---------|
| `@Service({ autoProvided: false })` | Feature stores (route-scoped) | `BudgetDetailsStore` |
| `@Service()` | Shared services, APIs, caches | `BudgetApi`, `HasBudgetCache` |

Feature stores registered in route providers:

```typescript
export default [
  {
    path: '',
    providers: [FeatureApi, FeatureStore],
    children: [{ path: ':id', loadComponent: () => import('./page') }],
  },
] satisfies Routes;
```

## Error Handling

All `ApiClient` errors are `ApiError` instances:

```typescript
import { isApiError } from '@core/api/api-error';

catch (error) {
  this.#logger.error('Operation failed', error);
  return isApiError(error) && error.code === 'ERR_NOT_FOUND'
    ? 'Élément introuvable'
    : 'Erreur inattendue';
}
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `inject(HttpClient)` in API service | `inject(ApiClient)` |
| `http.get<T>()` without validation | `api.get$(path, zodSchema)` |
| Manual `catchError` in API service | Let `ApiClient` normalize errors |
| `@Service()` on feature store | `@Service({ autoProvided: false })` + route providers |
| `subscribe()` in mutations | `async/await` + `firstValueFrom()` |
| `effect()` for derived state | `computed()` or `linkedSignal()` |
| Mutate signal arrays in place | Spread: `[...items, newItem]` |
| `#staleData` signal in store | `cachedResource()` already serves the stale value while it refetches |
| `error` mixing resource and mutation failures | `error = this.#resource.error`; mutations return their reason |
| Reading success from `response !== undefined` | A `void` mutation resolves `undefined` on success too — read the returned reason |

## Reference Implementations

| Store | File | Pattern |
|-------|------|---------|
| `BudgetDetailsStore` | `feature/budget/budget-details/store/budget-details-store.ts` | `cachedResource()`, optimistic updates with per-call rollback, prefetch of adjacent budgets, mutation reasons returned to the caller |
| `DashboardStore` | `feature/current-month/services/dashboard-store.ts` | `cachedResource()`, SWR, `cachedMutation()` with `invalidateKeys` |
| `TemplateLineStore` | `feature/budget-templates/details/services/template-line-store.ts` | Optimistic creates with temp IDs (`TEMP_ID_PREFIX`) |
| `BudgetListStore` | `feature/budget/budget-list/budget-list-store.ts` | `cachedResource()`, `linkedSignal` |