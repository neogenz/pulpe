---
description: "Pulpe Angular store/state/api pattern (phase 1 reference)"
paths:
  - "frontend/projects/webapp/src/app/**/*.ts"
---

# Store/State/API Pattern

## Architecture

```
Component -> Feature Store -> Feature API -> ApiClient -> Backend
```

- `ApiClient`: centralized HTTP + Zod validation + error normalization (`ApiError`)
- Feature API: domain endpoints only (no duplicated error plumbing)
- Store: signal state + resource loading + computed selectors + async mutations

## Store variants

### Variant A: single state signal (no async resource)

- Use one `signal<State>()` + `computed()` selectors
- Use sync methods for local UI state only
- No `resource()` if no async backend data is needed

### Variant B: split internal signals + `resource()` (async data)

- Internal writable signals for UI/filter/ids
- `resource()` for async loading from Feature API
- Public selectors are `computed()` readonly signals
- Mutations use `async/await` + `firstValueFrom()`

## Canonical store shape (6 ordered sections)

```ts
@Injectable()
export class FeatureStore {
  // 1. dependencies
  readonly #api = inject(FeatureApi);
  readonly #invalidation = inject(FeatureInvalidationService);

  // 2. internal writable state
  readonly #filters = signal(defaultFilters);

  // 3. data loading
  readonly #resource = resource({
    params: () => ({
      filters: this.#filters(),
      version: this.#invalidation.version(),
    }),
    loader: ({ params }) => firstValueFrom(this.#api.getAll$(params.filters)),
  });

  // 4. readonly selectors
  readonly data = computed(() => this.#resource.value() ?? []);
  readonly isLoading = computed(() => this.#resource.isLoading());
  readonly isInitialLoading = computed(
    () => this.#resource.status() === 'loading',
  );

  // 5. mutations
  async createItem(input: CreateInput): Promise<void> {}

  // 6. private utils
  #setError(message: string): void {}
}
```

## Mutations and optimistic update

1. Add local optimistic item with temp id.
2. Await API creation.
3. Replace temp id with server id.
4. Invalidate dependent stores.
5. On failure, rollback with `resource.reload()`.

```ts
const TEMP_ID_PREFIX = 'temp-';

function generateTempId(): string {
  return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}
```

## DR-005 (mandatory): replace temp ID before cascade

Correct order:

```ts
const tempId = generateTempId();
this.#resource.update(addTemp(tempId));

const response = await firstValueFrom(this.#api.create$(input));
this.#resource.update(replaceTemp(tempId, response.data));
this.#invalidation.invalidate();
```

Counter-example (buggy):

```ts
const response = await firstValueFrom(this.#api.create$(input));
this.#invalidation.invalidate(); // too early
await firstValueFrom(this.#api.toggleCheck$(tempId)); // 404 (temp id leaked)
```

## SWR and loading states

- SWR fallback: `computed(() => resource.value() ?? staleData())`
- `isInitialLoading`: `status() === 'loading'` (first load spinner)
- `isLoading`: any load state, but can be masked when stale data exists to avoid flashing

## API layer requirements

- Use `ApiClient` only (no direct `HttpClient` in feature APIs).
- Validate every response with Zod schema.
- For 204 endpoints, use `deleteVoid$()`.
- Feature APIs stay thin:

```ts
getById$(id: string): Observable<Item> {
  return this.#api
    .get$(`/items/${id}`, itemResponseSchema)
    .pipe(map((response) => response.data));
}
```
