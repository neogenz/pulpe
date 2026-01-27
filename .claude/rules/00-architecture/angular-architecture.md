---
description: "Angular application structure and architecture patterns"
paths: "frontend/src/**/*"
---

# Architecture

## Application Structure

```
src/
├── main.ts                 # Bootstrap with APP_INITIALIZER for config
├── app/
│   ├── app.ts              # Root component
│   ├── app.config.ts       # Application providers
│   ├── app.routes.ts       # Root routing
│   ├── core/               # Singleton services, guards, interceptors
│   │   ├── core.ts         # Core providers export
│   │   └── config/         # Runtime configuration
│   ├── feature/            # Feature modules (lazy-loaded)
│   │   └── home/           # Example feature
│   │       ├── home.ts
│   │       └── home.routes.ts
│   └── layout/             # Layout components
│       └── main-layout.ts
└── environments/           # Build-time environment flags
```

## Dependency Flow

```
main.ts
  └── app.config.ts (providers)
        ├── provideRouter(routes)
        └── core providers
              └── ConfigService (config service pattern)
```

## Architecture Dependency Graph

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

**FORBIDDEN Dependencies**:
- `feature/` → `feature/` (NEVER - features are isolated)
- `ui/` → `core/` (NEVER - UI must not inject services)
- `ui/` → `pattern/` (NEVER - UI is self-contained)
- `pattern/` → `feature/` (NEVER - would create circular dependency)
- `pattern/` → `pattern/` (NEVER - patterns don't depend on each other)
- `pattern/` → `layout/` (NEVER - pattern is lower level)
- `core/` → `feature/` (NEVER - core is lower level)
- `core/` → `pattern/` (NEVER - core is lower level)
- `layout/` → `feature/` (NEVER - layout is shared)

## Feature Module Pattern

Each feature is a self-contained folder with:
- `feature.ts` - Main component
- `feature.routes.ts` - Feature routes (lazy-loaded from app.routes)

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./feature/home/home.routes')
  }
];
```

## Core Module

Core contains application-wide singletons:
- Config service - Environment configuration management
- Guards, interceptors, and other infrastructure

```typescript
// core.ts exports providers
export const provideCore = () => [
  // core providers here
];
```

## Runtime Configuration

1. `config.json` fetched at app startup via `APP_INITIALIZER`
2. Validated with Zod schema
3. Exposed via a config service with signals

```typescript
// Usage
const config = inject(ConfigService);
config.apiUrl();       // string
config.environment();  // 'local' | 'dev' | 'staging' | 'prod'
config.isProduction(); // boolean
```

## Component Guidelines

| Aspect | Rule |
|--------|------|
| Change Detection | Always `OnPush` |
| State | Use signals |
| Templates | Inline for small components |
| Styles | Inline SCSS for small components |
| Prefix | `app-` |
| Forms | Reactive (not template-driven) |
