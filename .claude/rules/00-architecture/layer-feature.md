---
description: "Feature layer - Business features (lazy-loaded, isolated black boxes)"
paths: "frontend/**/feature/**/*"
---

# Feature Layer

**Scope**: Business features (lazy-loaded, isolated)

**Bundling**: LAZY - separate bundle per feature, loaded on demand

## Quick Rules

- Features are **completely isolated** from each other
- Feature **CANNOT import another feature** (EVER)
- MUST be lazy-loaded via `loadChildren()` (NOT `loadComponent()`)
- Each feature has its own route file (`.routes.ts`)
- Shared code goes in `pattern/`, `ui/`, or `core/`

## Dependency Rules

```
feature/ ──✅──> pattern/ (use reusable business components)
feature/ ──✅──> ui/      (use generic UI components)
feature/ ──✅──> core/    (inject services)
feature/ ──✅──> styles/
feature/ ──❌──> feature/ (FORBIDDEN - complete isolation)
feature/ ──❌──> layout/  (layout is eager, features are lazy)
```

## Key Concepts

### Black Box

Each feature is a **black box** - its internal implementation is encapsulated:
- Can contain any kind of implementation
- If quality is not perfect, isolation prevents spread
- Can be refactored/replaced without affecting other features

### Throw-Away Nature

Because of isolation, features can be:
- **Replaced** entirely with a new implementation
- **Removed** without breaking other features
- **Extracted** to a library easily

### Optimizing for Delivery Speed

Isolation allows pragmatism:
- Focus on delivering value fast
- Don't aim for perfection on first pass
- Refactor later without fear of breaking other features

## Feature Structure

```
feature/my-feature/
├── my-feature.ts           # Main component
├── my-feature.routes.ts    # Routes (export default as Routes)
├── components/             # Feature-local components (optional)
├── services/               # Feature-local services (optional)
└── pages/                  # Sub-pages (optional)
```

## Adding a Feature

### 1. Create the feature folder

```
feature/dashboard/
├── dashboard.ts
└── dashboard.routes.ts
```

### 2. Create routes file

```typescript
// dashboard.routes.ts
import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard';

export default [
  { path: '', component: DashboardComponent }
] satisfies Routes;
```

### 3. Register in app.routes.ts

```typescript
{
  path: 'dashboard',
  loadChildren: () => import('./feature/dashboard/dashboard.routes'),
  data: { label: 'Dashboard' }
}
```

## Sharing Logic Between Features

When logic needs to be shared:

| Shared Logic Type | Extract To |
|-------------------|------------|
| UI widgets (no services) | `ui/` |
| Business components (with services) | `pattern/` |
| Services, state | `core/` |

**"Extract one level up" rule**: When 2+ features need the same thing, extract it up.

## Nested Sub-Features

Large features can have lazy sub-features:

```typescript
// feature/product/product.routes.ts
export default [
  {
    path: '',
    component: ProductComponent,
    children: [
      { path: 'list', loadChildren: () => import('./list/list.routes') },
      { path: 'detail/:id', loadChildren: () => import('./detail/detail.routes') }
    ]
  }
] satisfies Routes;
```

## More Information

Features follow the black-box architectural pattern to maximize isolation, enable rapid iteration, and support independent deployment and scaling.
