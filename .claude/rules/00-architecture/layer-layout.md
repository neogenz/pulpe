---
description: "Layout layer - App shell, navigation, structural components"
paths: "frontend/**/layout/**/*"
---

# Layout Layer

**Scope**: App shell, navigation, structural components

**Bundling**: EAGER - part of initial bundle, displayed before lazy features load

## Quick Rules

- **Standalones ONLY** - components, directives, pipes (NO services here)
- Contains main layout components (MainLayout, Navbar, etc.)
- Can import from `core/` for services (auth state, user info)
- Can import from `ui/` for generic UI widgets
- Can import from `pattern/` for reusable business components
- NEVER import from `feature/`

## Dependency Rules

```
layout/ ──✅──> core/    (inject services for auth, user state)
layout/ ──✅──> ui/      (use generic UI components)
layout/ ──✅──> pattern/ (use reusable business components)
layout/ ──✅──> styles/
layout/ ──❌──> feature/ (NEVER - layout is shared across features)
```

## Typical Components

- `MainLayout` - App container with `<router-outlet />`
- `Navbar` - Navigation menu
- `Sidebar` - Side navigation
- `Footer` - App footer
- `Header` - App header with user info

## Layout Patterns

### Single Layout (whole app)

```typescript
// app.ts
@Component({
  selector: 'app-root',
  template: `<app-main-layout />`
})
export class App {}
```

### Multiple Layouts (auth vs main)

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: '',
    component: AuthLayout,
    children: [
      { path: 'login', loadChildren: () => import('./feature/login/login.routes') }
    ]
  },
  {
    path: 'app',
    component: MainLayout,
    children: [
      { path: 'home', loadChildren: () => import('./feature/home/home.routes') }
    ]
  }
];
```

## Detailed Documentation

**For complete rules**: See your project's layout layer documentation
