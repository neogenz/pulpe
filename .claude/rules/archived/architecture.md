# Architecture

## Application Structure

```
projects/largo-app/src/
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
              └── RuntimeConfigService
```

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
- `RuntimeConfigService` - Environment configuration
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
3. Exposed via `RuntimeConfigService` signals

```typescript
// Usage
const config = inject(RuntimeConfigService);
config.apiUrl();       // string
config.environment();  // 'local' | 'dev' | 'qual' | 'prod'
config.isProduction(); // boolean
```

## Component Guidelines

| Aspect | Rule |
|--------|------|
| Change Detection | Always `OnPush` |
| State | Use signals |
| Templates | Inline for small components |
| Styles | Inline SCSS for small components |
| Prefix | `openit-` |
| Forms | Reactive (not template-driven) |
