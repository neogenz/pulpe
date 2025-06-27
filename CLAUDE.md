# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo with three main packages:
- `backend-nest/` - NestJS API with Supabase integration and Bun runtime
- `frontend/` - Angular 20 application with standalone components
- `shared/` - Shared Zod schemas and TypeScript types

## Development Commands

### Backend (NestJS + Supabase + Bun)
```bash
cd backend-nest
bun install
bun run start:dev                  # Start development server with hot reload
bun run build                      # Build for production
bun run generate-types             # Generate TypeScript types from Supabase
bun run test                       # Run all tests
bun run test:unit                  # Run unit tests only
bun run test:integration           # Run integration tests only
bun run test:performance           # Run performance tests
bun run lint                       # Run ESLint
bun run format                     # Apply Prettier formatting
bun run quality                    # Full type check + lint + format check
bun run quality:fix                # Auto-fix formatting and linting issues
```

### Frontend (Angular 20)
```bash
cd frontend
pnpm install
pnpm run start                     # Start dev server and open browser
pnpm run build                     # Build for production
pnpm run test                      # Run tests with Karma
pnpm run test:vitest               # Run tests with Vitest
pnpm run test:vitest:ui            # Run Vitest with UI
pnpm run test:e2e                  # Run end-to-end tests with Playwright
pnpm run test:e2e:ui               # Run Playwright tests with UI
pnpm run lint                      # Run ESLint
pnpm run format:test               # Check Prettier formatting
pnpm run format:write              # Apply Prettier formatting
pnpm run analyze                   # Bundle analyzer with treemap
pnpm run analyze:deps              # Dependency analysis with madge
```

### Shared Package
```bash
cd shared
pnpm install
pnpm run build                     # Compile TypeScript
pnpm run dev                       # Watch mode compilation
```

### Workspace Commands (from root)
```bash
pnpm install                       # Install all dependencies
pnpm run dev                       # Start all packages in development mode
pnpm run build                     # Build frontend and shared packages
pnpm run build:all                 # Build all packages including backend
pnpm run dev:frontend-only         # Start only frontend with shared package watching
pnpm run dev:backend-only          # Start only backend with shared package watching
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
- **E2E tests**: Playwright with page object model pattern
- **Test organization**: Tests in `e2e/` directory with fixtures and utilities
- **Commands**: `pnpm run test:vitest:ui` for interactive unit testing, `pnpm run test:e2e:ui` for E2E testing

## Code Style

- **TypeScript**: Strict mode enabled across all packages
- **Private fields**: Use `#fieldName` syntax instead of `private` keyword
- **Formatting**: Prettier with project-specific configuration
- **Linting**: ESLint with NestJS, Angular, and TypeScript rules
- **Validation**: Zod for runtime validation, comprehensive error handling

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