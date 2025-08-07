# Feature Architecture

This directory contains all lazy-loaded features representing specific business domains or user flows, following Angular Enterprise Architecture patterns.

## Purpose & Content

**Purpose**: Implement specific business domains or user flows that are completely isolated from each other.

**Content**:

- Self-contained combination of standalone components (smart/container components)
- Feature-specific services and state management
- Routing configuration specific to that domain
- Can contain nested lazy sub-features for complex domains

**Loading**: Always lazy-loaded via routing's `loadChildren` for optimal performance and isolation.

## Core Architecture Principles

### 1. Complete Isolation ("Black Box")

- Features are **completely isolated** from sibling features
- Features **MUST NOT** import from other sibling features
- Each feature is a "black box" that can be independently developed, tested, and even replaced
- Prioritize isolation over DRY (Don't Repeat Yourself) for business logic

### 2. Lazy Loading by Default

- **ALL features must be lazy-loaded** to ensure fast initial load times
- Even the first/only feature should be lazy-loaded for consistency
- Use `loadChildren` pointing to `.routes.ts` files (avoid `loadComponent`)

### 3. Domain-Based Organization

```
feature/
└── [feature-name]/                       # Business domain (e.g., orders, user-profile)
    ├── index.ts                          # Public API (exports routes)
    ├── [feature-name].routes.ts          # Feature routing configuration
    ├── [feature-name].component.ts       # Main feature component
    ├── components/                       # Feature-specific components
    │   └── [component-name]/
    │       └── [component-name].component.ts
    ├── services/                         # Feature-specific services
    │   └── [service-name].service.ts
    ├── models/                           # Feature-specific models
    │   └── [model-name].model.ts
    ├── state/                            # Feature-specific state (if using state management)
    │   └── [feature-name].state.ts
    └── [sub-feature]/                    # Nested lazy sub-features (if needed)
        ├── [sub-feature].routes.ts
        └── [sub-feature].component.ts
```

### Nested Sub-Features

Large features can be split into lazy sub-features:

```
feature/
└── orders/                               # Parent feature
    ├── orders.routes.ts
    ├── orders.component.ts
    ├── dashboard/                        # Lazy sub-feature
    │   ├── dashboard.routes.ts
    │   └── dashboard.component.ts
    └── definitions/                      # Lazy sub-feature
        ├── definitions.routes.ts
        └── definitions.component.ts
```

## Creating a New Feature

### Best Practices

1. **Start with routing**: Even if you have only one view, set up routing from the start
2. **Feature-level providers**: Register services in the feature's routes config, not globally
3. **Maintain isolation**: Never import from sibling features
4. **Use the "Extract One Level Up" rule**: When sharing is needed, extract to core/ui/pattern

### Manual Creation Steps

1. Create feature folder: `feature/[feature-name]/`
2. Create routes file with feature configuration
3. Create main component with standalone configuration
4. Update `app.routes.ts` to lazy-load the feature
5. Add feature-specific services, models, and components

### Using Angular CLI

```bash
# Generate feature component
ng generate component feature/[feature-name]/[feature-name] --standalone

# Generate feature service (DO NOT use providedIn: 'root')
ng generate service feature/[feature-name]/services/[service-name]

# Generate sub-component
ng generate component feature/[feature-name]/components/[component-name] --standalone
```

### Routes Configuration Example

```typescript
// feature/orders/orders.routes.ts
export const routes: Routes = [
  {
    path: "",
    component: OrdersComponent,
    providers: [
      OrdersService, // Feature-scoped service
      // Other feature-specific providers
    ],
    children: [
      {
        path: "dashboard",
        loadChildren: () => import("./dashboard/dashboard.routes"),
      },
    ],
  },
];
```

## Feature Rules & Constraints

### ✅ MUST DO

- **Maintain complete isolation** between sibling features
- **Always lazy-load** features via `loadChildren`
- **Provide services at feature level** in routes config (creates feature-scoped instances)
- **Use standalone components** exclusively
- **Keep components "logic-free"** - delegate to services
- **Export only routes** through index.ts
- **Use signals and OnPush** change detection

### ❌ MUST NOT DO

- **Never import from sibling features** (breaks isolation)
- **Never provide services in root** (unless extracting to core/)
- **Never use `loadComponent`** (use `loadChildren` with routes instead)
- **Never create eager features** (all features must be lazy)
- **Never mix business logic with presentation** in components

### The "Extract One Level Up" Rule

When logic needs to be shared between features:

1. **Between sibling features**: Extract to `core/`, `ui/`, or `pattern/`
2. **Between sub-features of same parent**: Extract to parent feature folder
3. **Wait for 3+ occurrences** before abstracting (isolation > DRY)

## Dependency Rules

A feature can import from:

- ✅ `core/` - Headless services, guards, interceptors, state
- ✅ `ui/` - Generic presentational components
- ✅ `pattern/` - Reusable stateful components
- ✅ Its own sub-modules and sub-features
- ✅ Angular framework and third-party libraries

A feature CANNOT import from:

- ❌ Sibling features (e.g., `feature/orders` → `feature/tasks`)
- ❌ Parent features (for sub-features)
- ❌ `layout/` - Features don't know about layouts

## Feature Characteristics

### "Black Box" Nature

- Features are self-contained units that can be developed independently
- Internal implementation details don't affect other features
- Can be completely replaced without impacting the rest of the app
- "Throw-away" nature - easy to remove and rewrite if needed

### Fractal Architecture

- Features can contain sub-features that follow the same patterns
- Sub-features can have their own sub-features (unlimited nesting)
- Each level maintains the same architectural rules

### Example Implementation

See `user-profile/` for a complete example including:

- Standalone components with signals
- Feature-scoped service provision in routes
- Lazy-loaded configuration
- Domain-based organization
- Proper isolation from other features

## Sharing Logic Between Features

### When to Extract from Feature

**To `ui/`**:

- Generic presentational component needed by 3+ features
- Component communicates only via @Input/@Output
- No direct state or service dependencies

**To `pattern/`**:

- Stateful component pattern reused across features
- Pre-packaged combination of UI + services
- Examples: document-manager, approval-widget, audit-log

**To `core/`**:

- Headless business logic needed by multiple features
- Services, guards, interceptors, state slices
- Domain logic that must be shared (e.g., OrderService used by orders and dashboard features)

### The Extraction Process

1. **Wait for 3+ occurrences** before extracting (isolation > DRY)
2. Identify all dependencies of the code to extract
3. Determine the correct destination type (core/ui/pattern)
4. Create the new implementation in the target location
5. Update all features to use the extracted version
6. Remove duplicated code from features

## Testing Strategy

### Isolation Benefits for Testing

- **Local testing**: Changes in a feature only affect that feature's tests
- **Fast feedback**: Test only the feature you're working on
- **Clear boundaries**: Easy to mock dependencies from core/ui/pattern

### Test Types

- **Unit tests**: Services, guards, pure functions
- **Component tests**: UI logic and user interactions
- **Integration tests**: Feature workflows and routing
- **E2E tests**: Critical user journeys across features

## Performance Benefits

### Lazy Loading Impact

- **Faster initial load**: Only load the first feature needed
- **Smaller bundles**: Each feature is a separate bundle
- **Better caching**: Features can be cached independently
- **Faster development**: Hot reload only affects the feature bundle

### Optimization Techniques

- Use `OnPush` change detection strategy
- Implement virtual scrolling for large lists
- Use `trackBy` functions in loops
- Leverage computed signals for derived state
- Use `@defer` for heavy components within features

## Common Pitfalls to Avoid

1. **Creating "SharedFeature"**: Don't create a shared feature. Extract to core/ui/pattern instead
2. **Over-abstracting too early**: Wait for 3+ occurrences before extracting
3. **Feature-to-feature imports**: Use eslint-plugin-boundaries to catch these
4. **Eager features**: Even single features should be lazy-loaded
5. **God services**: Keep services focused on single responsibilities
