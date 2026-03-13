# ViewModel Patterns in Angular

> Reference for separating data models from view models in the Pulpe architecture.
> The key insight: stores transform data for views via `computed()` selectors. Components just bind.

---

## Why This Matters

A **DataModel** is what the API returns — parsed by Zod from `pulpe-shared` schemas.
A **ViewModel** is what the template needs — often a transformation of one or more DataModels.

Without separation:
- Templates contain complex expressions that are hard to test and debug
- Components become transformation engines instead of UI coordinators
- The same transformation gets duplicated across multiple components
- API response changes break templates instead of just one store selector

---

## Where Transformations Belong

```
API Response (DataModel)
    │
    ▼
Store — computed() selectors  ← THE VIEWMODEL LAYER
    │
    ▼
Component — reads signals, coordinates UI events
    │
    ▼
Template — simple bindings, pipes for formatting
```

The store's `computed()` selectors ARE the ViewModel. They transform raw API data into exactly what templates need.

---

## Correct Pattern

```typescript
// Store: DataModel → ViewModel via computed()
@Injectable()
export class BudgetDetailsStore {
  readonly #api = inject(BudgetApi);

  // ── Raw data (DataModel) ──
  readonly #resource = resource({ /* ... */ });

  // ── ViewModel selectors ──
  readonly budgetName = computed(() => this.#resource.value()?.name ?? '');

  readonly totalExpenses = computed(() => {
    const lines = this.#resource.value()?.budget_lines ?? [];
    return lines
      .filter(l => l.type === 'expense')
      .reduce((sum, l) => sum + l.amount, 0);
  });

  readonly expenseLines = computed(() => {
    const lines = this.#resource.value()?.budget_lines ?? [];
    return lines
      .filter(l => l.type === 'expense')
      .toSorted((a, b) => a.label.localeCompare(b.label));
  });

  readonly progress = computed(() => {
    const total = this.totalExpenses();
    const target = this.#resource.value()?.target_amount ?? 0;
    return target > 0 ? Math.min(total / target, 1) : 0;
  });

  readonly hasExpenses = computed(() => this.expenseLines().length > 0);
}
```

```typescript
// Component: reads view-ready signals, zero transformation
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ store.budgetName() }}</h1>
    <progress-bar [value]="store.progress()" />
    @if (store.hasExpenses()) {
      @for (line of store.expenseLines(); track line.id) {
        <budget-line-card [line]="line" />
      }
    } @else {
      <p>Aucune dépense</p>
    }
  `,
})
export class BudgetDetailsComponent {
  protected readonly store = inject(BudgetDetailsStore);
}
```

---

## Anti-Patterns

### 1. Raw API Data in Template

```typescript
// BAD — template is the transformation layer
@Component({
  template: `
    {{ resource.value()?.budget_lines?.filter(l => l.type === 'expense')
       ?.reduce((s, l) => s + l.amount, 0) | currency:'CHF' }}
  `,
})
```

The template has business logic (filtering by type, aggregating). Any change to the data structure requires a template change.

**Fix:** Create a `computed()` selector in the store: `totalExpenses`. Template becomes `{{ store.totalExpenses() | currency:'CHF' }}`.

### 2. Transformation in Component

```typescript
// BAD — component doing store work
export class BudgetComponent {
  readonly #store = inject(BudgetStore);

  readonly expenses = computed(() =>
    this.#store.data()?.lines.filter(l => l.type === 'expense') ?? []
  );

  readonly sortedExpenses = computed(() =>
    this.expenses().toSorted((a, b) => a.amount - b.amount)
  );
}
```

If another component needs the same filtered/sorted list, it will duplicate this logic.

**Fix:** Move both `computed()` signals to the store. Component reads `store.expenses()` and `store.sortedExpenses()`.

### 3. Store Returns Formatted Strings

```typescript
// BAD — store doing view work
readonly formattedTotal = computed(() =>
  this.totalExpenses().toLocaleString('fr-CH', {
    style: 'currency',
    currency: 'CHF',
  })
);
```

Formatting is a view concern. The store should return the raw number — the template applies `CurrencyPipe` or the project's Decimal extensions (`asCHF`, `asCompactCHF`).

**Fix:** Store exposes `totalExpenses` as a number. Template: `{{ store.totalExpenses() | currency:'CHF' }}` or use `asAmount` extension.

### 4. Duplicate Derivations

```typescript
// BAD — same transformation in two components
// In BudgetOverviewComponent:
readonly expenses = computed(() =>
  this.store.data()?.lines.filter(l => l.type === 'expense')
);

// In BudgetSummaryComponent:
readonly expenseTotal = computed(() =>
  this.store.data()?.lines.filter(l => l.type === 'expense')
    .reduce((s, l) => s + l.amount, 0)
);
```

Both components filter by type independently. The filter logic exists in two places.

**Fix:** Store has `expenseLines` and `totalExpenses` as shared selectors. Both components just read them.

### 5. God ViewModel Object

```typescript
// BAD — one massive computed defeats fine-grained reactivity
readonly vm = computed(() => ({
  name: this.#resource.value()?.name,
  expenses: this.#resource.value()?.lines.filter(/* ... */),
  income: this.#resource.value()?.lines.filter(/* ... */),
  total: /* ... */,
  progress: /* ... */,
  formattedDate: /* ... */,
  // 15 more properties...
}));
```

Angular's signal tracking is granular. One big object means any change to any property re-evaluates everything and triggers all template bindings.

**Fix:** Separate `computed()` for each concern. Each one tracks only what it depends on.

### 6. Component as ViewModel Factory

```typescript
// BAD — component creates a ViewModel in ngOnInit or constructor
export class BudgetComponent implements OnInit {
  vm!: BudgetViewModel;

  ngOnInit() {
    const data = this.store.data();
    this.vm = {
      title: data.name,
      expenses: data.lines.filter(/* ... */),
      total: data.lines.reduce(/* ... */),
    };
  }
}
```

This loses reactivity entirely. If `store.data()` changes, `vm` is stale.

**Fix:** Use `computed()` signals in the store. No manual ViewModel construction needed.

---

## Decision Guide

| Situation | Where | Why |
|-----------|-------|-----|
| Filter/sort/group data | Store `computed()` | Reusable, testable, reactive |
| Combine multiple data sources | Store `computed()` | Single source of derived truth |
| Format numbers/dates for display | Template pipe / Decimal extension | View concern, locale-dependent |
| Boolean flags for `@if` | Store `computed()` | `hasExpenses`, `isEmpty`, `isOverBudget` |
| Map API enum to display label | Pipe or `computed()` | Depends on reuse and complexity |
| Paginate/slice a list | Store `computed()` with pagination signals | State + derivation |
| Aggregate (sum, avg, count) | Store `computed()` | Business logic, testable |
| Conditional CSS class | Template `[class.x]="signal()"` | Simple binding |

---

## Review Checklist

1. **Template expressions** — No `.filter()`, `.map()`, `.reduce()`, `.find()` in templates. Max ~40 characters.
2. **Component computed** — If a component has `computed()` reading store data, it probably belongs in the store
3. **Store selectors** — Each distinct view need has its own `computed()`, not one god object
4. **No formatting in store** — Store returns numbers/dates/enums, templates format via pipes
5. **No duplication** — If 2+ components derive the same thing, it's a store selector
6. **Granularity** — One `computed()` per concern for fine-grained reactivity
7. **Reactivity preserved** — No manual ViewModel construction in `ngOnInit` or constructor
