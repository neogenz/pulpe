## Frontend architecture

### Fundamental Principles:

- Prioritize isolation over DRY (Don't Repeat Yourself) for business logic.
- Only consider abstraction for business logic after at least 3 occurrences.
- Maintain a strict, acyclic (no cycles) one-way dependency graph.
- All features must be lazy-loaded to ensure fast initial load times.
- Use `eslint-plugin-boundaries` to automatically enforce all architectural rules.
- Design the application to be composed of standalone components; avoid `NgModules`.

### Architectural Type Deep Dive:

- #### Core Type (`core/`)
  - **Purpose**: Central hub for all shared, headless, application-wide logic.
  - **Content**: Injector-based logic only. This includes services (`@Injectable`), route guards, HTTP interceptors, state management setup (e.g., NgRx `provideStore`), and infrastructure configuration.
  - **Loading**: Eager-loaded. Its content is part of the initial JavaScript bundle.
  - **Constraints**: MUST NOT contain any components, directives, or pipes (i.e., nothing with a template). It is the foundation that other types build upon. Can be sub-structured by domain (e.g., `core/orders/`, `core/auth/`).

- #### Layout Type (`layout/`)
  - **Purpose**: Defines the main application shell(s) or "chrome".
  - **Content**: Standalone components that structure the main view, such as headers, footers, side navigation, and the primary `<router-outlet>`.
  - **Loading**: Eager-loaded. It is the first thing the user sees.
  - **Constraints**: Consumes services from `core` to display stateful information (e.g., current user). Consumes presentational components from `ui`.

- #### UI Type (`ui/`)
  - **Purpose**: A library of generic, reusable, and purely presentational ("dumb") standalone components.
  - **Content**: Standalone components, directives, and pipes that are completely decoupled from application business logic.
  - **Loading**: Can be consumed by both eager (`layout`) and lazy (`feature`, `pattern`) parts of the app. Bundling is optimized via cherry-picking.
  - **Constraints**: MUST be stateless. MUST NOT inject services from `core`. MUST communicate exclusively via `@Input()` and `@Output()`. This ensures maximum reusability.

- #### Feature Type (`feature/`)
  - **Purpose**: Implements a specific business domain or user flow. This is where the majority of the application's unique value resides.
  - **Content**: A self-contained combination of standalone components (smart/container components), services, and routing specific to that domain.
  - **Loading**: **Always lazy-loaded** via routing's `loadChildren`.
  - **Constraints**: A `feature` is a "black box." It MUST be completely isolated from other sibling features. All sharing must happen through the "extract one level up" rule (to `core`, `ui`, or `pattern`).

- #### Pattern Type (`pattern/`)
  - **Purpose**: A reusable, state-aware, cross-cutting piece of functionality. It's more complex than a `ui` component but smaller than a full `feature`.
  - **Content**: A pre-packaged combination of standalone components and injectables. Unlike `ui` components, a `pattern` can inject services from `core` to manage its own state.
  - **Loading**: Not loaded via routing. It is "dropped in" to a `feature`'s template.
  - **Example**: A self-contained document manager, approval widget, or audit log that can be used across different `features`.

### Dependency Rules & Isolation:

- A `feature` MUST NOT import from a sibling `feature`.
- `core` MUST NOT import from `feature`, `layout`, or `pattern`.
- `ui` MUST NOT import from `core`, `feature`, `layout`, or `pattern`.
- A `feature` can import from `core`, `ui`, `pattern`, and its own sub-modules.
- A `layout` can import from `core`, `ui`, and `pattern`.
- A `pattern` can import from `core` and `ui`.

### Shared Logic & Reusability:

- **Local Scoping Principle:** All code (components, services, types, etc.) used by only a **single feature** MUST remain within that feature's directory. Only extract logic to a shared type (`core`, `ui`, `pattern`) when it is required by at least a **second feature**.
- To share logic, always "extract one level up" into the appropriate shared type.
- Logic shared between top-level `features` must be extracted to `core` (headless) or `pattern` (stateful UI).
- UI components shared between `features` must be extracted to `ui`.
- Logic shared only between sub-features of the _same_ parent `feature` is extracted to that parent `feature`'s folder.

### Implementation Best Practices:

- **CLI Generation:** All new Angular artifacts (components, services, directives, pipes) MUST be generated using the Angular CLI MCP. Manual file creation is prohibited to ensure consistency.
- Components should be "logic-free," delegating all business operations to injected services.
- Use `loadChildren` pointing to a `.routes.ts` file for all feature loading. Avoid `loadComponent`.
- Use `@defer` only for very large, non-critical components within a feature (e.g., charts, rich text editors).
- DO NOT create custom wrappers or abstractions around Angular or third-party library APIs. Use them directly.

### Dependency Injection & Scoping Rules

To enforce our architecture's isolation and prevent bugs, all services MUST be provided using one of the following strategies.

#### For Application-Wide Singletons (Global Services)
Services that need to maintain a single, shared state across the entire application.

- **Rule:** The service MUST be a singleton, available everywhere.
- **Implementation:** Use the decorator `@Injectable({ providedIn: 'root' })`.
- **Location:** The service file MUST be placed within the `core/` directory.

#### For Feature-Scoped Services (Local Services)
Services whose state and lifecycle are relevant only to a single lazy-loaded feature.

- **Rule:** The service must be isolated to prevent side effects in other features. A new instance is created each time the feature is loaded.
- **Implementation:** Add the service class to the `providers: []` array in the feature's route configuration file (e.g., `feature-name.routes.ts`).
- **Location:** The service file MUST be placed within the feature's own directory (e.g., `feature/my-feature/services/`).

#### AVOID Creating Unintended Multiple Instances
This is a critical source of bugs. Follow these rules strictly:

- **NEVER** provide the same service in the `providers: []` array of multiple different lazy features if you expect them to share state. This will create a separate, independent instance for each feature. If state must be shared, use a `root` provider (see rule #1).
- **NEVER** provide a service in a feature's `providers: []` array if that service is already using `providedIn: 'root'`. This creates a new, local instance that "shadows" the global one, leading to state inconsistencies.

#### Advanced Scoping & Patterns

- **Component/Directive Scope (`ElementInjector`):** Only use the `providers: []` array directly on a `@Component` or `@Directive` when you need a unique service instance for **each instance** of that component (e.g., a state service for a reusable `card` component that appears multiple times on one page).
- **Functional Dependency Injection:** When creating function-based providers like route guards (`CanActivateFn`), use the `inject()` function to access dependencies. Organize these guard/resolver files within the appropriate `core` or `feature` directory.

---

Implement or review the code for #$ARGUMENTS.

You MUST strictly enforce all rules from the technical documentation, paying close attention to:

1.  **Architectural Types**: Respect the purpose and constraints of `core`, `layout`, `ui`, `feature`, and `pattern`.
2.  **Dependency Rules**: Ensure the one-way, acyclic dependency graph is never violated.
3.  **Local Scoping**: Keep feature-specific code inside its feature folder until it is demonstrably needed elsewhere.
4.  **CLI Generation**: Assume all new components/services were (or should be) generated via the Angular CLI MCP.
