# Angular 21 Clean Code Patterns

> Reference patterns for step-02. These are the **correct** modern implementations to apply when fixing anti-patterns.

---

## 1. Component Pattern (Modern Angular 21)

```typescript
@Component({
  selector: 'app-budget-card',
  standalone: true,
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'block',
    '[class.active]': 'isActive()',
    '(click)': 'onClick()',
  },
  template: `
    @if (budget(); as budget) {
      <h3>{{ budget.name }}</h3>
      <p>{{ budget.amount | currency }}</p>
    } @else {
      <p>Aucun budget</p>
    }
  `,
})
export class BudgetCardComponent {
  // Signal inputs (replace @Input)
  readonly budget = input.required<Budget>();
  readonly isActive = input(false);

  // Signal outputs (replace @Output)
  readonly selected = output<Budget>();

  // Derived state (replace effect)
  readonly formattedAmount = computed(() =>
    this.budget().amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
  );

  onClick(): void {
    this.selected.emit(this.budget());
  }
}
```

**Key rules:**
- Always `standalone: true`
- Always `OnPush`
- Use `host: {}` not `@HostBinding`/`@HostListener`
- `input()` / `input.required()` not `@Input()`
- `output()` not `@Output()`
- `computed()` for derived state
- Inline template for small components (< 30 lines)

---

## 2. Signal State Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class BudgetStore {
  // Private mutable state
  readonly #state = signal<BudgetState>({
    budgets: [],
    selectedId: null,
    isLoading: false,
    error: null,
  });

  // Public read-only selectors
  readonly budgets = computed(() => this.#state().budgets);
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly error = computed(() => this.#state().error);

  readonly selected = computed(() =>
    this.#state().budgets.find(b => b.id === this.#state().selectedId)
  );

  // Derived writable state (resets when source changes)
  readonly selectedMonth = linkedSignal(() => new Date().getMonth());

  // Actions — immutable updates
  select(id: string): void {
    this.#state.update(s => ({ ...s, selectedId: id }));
  }

  addBudget(budget: Budget): void {
    this.#state.update(s => ({
      ...s,
      budgets: [...s.budgets, budget],
    }));
  }

  // Async action
  async loadBudgets(): Promise<void> {
    this.#state.update(s => ({ ...s, isLoading: true, error: null }));
    try {
      const budgets = await this.#api.getBudgets();
      this.#state.update(s => ({ ...s, budgets, isLoading: false }));
    } catch (error) {
      this.#state.update(s => ({ ...s, error: error as Error, isLoading: false }));
    }
  }
}
```

**Key rules:**
- One `#state` signal per store
- All public state via `computed()`
- Immutable updates with spread operator
- `linkedSignal()` for dependent writable state
- `effect()` only for side-effects (localStorage, analytics)

---

## 3. Dependency Injection Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class BudgetService {
  readonly #http = inject(HttpClient);
  readonly #config = inject(ConfigService);

  readonly budgets = httpResource(() => ({
    url: `${this.#config.apiUrl()}/budgets`,
    method: 'GET',
  }), {
    parse: budgetListSchema.parse,
  });
}
```

**Key rules:**
- `inject()` not constructor injection
- `#` prefix for private fields (native private)
- `readonly` for injected services
- `httpResource()` for HTTP GET requests
- Zod `parse` for response validation

---

## 4. Control Flow Pattern

```html
<!-- @if replaces *ngIf -->
@if (isLoading()) {
  <app-spinner />
} @else if (error()) {
  <app-error [message]="error()!.message" />
} @else {
  <!-- @for replaces *ngFor — track is REQUIRED -->
  @for (budget of budgets(); track budget.id) {
    <app-budget-card
      [budget]="budget"
      [isActive]="budget.id === selectedId()"
      (selected)="onSelect($event)"
    />
  } @empty {
    <p>Aucun budget trouvé</p>
  }
}

<!-- @switch replaces *ngSwitch -->
@switch (status()) {
  @case ('income') {
    <span class="text-green-600">Revenu</span>
  }
  @case ('expense') {
    <span class="text-red-600">Dépense</span>
  }
  @case ('saving') {
    <span class="text-blue-600">Épargne</span>
  }
}
```

**Key rules:**
- `@if` / `@else if` / `@else` — no `*ngIf`
- `@for` with mandatory `track` — no `*ngFor`
- `@switch` / `@case` — no `*ngSwitch`
- `@empty` block for empty lists
- Call signals with `()` in templates

---

## 5. Architecture Rules (Pulpe)

### Dependency Graph

