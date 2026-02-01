# Angular Enterprise Architecture Reference

> Loaded when architecture issues are detected or `--arch` flag is used. Based on `docs/angular-architecture-doc.md` and Pulpe project conventions.

---

## Why Architecture Matters

Clean architecture with a one-way dependency graph directly impacts:
- **Bundle size**: The bundler (esbuild) uses import graph to create lazy bundles. Tangled imports = larger eager bundle = slower startup.
- **Feature isolation**: Each feature should be independently lazy-loaded. Cross-feature imports prevent this.
- **Developer velocity**: Clean deps = easier to extend and modify without breaking unrelated features.
- **Testability**: Isolated features are independently testable.

> A clean dependency graph has no cycles, one-way flow, and clearly distinguishable clusters.

---

## Pulpe Application Structure

```
src/app/
├── core/                    # Singleton services, guards, interceptors
│   ├── core.ts              # Core providers export
│   ├── config/              # Runtime configuration
│   ├── auth/                # Auth guard, interceptor
│   └── logging/             # Logger service
├── feature/                 # Feature modules (lazy-loaded)
│   ├── budget/              # Budget feature
│   ├── dashboard/           # Dashboard feature
│   └── settings/            # Settings feature
├── pattern/                 # Shared smart patterns (with services)
│   ├── transaction-list/    # Reusable transaction list with state
│   └── category-picker/     # Category picker with API
├── ui/                      # Dumb UI components (NO services)
│   ├── card/
│   ├── chip/
│   └── amount-display/
├── layout/                  # Layout components
│   └── main-layout.ts
├── styles/                  # Foundation tokens, themes
├── app.ts                   # Root component
├── app.config.ts            # Application providers
└── app.routes.ts            # Root routing (lazy loads features)
```

---

## Layer Definitions

### core/
- **Purpose**: Application-wide singletons (services, guards, interceptors)
- **Can import**: `styles/`
- **Cannot import**: `feature/`, `pattern/`, `layout/`, `ui/`
- **Provided**: At root level (`providedIn: 'root'`)
- **Examples**: `ConfigService`, `AuthGuard`, `ErrorInterceptor`, `LoggerService`

### feature/
- **Purpose**: Self-contained user-facing features, lazy-loaded
- **Can import**: `pattern/`, `core/`, `ui/`, `styles/`
- **Cannot import**: Other `feature/` modules (NEVER)
- **Each feature has**: Component, routes, store (optional), service (optional)
- **Lazy loading**: Via `loadChildren()` in `app.routes.ts`

### pattern/
- **Purpose**: Reusable smart components that need services
- **Can import**: `core/`, `ui/`, `styles/`
- **Cannot import**: `feature/`, `layout/`, other `pattern/`
- **Examples**: Transaction list with filtering, category picker with API

### ui/
- **Purpose**: Pure presentational components (dumb)
- **Can import**: Nothing (self-contained)
- **Cannot import**: `core/`, `feature/`, `pattern/`, `layout/`
- **No `inject()`**: Only `input()` and `output()`
- **Examples**: Card, chip, button, amount display

### layout/
- **Purpose**: App shell and layout components
- **Can import**: `core/`, `pattern/`, `ui/`, `styles/`
- **Cannot import**: `feature/`
- **Examples**: Main layout, sidebar, header

### styles/
- **Purpose**: Foundation layer — tokens, themes, mixins
- **Can import**: Nothing (foundation)
- **Examples**: CSS custom properties, Tailwind config, M3 tokens

---

## Dependency Validation

When checking imports, verify the from→to relationship is allowed:

```typescript
// In a feature file, check each import:
import { X } from '../../feature/other-feature/...'  // 🔴 FORBIDDEN
import { Y } from '../../core/...'                    // ✅ Allowed
import { Z } from '../../pattern/...'                 // ✅ Allowed
import { W } from '../../ui/...'                      // ✅ Allowed

// In a ui file, check each import:
import { X } from '../../core/...'                    // 🔴 FORBIDDEN
import { Y } from '../../pattern/...'                 // 🔴 FORBIDDEN
```

### Detection Algorithm

For each file in scope:
1. Determine which layer the file belongs to (by path: `core/`, `feature/`, `pattern/`, `ui/`, `layout/`, `styles/`)
2. Read all import statements
3. For each import, determine the target layer
4. Check if the from→to relationship is in the FORBIDDEN list
5. Report violations with file:line and the import path

---

## Lazy Loading Pattern

```typescript
// app.routes.ts — each feature is lazy-loaded
export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: 'budget',
        loadChildren: () => import('./feature/budget/budget.routes'),
      },
      {
        path: 'dashboard',
        loadChildren: () => import('./feature/dashboard/dashboard.routes'),
      },
    ],
  },
];

// feature/budget/budget.routes.ts
export default [
  {
    path: '',
    component: BudgetComponent,
  },
] satisfies Routes;
```

---

## Common Architecture Fixes

### Fix: Cross-feature import

```typescript
// 🔴 BEFORE: feature/budget imports from feature/dashboard
// In feature/budget/budget-overview.ts:
import { DashboardChart } from '../../feature/dashboard/dashboard-chart';

// ✅ AFTER: Extract shared component to pattern/ or ui/
// Move DashboardChart → pattern/chart/ or ui/chart/
import { Chart } from '../../pattern/chart/chart';
```

### Fix: UI component with service

```typescript
// 🔴 BEFORE: ui/amount-display injects a service
@Component({ ... })
export class AmountDisplayComponent {
  readonly #currencyService = inject(CurrencyService);
  readonly amount = input.required<number>();
  readonly formatted = computed(() => this.#currencyService.format(this.amount()));
}

// ✅ AFTER: Pass formatted value via input
@Component({ ... })
export class AmountDisplayComponent {
  readonly amount = input.required<number>();
  readonly currency = input('EUR');
  // Use pure pipe or compute in parent
}
```

### Fix: Pattern imports feature

```typescript
// 🔴 BEFORE: pattern/transaction-list imports feature-specific type
import { BudgetTransaction } from '../../feature/budget/types';

// ✅ AFTER: Use generic type from core or shared
import { Transaction } from '../../core/types';
// Or from pulpe-shared
import type { Transaction } from 'pulpe-shared';
```

---

## Key Principles from Enterprise Architecture

1. **One-way dependency flow**: Dependencies always flow from higher layers (feature) to lower layers (core, ui)
2. **No cycles**: A file should never be able to reach itself by following imports
3. **Feature isolation**: Features know nothing about each other — they communicate via core services or router
4. **UI purity**: UI components have zero business logic, zero service injection
5. **Lazy boundary respect**: Don't eagerly import from lazy-loaded features
6. **Shared code lives in the right layer**: If two features need the same thing, it goes in `pattern/` (with services) or `ui/` (pure presentation)

**Source**: `docs/angular-architecture-doc.md`, `.claude/rules/00-architecture/angular-architecture.md`
