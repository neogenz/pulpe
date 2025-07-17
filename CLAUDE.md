# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.

## Quick Start Commands

The most commonly used commands for development:

```bash
# Start full development environment
pnpm dev

# Quality checks and fixes
pnpm quality:fix                   # Auto-fix all quality issues
pnpm quality                       # Check all quality issues

# Testing
pnpm test                          # Run all tests across packages
pnpm test:watch                    # Run tests in watch mode
```

## Project Structure

This is a monorepo with three main packages:

- `backend-nest/` - NestJS API with Supabase integration and Bun runtime
- `frontend/` - Angular 20 application with standalone components and signals
- `shared/` - Shared Zod schemas and TypeScript types

## Development Commands

### Backend (NestJS + Supabase + Bun)

```bash
cd backend-nest
bun install
bun run dev                        # Start development server with hot reload
bun run start                      # Start server without watch
bun run start:prod                 # Start production build
bun run build                      # Build for production
bun run generate-types             # Generate TypeScript types from Supabase
bun run dump:db                    # Dump database schema to schema.sql
bun run test                       # Run all tests
bun run test:watch                 # Run tests in watch mode
bun run test:coverage              # Run tests with coverage
bun run test:unit                  # Run unit tests only
bun run test:integration           # Run integration tests only
bun run test:performance           # Run performance tests
bun run test:load                  # Run load/performance tests with timeout
bun run test:all                   # Run all test suites
bun run test:ci                    # Run tests for CI with JSON output
bun run test:silent                # Run tests silently
bun run lint                       # Run ESLint
bun run lint:fix                   # Fix ESLint issues automatically
bun run format                     # Apply Prettier formatting
bun run format:check               # Check Prettier formatting
bun run type-check:full            # Full TypeScript type checking
bun run quality                    # Full type check + lint + format check
bun run quality:fix                # Auto-fix formatting and linting issues
```

### Frontend (Angular 20)

```bash
cd frontend
pnpm install
pnpm run start                     # Start dev server and open browser
pnpm run start:ci                  # Start dev server without opening browser
pnpm run dev                       # Alias for ng serve
pnpm run build                     # Build for production
pnpm run watch                     # Build in watch mode for development
pnpm run test                      # Run unit tests with Vitest
pnpm run test:watch                # Run unit tests in watch mode
pnpm run test:e2e                  # Run end-to-end tests with Playwright
pnpm run test:e2e:ui               # Run Playwright tests with UI
pnpm run test:e2e:headed           # Run E2E tests in headed mode
pnpm run test:e2e:debug            # Debug E2E tests
pnpm run test:e2e:report           # Show E2E test report
pnpm run test:e2e:codegen          # Generate E2E test code
pnpm run lint                      # Run ESLint
pnpm run format                    # Apply Prettier formatting
pnpm run format:check              # Check Prettier formatting
pnpm run analyze                   # Bundle analyzer with treemap
pnpm run analyze:sme               # Source map explorer analysis
pnpm run analyze:deps              # Dependency analysis with madge
pnpm run deps:circular             # Check for circular dependencies
```

### Shared Package

```bash
cd shared
pnpm install
pnpm run build                     # Compile TypeScript to ESM
pnpm run build:esm                 # Compile TypeScript to ESM (explicit)
pnpm run watch                     # Watch mode compilation
pnpm run clean                     # Clean dist directory
pnpm run format                    # Apply Prettier formatting
pnpm run format:check              # Check Prettier formatting
```

### Workspace Commands (from root)

```bash
pnpm install                       # Install all dependencies
pnpm run dev                       # Start all packages in development mode (turbo)
pnpm run dev:shared                # Start shared package in watch mode
pnpm run dev:frontend              # Start frontend only
pnpm run dev:backend               # Build shared + start backend
pnpm run dev:frontend-only         # Start frontend only (turbo)
pnpm run dev:backend-only          # Build shared + start backend
pnpm run build                     # Build all packages (turbo)
pnpm run build:all                 # Build all packages (turbo)
pnpm run build:shared              # Build shared package only
pnpm run build:frontend            # Build frontend only
pnpm run build:backend             # Build backend only
pnpm run test                      # Run all tests (turbo)
pnpm run test:watch                # Run all tests in watch mode (turbo)
pnpm run test:unit                 # Run unit tests (turbo)
pnpm run test:e2e                  # Run E2E tests (turbo)
pnpm run test:performance          # Run performance tests (turbo)
pnpm run lint                      # Run ESLint on all packages (turbo)
pnpm run lint:fix                  # Fix ESLint issues on all packages (turbo)
pnpm run format                    # Apply Prettier on all packages (turbo)
pnpm run format:check              # Check Prettier on all packages (turbo)
pnpm run type-check                # Type check all packages (turbo)
pnpm run quality                   # Full quality check (turbo)
pnpm run quality:fix               # Auto-fix quality issues (turbo)
pnpm run deps:check                # Check circular dependencies in frontend
pnpm run shared:watch              # Watch shared package (turbo)
pnpm run shared:build              # Build shared package (turbo)
```

