---
description: "Angular signal-based store patterns for state management"
paths:
  - "frontend/**/*.store.ts"
  - "frontend/**/*.service.ts"
  - "frontend/**/*state*.ts"
---

# Store Pattern with Angular Signals

> **Signal API Reference**: See @.claude/rules/03-frameworks-and-libraries/angular-signals.md for `signal()`, `computed()`, `linkedSignal()`, `resource()` API details.

## Store Structure

```typescript
interface State {
  data: T[];
  selectedId: string | null;
  isLoading: boolean;
  error: Error | null;
}

@Injectable()
export class Store {
  readonly #state = signal<State>(initialState);

  readonly data = computed(() => this.#state().data);
  readonly isLoading = computed(() => this.#state().isLoading);

  readonly selected = computed(() =>
    this.#state().data.find((item) => item.id === this.#state().selectedId)
  );

  updateData(data: T[]) {
    this.#state.update((state) => ({ ...state, data }));
  }
}
```

## Core Rules

### Immutable State

```typescript
// Good - New reference
this.#state.update((state) => ({
  ...state,
  items: [...state.items, newItem],
}));

// Bad - Mutation
this.#state.update((state) => {
  state.items.push(newItem); // Mutation!
  return state;
});
```

### Async Actions

```typescript
async loadData() {
  this.#state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const data = await this.#api.getData();
    this.#state.update(s => ({ ...s, data, isLoading: false }));
  } catch (error) {
    this.#state.update(s => ({ ...s, error, isLoading: false }));
  }
}
```

## Store Patterns

### Effects for Side-Effects

```typescript
@Injectable()
export class CartStore {
  readonly #state = signal<CartState>(initialState);
  readonly #analytics = inject(AnalyticsService);

  readonly #persistEffect = effect(() => {
    const state = this.#state();
    localStorage.setItem("cart", JSON.stringify(state));
  });

  readonly #analyticsEffect = effect(() => {
    const items = this.#state().items;
    untracked(() => {
      if (items.length > 0) {
        this.#analytics.trackCart(items);
      }
    });
  });
}
```

### Store Composition

```typescript
@Injectable()
export class OrderStore {
  readonly #cart = inject(CartStore);
  readonly #user = inject(UserStore);

  readonly canCheckout = computed(() =>
    this.#cart.items().length > 0 && this.#user.isAuthenticated()
  );

  readonly orderSummary = computed(() => ({
    items: this.#cart.items(),
    user: this.#user.current(),
    total: this.#cart.total(),
  }));
}
```

### Optimized Selection (O(1) Lookup)

```typescript
export class ProductStore {
  readonly #state = signal<State>(initialState);

  readonly #productById = computed(() => {
    const map = new Map<string, Product>();
    this.#state().products.forEach((p) => map.set(p.id, p));
    return map;
  });

  getProduct(id: string) {
    return computed(() => this.#productById().get(id));
  }
}
```

### Generic Entity Store

```typescript
export class EntityStore<T extends { id: string }> {
  protected readonly state = signal<EntityState<T>>({
    entities: new Map(),
    ids: [],
    selectedId: null,
  });

  readonly entities = computed(() =>
    this.state().ids.map((id) => this.state().entities.get(id)!)
  );

  upsert(entity: T) {
    this.state.update((state) => {
      const entities = new Map(state.entities);
      const exists = entities.has(entity.id);
      entities.set(entity.id, entity);

      return {
        ...state,
        entities,
        ids: exists ? state.ids : [...state.ids, entity.id],
      };
    });
  }
}
```

## Scoping & Lifecycle

```typescript
// Component-level store (destroyed with component)
@Component({
  providers: [FeatureStore]
})

// Singleton store (survives navigations)
@Injectable({ providedIn: 'root' })
```

## Testing

```typescript
describe("ProductStore", () => {
  let store: ProductStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductStore],
    });
    store = TestBed.inject(ProductStore);
  });

  it("should filter products", () => {
    // Arrange
    store.setProducts([...mockProducts]);
    store.setSearchTerm("laptop");

    // Act
    const filtered = store.filtered();

    // Assert
    expect(filtered).toHaveLength(2);
  });
});
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Public mutable signal | Private signal + public computed |
| Direct mutation in update | Spread operator for immutability |
| Nested signals | Flat state structure |
| Computed with side-effects | Pure computed, effects for side-effects |

## Key Points

1. **One state signal per store**
2. **Computed for all derivations**
3. **Strict immutability**
4. **Pure, predictable actions**
5. **Effects for side-effects**
6. **Untracked() to avoid unwanted dependencies**
