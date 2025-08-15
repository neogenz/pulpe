# Guide Technique : Store Réactif Angular avec Signals

## 📐 Structure de Base

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
  // 1. État privé, signal unique
  private readonly state = signal<State>(initialState);

  // 2. Selectors publics read-only via computed
  readonly data = computed(() => this.state().data);
  readonly isLoading = computed(() => this.state().isLoading);

  // 3. Selectors dérivés
  readonly selected = computed(() => this.state().data.find((item) => item.id === this.state().selectedId));

  // 4. Actions qui modifient l'état
  updateData(data: T[]) {
    this.state.update((state) => ({ ...state, data }));
  }
}
```

## ✅ Règles Fondamentales

### 1. État Immutable

```typescript
// ✅ BON - Nouvelle référence
this.state.update((state) => ({
  ...state,
  items: [...state.items, newItem],
}));

// ❌ MAUVAIS - Mutation
this.state.update((state) => {
  state.items.push(newItem); // Mutation!
  return state;
});
```

### 2. Computed pour Toute Dérivation

```typescript
// ✅ BON
readonly totalPrice = computed(() =>
  this.items().reduce((sum, item) => sum + item.price, 0)
);

// ❌ MAUVAIS - Recalcul à chaque appel
get totalPrice() {
  return this.items().reduce((sum, item) => sum + item.price, 0);
}
```

### 3. Actions Asynchrones

```typescript
// ✅ BON - Gestion d'état complète
async loadData() {
  this.state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const data = await this.api.getData();
    this.state.update(s => ({ ...s, data, isLoading: false }));
  } catch (error) {
    this.state.update(s => ({ ...s, error, isLoading: false }));
  }
}

// Alternative avec Resource API
readonly data = resource({
  request: () => ({ id: this.selectedId() }),
  loader: async ({ request }) => this.api.getData(request.id)
});
```

## 🎯 Patterns Recommandés

### Pattern 1: Store avec Effects

```typescript
@Injectable()
export class CartStore {
  private readonly state = signal<CartState>(initialState);

  // Effect pour persistence locale
  private readonly persistEffect = effect(() => {
    const state = this.state();
    localStorage.setItem("cart", JSON.stringify(state));
  });

  // Effect pour analytics
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

### Pattern 2: Composition de Stores

```typescript
@Injectable()
export class OrderStore {
  private readonly cart = inject(CartStore);
  private readonly user = inject(UserStore);

  // Computed cross-store
  readonly canCheckout = computed(() => this.cart.items().length > 0 && this.user.isAuthenticated());

  readonly orderSummary = computed(() => ({
    items: this.cart.items(),
    user: this.user.current(),
    total: this.cart.total(),
  }));
}
```

### Pattern 3: Sélection Optimisée

```typescript
export class ProductStore {
  private readonly state = signal<State>(initialState);

  // Mémorisation par ID
  private readonly productById = computed(() => {
    const map = new Map<string, Product>();
    this.state().products.forEach((p) => map.set(p.id, p));
    return map;
  });

  // Sélection O(1)
  getProduct(id: string) {
    return computed(() => this.productById().get(id));
  }
}
```

## 🚫 Anti-Patterns à Éviter

```typescript
// ❌ Signals imbriqués
private readonly user = signal(signal(userData));

// ❌ Computed avec side-effects
readonly total = computed(() => {
  console.log('calculating...'); // Side-effect!
  return this.items().reduce(...);
});

// ❌ Modification directe dans computed
readonly sorted = computed(() => {
  const items = this.items();
  return items.sort(); // Mutation!
});

// ❌ Signal public modifiable
readonly state = signal(initialState); // Devrait être private

// ❌ Update sans spread
this.state.update(state => {
  state.isLoading = true; // Mutation directe
  return state;
});
```

## 🔧 Patterns Avancés

### LinkedSignal pour État Dérivé Modifiable

```typescript
export class FilterStore {
  readonly category = signal<string>("all");

  // Reset automatique quand la catégorie change
  readonly subcategory = linkedSignal({
    source: this.category,
    computation: () => "all",
  });
}
```

### Resource avec Retry

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

### Store Générique Typé

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

## 📊 Testing

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

## 🎬 Scoping & Lifecycle

```typescript
// Store au niveau component (détruit avec le component)
@Component({
  providers: [FeatureStore]
})

// Store singleton (survit aux navigations)
@Injectable({ providedIn: 'root' })

// Store par route lazy-loadée
@Injectable({ providedIn: FeatureModule })
```

## 🔑 Points Clés

1. **Un signal d'état par store**
2. **Computed pour toute dérivation**
3. **Immutabilité stricte**
4. **Actions pures et prévisibles**
5. **Effects pour les side-effects**
6. **Resource API pour l'async complexe**
7. **LinkedSignal pour l'état dérivé modifiable**
8. **Untracked() pour éviter les dépendances non voulues**
