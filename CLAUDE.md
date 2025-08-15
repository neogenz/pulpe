# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

### Development

```bash
# Full stack development (recommended)
pnpm dev                        # Start all services with Turborepo orchestration

# Targeted development
pnpm dev:frontend-only          # Frontend + shared only
pnpm dev:backend-only           # Backend + shared only

# Individual services
pnpm dev:frontend               # Frontend only (localhost:4200)
pnpm dev:backend                # Backend only (localhost:3000)
```

### Building

```bash
pnpm build                      # Build all projects with Turborepo
pnpm build:shared               # Build shared package only
pnpm build:frontend             # Build frontend only
pnpm build:backend              # Build backend only
```

### Testing

```bash
# All tests
pnpm test                       # Run all tests
pnpm test:watch                 # Run tests in watch mode
pnpm test:unit                  # Unit tests only
pnpm test:e2e                   # E2E tests only (Playwright)
pnpm test:performance           # Performance tests

# Frontend specific tests
cd frontend && pnpm test        # Vitest unit tests
cd frontend && pnpm test:e2e    # Playwright E2E tests
cd frontend && pnpm test:e2e:ui # Playwright with UI

# Backend specific tests
cd backend-nest && bun test     # Bun unit tests
cd backend-nest && bun test:performance # Performance tests
```

### Code Quality

```bash
# Quality checks
pnpm quality                    # Run all quality checks (type-check, lint, format)
pnpm quality:fix                # Fix all auto-fixable issues
pnpm lint                       # ESLint check
pnpm lint:fix                   # ESLint auto-fix
pnpm format                     # Prettier format
pnpm format:check               # Prettier check
pnpm type-check                 # TypeScript type checking

# Frontend bundle analysis
cd frontend && pnpm analyze     # Bundle analyzer with treemap
cd frontend && pnpm analyze:sme # Source map explorer
cd frontend && pnpm deps:circular # Check for circular dependencies
```

## High-level Architecture

### Monorepo Structure

```
pulpe-workspace/
├── frontend/              # Angular 20 web app with Material Design 3
├── backend-nest/          # NestJS API with Supabase & Bun runtime
├── shared/                # Shared Zod schemas and TypeScript types
├── mobile/                # iOS SwiftUI application
├── .cursor/               # Cursor AI rules and configurations
└── turbo.json             # Turborepo orchestration config
```

### Technology Stack

- **Monorepo**: Turborepo + pnpm workspace for orchestration
- **Backend**: NestJS 11+, Bun runtime, Supabase (PostgreSQL + Auth), Zod validation
- **Frontend**: Angular 20+, Standalone Components, Signals, Tailwind CSS v4.1, Angular Material v20
- **Mobile**: iOS SwiftUI, MVVM architecture, iOS 17.0+
- **Shared**: TypeScript strict, Zod schemas, ESM-first

### Key Architectural Principles

#### 1. Type Safety Across Stack

- **@pulpe/shared**: Contains Zod schemas for REST DTOs only
- **Backend types**: Supabase types stay in backend only
- **Frontend types**: Import from @pulpe/shared for API contracts

#### 2. Frontend Architecture (Angular)

- **Standalone Components**: No NgModules, everything is standalone
- **Signal-based**: Use Angular signals for reactive state
- **OnPush Strategy**: All components use OnPush change detection
- **Feature Isolation**: Features cannot depend on each other directly
- **Lazy Loading**: All features must be lazy-loaded

Directory structure:

```
frontend/projects/webapp/src/app/
├── core/       # Application-wide services, guards, interceptors
├── layout/     # App shell components (header, navigation)
├── ui/         # Reusable, stateless components
├── feature/    # Business domain features (lazy-loaded)
└── pattern/    # Reusable stateful components
```

Details at @frontend/CLAUDE.md, following rules at @.cursor/rules/00-architecture/0-angular-architecture-structure.mdc

#### 3. Backend Architecture (NestJS)

- **Module-based**: Each domain has its own module
- **JWT + RLS**: Authentication via Supabase with Row Level Security
- **Validation**: Zod schemas with NestJS integration
- **API Versioning**: All endpoints prefixed with `/api/v1`

Module structure:

```
backend-nest/src/modules/[domain]/
├── [domain].controller.ts    # HTTP routes + validation
├── [domain].service.ts       # Business logic
├── [domain].module.ts        # Module configuration
├── [domain].mapper.ts        # DTO ↔ Entity transformation
├── dto/                      # NestJS DTOs
└── entities/                 # Business entities
```

Details at @backend-nest/CLAUDE.md

### Development Workflow

#### 1. Adding a New Feature

1. Define shared types in `shared/schemas.ts` if needed
2. Build shared: `cd shared && pnpm build`
3. Implement backend API in `backend-nest/src/modules/`
4. Create frontend feature in `frontend/projects/webapp/src/app/feature/`
5. Add E2E tests in `frontend/e2e/tests/`

#### 2. Database Changes

1. Apply migrations: `cd backend-nest && bun run supabase:push`
2. Generate types: `cd backend-nest && bun run generate-types:local`
3. Update DTOs in shared package if needed

#### 3. Testing Strategy

- **Unit Tests**: Test business logic and component behavior
- **E2E Tests**: Critical path tests with real auth, feature tests with mocks
- **Performance Tests**: Load testing for backend endpoints

### Authentication Flow

1. **Frontend**: Supabase SDK manages JWT tokens
2. **Backend**: Validates tokens via `supabase.auth.getUser()`
3. **Database**: Row Level Security policies enforce data isolation
4. **Guards**: AuthGuard protects backend routes

### Important Conventions

#### Angular Naming (v20)

- Services: `application-info.ts` (no `.service` suffix)
- Components: Standalone with `pulpe-` prefix
- Use private fields with `#fieldName` syntax
- Angular Material v20 button directives: `matButton="filled"`, `matButton="outlined"`

#### State Management

- Use Angular signals for local state
- Feature-specific state services in `feature/[domain]/services/`
- Direct state service access when context is lightweight

#### Material Design 3

- Use Material Design 3 principles strictly
- Color system via CSS variables in Tailwind config
- Mobile-first responsive design
- Typography scale: `text-display-large`, `text-body-medium`, etc.

#### Business Vocabulary (French UI)

- **budget_lines** → "prévisions" (never "lignes budgétaires")
- **Recurrence**: "Tous les mois" (fixed), "Une seule fois" (one_off)
- **Financial labels**: "Disponible à dépenser", "Épargne prévue"
- **Default transaction type**: expense (Dépense)

### Pre-commit Hooks

Lefthook runs quality checks automatically:

```bash
pnpm run quality --filter="...[HEAD^]"
```

### Environment Setup

1. **Backend**: Copy `.env.example` to `.env` and configure Supabase
2. **Frontend**: Configuration in `environment.development.ts`
3. **E2E Tests**: Set `TEST_EMAIL` and `TEST_PASSWORD` env vars

### Debugging

- Frontend debug route: `/app/debug` (development only)
- Backend Swagger: `http://localhost:3000/api/docs`
- Application info service shows version, build info, Git hash

### Key Files

- **Root config**: `turbo.json`, `pnpm-workspace.yaml`
- **Frontend config**: `frontend/angular.json`, `frontend/projects/webapp/src/app/app.config.ts`
- **Backend config**: `backend-nest/src/app.module.ts`, `backend-nest/src/config/environment.ts`
- **Shared types**: `shared/schemas.ts`, `shared/types.ts`
- **Database types**: `backend-nest/src/types/database.types.ts`
