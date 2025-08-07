# Core Architecture

The `core/` directory is the central hub for all shared, headless, application-wide logic that is eagerly loaded and available throughout the application.

## Purpose & Content

**Purpose**: Provide injector-based logic that needs to be available from application start or shared across multiple features.

**Content**: 
- **Injector-based logic only** (no components, directives, or pipes - i.e., nothing with a template)
- Services (`@Injectable`)
- Route guards
- HTTP interceptors
- State management setup (e.g., NgRx `provideStore`)
- Infrastructure configuration
- Application initialization logic

**Loading**: Eager-loaded - part of the initial JavaScript bundle.

## What Belongs in Core

### ✅ Include
- Authentication services and guards
- API interceptors and services
- Global state management (shared between features)
- Route guards and resolvers
- Infrastructure services (logging, analytics, error handling)
- Configuration services
- Domain logic shared by multiple lazy features
- Utility functions and services

### ❌ Exclude
- Components, directives, or pipes (use `ui/` or `pattern/`)
- Feature-specific logic that isn't shared (keep in `feature/`)
- Layout components (use `layout/`)
- Any UI/presentational logic

## Domain-Based Organization

**IMPORTANT**: Core content MUST be sub-structured by domain/feature for maintainability and isolation:

```
core/
├── auth/                 # Authentication domain
│   ├── auth.service.ts
│   ├── auth.guard.ts
│   ├── auth.interceptor.ts
│   └── auth.models.ts
├── user/                 # User domain
│   ├── user.service.ts
│   ├── user.state.ts
│   └── user.models.ts
├── orders/               # Orders domain (shared by multiple features)
│   ├── orders.service.ts
│   ├── orders.state.ts
│   └── orders.models.ts
├── api/                  # API infrastructure
│   ├── api.service.ts
│   └── api.interceptor.ts
├── state/                # Global state setup
│   └── app-state.service.ts
└── utils/                # Generic utilities
    ├── logger.service.ts
    └── storage.service.ts
```

### Domain Grouping Principles

- **Always use domain-based grouping** (e.g., `core/auth/`, `core/user/`)
- **Never group by technical type** (avoid `core/services/`, `core/guards/`)
- Each domain folder contains all related logic (services, guards, models, etc.)
- Exception: Generic utilities can go in `core/utils/`

## Service Scoping

All core services should be provided in root:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Global authentication logic available from start
}
```

## Sharing Logic Between Features

When logic needs to be shared between multiple lazy features:
1. Extract it to the appropriate domain folder in `core/`
2. Make it injectable and provide in root
3. Import and use in the features that need it

Example: If both `feature/orders/` and `feature/dashboard/` need order data, extract to `core/orders/`

## Dependencies

Core services can only depend on:
- Other core services
- Angular framework
- Third-party libraries

Core **cannot** import from:
- `feature/`
- `pattern/`
- `layout/`
- `ui/`