```
feature/ ──────┬──▶ pattern/
               ├──▶ core/
               ├──▶ ui/
               └──▶ styles/

pattern/ ──────┬──▶ core/
               ├──▶ ui/
               └──▶ styles/

layout/  ──────┬──▶ core/
               ├──▶ pattern/
               ├──▶ ui/
               └──▶ styles/

ui/      ──────▶ (nothing - self-contained)
core/    ──────▶ styles/
styles/  ──────▶ (nothing - foundation layer)
```

### FORBIDDEN Dependencies

| From | To | Why |
|------|----|-----|
| `feature/` | `feature/` | Features are isolated |
| `ui/` | `core/` | UI must not inject services |
| `ui/` | `pattern/` | UI is self-contained |
| `pattern/` | `feature/` | Would create circular dep |
| `pattern/` | `pattern/` | Patterns don't depend on each other |
| `pattern/` | `layout/` | Pattern is lower level |
| `core/` | `feature/` | Core is lower level |
| `core/` | `pattern/` | Core is lower level |
| `layout/` | `feature/` | Layout is shared |

### Feature Module Structure

```
feature/budget/
├── budget.ts                  # Main component (smart)
├── budget.routes.ts           # Lazy-loaded routes
├── budget.store.ts            # Feature state (signal store)
├── budget-list.ts             # List component
├── budget-card.ts             # Card component (dumb)
├── budget-form.ts             # Form component
└── budget.service.ts          # API service (if needed)
```

**Source:** `.claude/rules/00-architecture/angular-architecture.md`, `docs/angular-architecture-doc.md`

---

## 6. TypeScript Patterns

```typescript
// Use #field (native private)
readonly #store = inject(BudgetStore);

// Use unknown + type guard (not any)
function processData(data: unknown): Budget {
  if (!isBudget(data)) {
    throw new Error('Invalid budget data');
  }
  return data;
}

// Use structuredClone (not JSON.parse(JSON.stringify))
const copy = structuredClone(original);

// Use toSorted/toReversed (not sort/reverse)
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));

// Use Object.groupBy (not manual reduce)
const grouped = Object.groupBy(transactions, t => t.type);
```

---

## 7. Styling Patterns

```scss
// Use CSS custom properties (not ::ng-deep)
:host {
  --card-bg: var(--mat-sys-surface-container);
  --card-radius: var(--mat-sys-corner-medium);
}

// Use Material M3 tokens
.card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
}
```

```html
<!-- Tailwind v4 syntax -->
<div class="bg-(--mat-sys-surface) text-(--mat-sys-on-surface)">

<!-- Material button (modern) -->
<button mat-button="filled">Ajouter</button>
```

---

## 8. Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Boolean signal | `is` prefix | `isLoading`, `isActive`, `isOpen` |
| Array signal | Plural | `items`, `budgets`, `transactions` |
| Computed | Descriptive | `formattedAmount`, `filteredBudgets` |
| Effect | Purpose-based | `#persistEffect`, `#analyticsEffect` |
| Store | `FeatureStore` | `BudgetStore`, `DashboardStore` |
| Private field | `#` prefix | `#state`, `#http`, `#config` |

---

## 9. Zod Integration

```typescript
// Define schema in pulpe-shared
import { z } from 'zod';

export const budgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  type: z.enum(['income', 'expense', 'saving']),
});

export type Budget = z.infer<typeof budgetSchema>;
export const budgetListSchema = z.array(budgetSchema);

// Use in service
readonly budgets = httpResource(() => `/api/budgets`, {
  parse: budgetListSchema.parse,
});
```

**Key rules:**
- Schemas in `pulpe-shared`
- Types derived with `z.infer<>`
- `parse` at API boundaries
- Never import types directly from backend

---

## 10. ViewModel Separation

The store's `computed()` selectors form the ViewModel layer. Components just bind.

```
API (DataModel) → Store computed() (ViewModel) → Component → Template
```

| Rule | Rationale |
|------|-----------|
| No `.filter()`/`.map()`/`.reduce()` in templates | Templates should bind, not transform |
| No `computed()` in components reading store data | Move to store — shared, testable, reactive |
| Store returns numbers/enums, not formatted strings | Formatting is a view concern (pipes, Decimal extensions) |
| One `computed()` per concern, not one god object | Fine-grained signal tracking |
| No manual ViewModel construction in `ngOnInit` | Breaks reactivity — use `computed()` |

For detailed patterns and anti-patterns: see `references/viewmodel-patterns.md`.

---

## 11. AI Slop Prevention