## Architecture

### Backend Architecture

- **Framework**: NestJS with Bun runtime
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Validation**: Zod + class-validator
- **Structure**: Modular architecture with feature-based organization
- **Auth**: JWT-based with Supabase sessions
- **Types**: Auto-generated from Supabase schema
- **API Documentation**: Swagger/OpenAPI

### Frontend Architecture

- **Framework**: Angular 20 with standalone components
- **Change Detection**: OnPush strategy for performance
- **Auth**: Supabase client with guards and interceptors
- **Styling**: Tailwind CSS + Angular Material
- **Structure**: Feature-based architecture with `core/`, `feature/`, `ui/` separation
- **State**: Signal-based reactive patterns
- **Testing**: Vitest for unit tests, Playwright for E2E

#### Fundamental Principles:

- Prioritize isolation over DRY (Don't Repeat Yourself) for business logic.
- Only consider abstraction for business logic after at least 3 occurrences.
- Maintain a strict, acyclic (no cycles) one-way dependency graph.
- All features must be lazy-loaded to ensure fast initial load times.
- Use `eslint-plugin-boundaries` to automatically enforce all architectural rules.
- Design the application to be composed of standalone components; avoid `NgModules`.

Architectural Type Deep Dive:

#### Core Type (`core/`)

- **Purpose**: Central hub for all shared, headless, application-wide logic.
- **Content**: Injector-based logic only. This includes services (`@Injectable`), route guards, HTTP interceptors, state management setup (e.g., NgRx `provideStore`), and infrastructure configuration.
- **Loading**: Eager-loaded. Its content is part of the initial JavaScript bundle.
- **Constraints**: MUST NOT contain any components, directives, or pipes (i.e., nothing with a template). It is the foundation that other types build upon. Can be sub-structured by domain (e.g., `core/orders/`, `core/auth/`).

#### Layout Type (`layout/`)

- **Purpose**: Defines the main application shell(s) or "chrome".
- **Content**: Standalone components that structure the main view, such as headers, footers, side navigation, and the primary `<router-outlet>`.
- **Loading**: Eager-loaded. It is the first thing the user sees.
- **Constraints**: Consumes services from `core` to display stateful information (e.g., current user). Consumes presentational components from `ui`.

#### UI Type (`ui/`)

- **Purpose**: A library of generic, reusable, and purely presentational ("dumb") standalone components.
- **Content**: Standalone components, directives, and pipes that are completely decoupled from application business logic.
- **Loading**: Can be consumed by both eager (`layout`) and lazy (`feature`, `pattern`) parts of the app. Bundling is optimized via cherry-picking.
- **Constraints**: MUST be stateless. MUST NOT inject services from `core`. MUST communicate exclusively via `@Input()` and `@Output()`. This ensures maximum reusability.

#### Feature Type (`feature/`)

- **Purpose**: Implements a specific business domain or user flow. This is where the majority of the application's unique value resides.
- **Content**: A self-contained combination of standalone components (smart/container components), services, and routing specific to that domain.
- **Loading**: **Always lazy-loaded** via routing's `loadChildren`.
- **Constraints**: A `feature` is a "black box." It MUST be completely isolated from other sibling features. All sharing must happen through the "extract one level up" rule (to `core`, `ui`, or `pattern`).

#### Pattern Type (`pattern/`)

- **Purpose**: A reusable, state-aware, cross-cutting piece of functionality. It's more complex than a `ui` component but smaller than a full `feature`.
- **Content**: A pre-packaged combination of standalone components and injectables. Unlike `ui` components, a `pattern` can inject services from `core` to manage its own state.
- **Loading**: Not loaded via routing. It is "dropped in" to a `feature`'s template.
- **Example**: A self-contained document manager, approval widget, or audit log that can be used across different `features`.

#### Dependency Rules & Isolation:

- A `feature` MUST NOT import from a sibling `feature`.
- `core` MUST NOT import from `feature`, `layout`, or `pattern`.
- `ui` MUST NOT import from `core`, `feature`, `layout`, or `pattern`.
- A `feature` can import from `core`, `ui`, `pattern`, and its own sub-modules.
- A `layout` can import from `core`, `ui`, and `pattern`.
- A `pattern` can import from `core` and `ui`.

#### Shared Logic & Reusability:

- To share logic, always "extract one level up" into the appropriate shared type.
- Logic shared between top-level `features` must be extracted to `core` (headless) or `pattern` (stateful UI).
- UI components shared between `features` must be extracted to `ui`.
- Logic shared only between sub-features of the _same_ parent `feature` is extracted to that parent `feature`'s folder.
  Implementation Best Practices:
- Components should be "logic-free," delegating all business operations to injected services.
- Use `loadChildren` pointing to a `.routes.ts` file for all feature loading. Avoid `loadComponent`.
- Use `@defer` only for very large, non-critical components within a feature (e.g., charts, rich text editors).
- DO NOT create custom wrappers or abstractions around Angular or third-party library APIs. Use them directly.

### Key Patterns

- **Shared schemas**: Zod schemas in `shared/` package used by both backend and frontend
- **Type safety**: Full TypeScript coverage from database to UI
- **Module separation**: Each business domain (budget, transaction, auth) has its own folder
- **Component architecture**: Standalone Angular components with minimal modules
- **Mapper pattern**: Backend uses mappers for DB ↔ API transformations with validation

## Validation & Type Safety

- Backend uses double-layer validation: Supabase types (compile-time) + Zod schemas (runtime)
- Frontend uses the same Zod schemas from `shared/` for client-side validation
- Database types are auto-generated: `bun run generate-types` in backend-nest
- All API routes have OpenAPI documentation via NestJS Swagger

## Authentication Flow

1. User signs up/in via frontend using Supabase SDK
2. Frontend obtains JWT tokens from Supabase auth
3. Frontend sends Bearer tokens in Authorization header for API calls
4. Backend middleware validates JWT tokens and provides user context
5. RLS policies in Supabase handle data access control

## Testing

### Backend Testing

- **Framework**: Bun Test + NestJS Testing
- **Types**: Unit tests (`*.service.spec.ts`), integration tests (`*.integration.spec.ts`), performance tests (`*.performance.spec.ts`)
- **Test utilities**: Centralized mocks and helpers in `src/test/test-utils.ts`
- **Coverage**: `bun run test:coverage`

### Frontend Testing

- **Unit tests**: Vitest for component and service testing
- **E2E tests**: Playwright with page object model pattern. Use attr.data-testid
- **Test organization**: Tests in `e2e/` directory with fixtures and utilities
- **Commands**: `pnpm run test:watch` for interactive unit testing, `pnpm run test:e2e:ui` for E2E testing

## Code Style

- **TypeScript**: Strict mode enabled across all packages
- **Private fields**: Use `#fieldName` syntax instead of `private` keyword
- **Formatting**: Prettier with project-specific configuration
- **Linting**: ESLint with NestJS, Angular, and TypeScript rules
- **Validation**: Zod for runtime validation, comprehensive error handling

## Git Hooks

The project uses [Lefthook](https://lefthook.dev/) for managing git hooks:

- **Pre-commit**: Runs `turbo quality` (type-check + lint + format:check) on all changed workspaces
- **Installation**: Automatically installed via `postinstall` script when running `pnpm install`
- **Skip hooks**: Use `git commit --no-verify` to bypass pre-commit checks when needed
- **Configuration**: See `lefthook.yml` for hook definitions

## Database

- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Client**: Direct Supabase client, no additional ORM
- **Migrations**: Managed through Supabase dashboard or CLI
- **Types**: Auto-generated TypeScript types in `backend-nest/src/types/database.types.ts`
- **Schema validation**: Zod schemas for DB entities in each module's `schemas/` directory

## Module Organization

### Backend Module Structure

```
backend-nest/src/modules/[feature]/
├── dto/                    # Swagger DTOs for API documentation
├── entities/              # TypeScript entities for API responses
├── schemas/               # Zod validation schemas for DB entities
├── [feature].controller.ts
├── [feature].service.ts
├── [feature].mapper.ts    # Data transformation with validation
├── [feature].module.ts
└── [feature].*.spec.ts    # Tests
```

### Frontend Feature Structure

```
frontend/projects/webapp/src/app/feature/[feature]/
├── components/            # Feature-specific components
├── services/             # Feature-specific services and state
├── [feature].routes.ts   # Feature routing
└── [feature].ts         # Main feature component
```

## Important Files

- `backend-nest/src/main.ts` - NestJS application entry point
- `frontend/projects/webapp/src/app/app.config.ts` - Angular application configuration
- `shared/index.ts` - Exported schemas and types
- `shared/schemas.ts` - Zod validation schemas
- `pnpm-workspace.yaml` - Monorepo workspace configuration
- `turbo.json` - Turborepo pipeline configuration

## Onboarding Feature

The application includes a multi-step onboarding process for new users:

- **Location**: `frontend/projects/webapp/src/app/feature/onboarding/`
- **State Management**: Uses custom store with signals (`onboarding-store.ts`)
- **Steps**: Personal info, income, housing, transport, health insurance, phone plan, leasing credit
- **Layout**: Dedicated onboarding layout with step navigation
- **Integration**: Connected to user registration and template creation

## Development Workflow

1. **Start development**: `pnpm dev` starts all services with hot reload
2. **Quality checks**: Always run `pnpm quality:fix` before committing
3. **Testing**: Use `pnpm test:watch` for continuous testing during development
4. **Type generation**: Run `bun run generate-types` in backend after database changes

## Frontend design system

- UI must implement Material Design 3 of Google
- Use Angular Material toolkit for UI component
- Use Angular Material System Variables to override style
- Use Taiwlind overriden configuration from @frontend/projects/webapp/src/app/styles/vendors/\_tailwind.css
- Use colors and typography from Angular Material theming and Tailwind
- Use always colors surface containers depending on correct level of importance, like documented in Material Design 3 (impl. by Angular Material and Tailwind)