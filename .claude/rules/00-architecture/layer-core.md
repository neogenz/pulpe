---
description: "Core layer - Singleton services, application-wide infrastructure"
paths: "frontend/**/core/**/*"
---

# Core Layer

**Scope**: Singleton services, application-wide infrastructure

**Bundling**: EAGER - part of initial bundle, available from start

## Quick Rules

- **Headless ONLY** - services, guards, interceptors, functions (NO components)
- All services MUST use `providedIn: 'root'`
- NEVER import from `feature/`, `layout/`, `pattern/`, or `ui/`
- Can ONLY import from `styles/`
- All code here is shared across the entire application

## Dependency Rules

```
core/ ──✅──> styles/
core/ ──❌──> feature/  (NEVER - core is lower level)
core/ ──❌──> layout/   (NEVER - core is lower level)
core/ ──❌──> pattern/  (NEVER - core is lower level)
core/ ──❌──> ui/       (NEVER - core has no templates)
```

## What Belongs in Core

**Logic needed from app start**:
- Authentication state and tokens
- User entity and roles
- Guards for route protection
- HTTP interceptors
- Error handling infrastructure

**Logic shared by 2+ features**:
- Services used by multiple features (extract here)
- State management shared between features
- Domain utilities (date parsing, query params)

## Organization

Group by domain, NOT by building block type:

```
core/
├── auth/           # Authentication domain
│   ├── auth.service.ts
│   └── auth.guard.ts
├── user/           # User domain
│   └── user.service.ts
├── error-handling/ # Error infrastructure
│   └── global-error-handler.ts
└── core.ts         # provideCore() export
```

**NEVER** organize like this:
```
core/
├── services/       # BAD - grouped by type
├── guards/         # BAD - grouped by type
└── interceptors/   # BAD - grouped by type
```

## provideCore() Pattern

```typescript
// core/core.ts
export function provideCore({ routes }: CoreOptions) {
  return [
    provideAnimations(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // ... other providers
  ];
}

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideCore({ routes })]
};
```

## Implementation Notes

Adapt paths to your project structure. The patterns and organization rules above remain consistent across different project layouts.