Code should read like a senior developer wrote it by hand. Remove:

| Slop | Action |
|------|--------|
| Comments that restate the next line | Delete |
| `try/catch` around non-throwing code | Remove |
| Null checks on DI-injected or typed values | Remove — trust types |
| Single-use helper functions | Inline |
| JSDoc on obvious methods | Delete |
| Abstractions with one consumer | Inline |
| Verbose variable names (>25 chars) | Shorten |

For detailed detection guide: see `references/ai-slop-detection.md`.

---

## 12. Angular Style Guide Conventions

From angular.dev/style-guide — official Angular team recommendations.

### Member Visibility

```typescript
@Component({
  template: `<p>{{ fullName() }}</p>`,
})
export class UserProfileComponent {
  readonly firstName = input<string>();
  readonly lastName = input<string>();

  // Only accessed by template — protected, not public
  protected readonly fullName = computed(() =>
    `${this.firstName()} ${this.lastName()}`
  );

  // Public API — called by parent components
  resetForm(): void { /* ... */ }
}
```

**Rule**: `protected` for template-only members. `public` only for the component's external API.

### Readonly on Angular-Initialized Properties

```typescript
readonly userId = input<string>();
readonly userSaved = output<void>();
readonly userName = model<string>();
readonly nameInput = viewChild<ElementRef>('nameInput');
```

Applies to: `input()`, `input.required()`, `output()`, `model()`, `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`.

### Event Handler Naming

```html
<!-- Name for what they do, not the event -->
<button (click)="saveUserData()">Save</button>
<button (click)="deleteBudget()">Delete</button>

<!-- Not this -->
<button (click)="handleClick()">Save</button>
<button (click)="onClick()">Delete</button>
```

### Component Member Order

```typescript
export class BudgetCardComponent {
  // 1. Injected dependencies
  readonly #store = inject(BudgetStore);

  // 2. Inputs
  readonly budget = input.required<Budget>();

  // 3. Outputs
  readonly selected = output<Budget>();

  // 4. Queries
  readonly nameInput = viewChild<ElementRef>('nameInput');

  // 5. Computed / derived state
  protected readonly displayName = computed(() => this.budget().name);

  // 6. Methods
  selectBudget(): void { /* ... */ }
}
```

### Lifecycle Hooks

- Always `implements OnInit`, `implements OnDestroy` — guarantees correct method name
- Keep hooks thin — delegate to well-named methods
- Empty hooks are dead code — remove them

For full reference: see `references/angular-style-guide.md`.

---

## 13. Error Handling

Errors should be handled at the callsite — the code that started the operation has the context to recover. The global `ErrorHandler` is for fatal/unexpected errors only (logging, analytics).

### Store async methods — always handle errors

```typescript
async loadBudgets(): Promise<void> {
  this.#state.update(s => ({ ...s, isLoading: true, error: null }));
  try {
    const budgets = await firstValueFrom(this.#budgetApi.getBudgets$());
    this.#state.update(s => ({ ...s, budgets, isLoading: false }));
  } catch (error) {
    this.#state.update(s => ({
      ...s,
      isLoading: false,
      error: isApiError(error) ? error.message : 'Erreur inattendue',
    }));
  }
}
```

### Resource error state in templates

```html
@if (store.budgets.status() === 'error') {
  <app-error [message]="store.budgets.error()?.message" />
} @else if (store.budgets.isLoading()) {
  <app-spinner />
} @else {
  @for (budget of store.budgets.value(); track budget.id) {
    <app-budget-card [budget]="budget" />
  }
}
```

### Zod at API boundaries

```typescript
// In httpResource parse option — Angular handles ZodError via resource status
readonly budgets = httpResource(() => `/api/budgets`, {
  parse: budgetListSchema.parse,
});

// In component code — use safeParse for graceful handling
const result = budgetSchema.safeParse(formValue);
if (!result.success) {
  this.#formErrors.set(result.error.flatten().fieldErrors);
  return;
}
```

### Error typing

```typescript
// Use unknown + narrowing, not any
catch (error: unknown) {
  if (isApiError(error)) {
    this.#state.update(s => ({ ...s, error: error.message }));
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

**Key rules:**
- Every `async` store method: `try/catch` with state revert on error
- Every `resource()` / `httpResource()`: check `.error()` or `.status()` in template
- Zod `.parse()` only in `httpResource({ parse })` — use `.safeParse()` elsewhere
- `catch (error: unknown)` — never `catch (e: any)`
- Never swallow errors silently (`catch (e) {}`)

**Source:** angular.dev/best-practices/error-handling
