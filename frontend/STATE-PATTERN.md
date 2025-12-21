# Technical Guide: Reactive Store with Angular Signals

## Basic Structure

```typescript
// store.ts
interface State {
  data: T[];
  selectedId: string | null;
  isLoading: boolean;
  error: Error | null;
}

@Injectable()
export class Store {
  // 1. Private state, single signal
  private readonly state = signal<State>(initialState);

  // 2. Public read-only selectors via computed
  readonly data = computed(() => this.state().data);
  readonly isLoading = computed(() => this.state().isLoading);

  // 3. Derived selectors
  readonly selected = computed(() => this.state().data.find((item) => item.id === this.state().selectedId));

  // 4. Actions that modify state
  updateData(data: T[]) {
    this.state.update((state) => ({ ...state, data }));
  }
}
```

## Fundamental Rules

### 1. Immutable State

```typescript
// Good - New reference
this.state.update((state) => ({
  ...state,
  items: [...state.items, newItem],
}));

// Bad - Mutation
this.state.update((state) => {
  state.items.push(newItem); // Mutation!
  return state;
});
```

### 2. Computed for All Derivations

```typescript
// Good
readonly totalPrice = computed(() =>
  this.items().reduce((sum, item) => sum + item.price, 0)
);

// Bad - Recalculates on each call
get totalPrice() {
  return this.items().reduce((sum, item) => sum + item.price, 0);
}
```

### 3. Async Actions

```typescript
// Good - Complete state management
async loadData() {
  this.state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const data = await this.api.getData();
    this.state.update(s => ({ ...s, data, isLoading: false }));
  } catch (error) {
    this.state.update(s => ({ ...s, error, isLoading: false }));
  }
}

// Alternative with Resource API
readonly data = resource({
  request: () => ({ id: this.selectedId() }),
  loader: async ({ request }) => this.api.getData(request.id)
});
```

## Recommended Patterns

### Pattern 1: Store with Effects

```typescript
@Injectable()
export class CartStore {
  private readonly state = signal<CartState>(initialState);

  // Effect for local persistence
  private readonly persistEffect = effect(() => {
    const state = this.state();
    localStorage.setItem("cart", JSON.stringify(state));
  });

  // Effect for analytics
  private readonly analyticsEffect = effect(() => {
    const items = this.state().items;
    untracked(() => {
      if (items.length > 0) {
        this.analytics.trackCart(items);
      }
    });
  });
}
```

### Pattern 2: Store Composition

```typescript
@Injectable()
export class OrderStore {
  private readonly cart = inject(CartStore);
  private readonly user = inject(UserStore);

  // Cross-store computed
  readonly canCheckout = computed(() => this.cart.items().length > 0 && this.user.isAuthenticated());

  readonly orderSummary = computed(() => ({
    items: this.cart.items(),
    user: this.user.current(),
    total: this.cart.total(),
  }));
}
```

### Pattern 3: Optimized Selection

```typescript
export class ProductStore {
  private readonly state = signal<State>(initialState);

  // Memoization by ID
  private readonly productById = computed(() => {
    const map = new Map<string, Product>();
    this.state().products.forEach((p) => map.set(p.id, p));
    return map;
  });

  // O(1) Selection
  getProduct(id: string) {
    return computed(() => this.productById().get(id));
  }
}
```

## Anti-Patterns to Avoid

```typescript
// Nested signals
private readonly user = signal(signal(userData));

// Computed with side-effects
readonly total = computed(() => {
  console.log('calculating...'); // Side-effect!
  return this.items().reduce(...);
});

// Direct modification in computed
readonly sorted = computed(() => {
  const items = this.items();
  return items.sort(); // Mutation!
});

// Public mutable signal
readonly state = signal(initialState); // Should be private

// Update without spread
this.state.update(state => {
  state.isLoading = true; // Direct mutation
  return state;
});
```

## Advanced Patterns

### LinkedSignal for Mutable Derived State

```typescript
export class FilterStore {
  readonly category = signal<string>("all");

  // Auto-reset when category changes
  readonly subcategory = linkedSignal({
    source: this.category,
    computation: () => "all",
  });
}
```

### Resource with Retry

```typescript
readonly data = resource({
  request: () => ({ query: this.query() }),
  loader: async ({ request, abortSignal }) => {
    let retries = 3;
    while (retries > 0) {
      try {
        return await fetch(url, { signal: abortSignal });
      } catch (error) {
        if (--retries === 0) throw error;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
});
```

### Typed Generic Store

```typescript
export class EntityStore<T extends { id: string }> {
  protected readonly state = signal<EntityState<T>>({
    entities: new Map(),
    ids: [],
    selectedId: null,
  });

  readonly entities = computed(() => this.state().ids.map((id) => this.state().entities.get(id)!));

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
    expect(filtered.every((p) => p.name.includes("laptop"))).toBe(true);
  });
});
```

## Scoping & Lifecycle

```typescript
// Component-level store (destroyed with component)
@Component({
  providers: [FeatureStore]
})

// Singleton store (survives navigations)
@Injectable({ providedIn: 'root' })

// Store per lazy-loaded route
@Injectable({ providedIn: FeatureModule })
```

## Key Points

1. **One state signal per store**
2. **Computed for all derivations**
3. **Strict immutability**
4. **Pure, predictable actions**
5. **Effects for side-effects**
6. **Resource API for complex async**
7. **LinkedSignal for mutable derived state**
8. **Untracked() to avoid unwanted dependencies**
