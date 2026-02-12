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

All HTTP calls go through `ApiClient`. Never inject `HttpClient` directly.

```typescript
@Injectable({ providedIn: 'root' })
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

Zod validation is enforced by design — no schema, no call.

## Store Anatomy (6 sections)

```typescript
@Injectable()
export class FeatureStore {
  // ── 1. Dependencies ──
  readonly #api = inject(FeatureApi);
  readonly #logger = inject(Logger);

  // ── 2. State ──
  readonly #budgetId = signal<string | null>(null);
  readonly #errorMessage = signal<string | null>(null);

  // ── 3. Resource (data loading) ──
  readonly #resource = resource({
    params: () => this.#budgetId(),
    loader: async ({ params }) => {
      if (!params) throw new Error('ID required');
      return firstValueFrom(this.#api.getById$(params));
    },
  });

  // ── 4. Selectors (computed) ──
  readonly data = computed(() => this.#resource.value() ?? null);
  readonly isLoading = computed(() => this.#resource.isLoading());
  readonly error = computed(() => this.#resource.error() || this.#errorMessage());

  // ── 5. Mutations (public methods) ──
  async createItem(data: ItemCreate): Promise<void> { /* ... */ }
  async deleteItem(id: string): Promise<void> { /* ... */ }

  // ── 6. Private utils ──
  #setError(msg: string): void { this.#errorMessage.set(msg); }
  #clearError(): void { this.#errorMessage.set(null); }
}
```

## Data Loading

Use `resource()` for fetch-on-signal-change, `rxResource()` when Observable chains are needed.

```typescript
// resource() — simple async loader
readonly #detailsResource = resource({
  params: () => this.#itemId(),
  loader: async ({ params }) =>
    firstValueFrom(this.#api.getDetails$(params)),
});

// rxResource() — Observable streams, auto-cancellation
readonly #dashboardResource = rxResource({
  params: () => ({
    month: this.period().month,
    version: this.#invalidation.version(), // cache bust
  }),
  stream: ({ params }) => this.#loadDashboard$(params),
});
```

## Mutations: async/await

```typescript
async createItem(data: ItemCreate): Promise<void> {
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
  } catch {
    // 4. Rollback
    this.#resource.reload();
    this.#setError("Erreur lors de l'ajout");
  }
}
```

## Cache Invalidation

Use a version signal to trigger cross-store reloads:

```typescript
// Shared invalidation service
@Injectable({ providedIn: 'root' })
export class FeatureInvalidationService {
  readonly #version = signal(0);
  readonly version = this.#version.asReadonly();
  invalidate(): void { this.#version.update((v) => v + 1); }
}

// In store — include version in resource params
readonly #resource = rxResource({
  params: () => ({
    id: this.#itemId(),
    version: this.#invalidation.version(),
  }),
  stream: ({ params }) => this.#api.getById$(params.id),
});
```

## SWR (Stale-While-Revalidate)

```typescript
readonly isInitialLoading = computed(
  () => this.#resource.status() === 'loading',
);
// Use isInitialLoading for spinner — on 'reloading', show stale data
```

## Scoping

| Scope | Usage | Example |
|-------|-------|---------|
| `@Injectable()` | Feature stores (route-scoped) | `BudgetDetailsStore` |
| `providedIn: 'root'` | Shared services, APIs, caches | `BudgetApi`, `HasBudgetCache` |

Feature stores are registered in route providers:

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

All errors from `ApiClient` are `ApiError` instances:

```typescript
import { isApiError } from '@core/api/api-error';

catch (error) {
  if (isApiError(error) && error.code === 'ERR_NOT_FOUND') {
    this.#setError('Élément introuvable');
  } else {
    this.#setError('Erreur inattendue');
  }
  this.#logger.error('Operation failed', error);
}
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `inject(HttpClient)` in API service | `inject(ApiClient)` |
| `http.get<T>()` without validation | `api.get$(path, zodSchema)` |
| Manual `catchError` in API service | Let `ApiClient` normalize errors |
| `providedIn: 'root'` on feature store | `@Injectable()` + route providers |
| `subscribe()` in mutations | `async/await` + `firstValueFrom()` |
| `effect()` for derived state | `computed()` or `linkedSignal()` |
| Mutate signal arrays in place | Spread: `[...items, newItem]` |

## Reference Implementations

| Store | File | Pattern |
|-------|------|---------|
| `BudgetDetailsStore` | `feature/budget/budget-details/store/` | `resource()`, optimistic updates, temp IDs, mutation queue |
| `CurrentMonthStore` | `feature/current-month/services/` | `rxResource()`, SWR, invalidation version |
