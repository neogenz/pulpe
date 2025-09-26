# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Always apply YAGNI and KISS principles. It is for a modern project, maintained by 1 developer.

## Quick Start Commands

### Development

```bash
# Full stack development (recommended)
pnpm dev                        # Start all services with Turborepo orchestration

# Targeted development
pnpm dev:frontend-only          # Frontend + shared only
pnpm dev:backend-only           # Backend + shared only
```

### Building

```bash
pnpm build                      # Build all projects with Turborepo
```

### Testing

```bash
# All tests
pnpm test                       # Run all tests
pnpm test:e2e                   # E2E tests only (Playwright)
pnpm test:performance           # Performance tests

cd backend-nest && bun test:performance # Performance tests
```

### Code Quality

```bash
# Quality checks
pnpm quality                    # Run all quality checks (type-check, lint, format)
pnpm quality:fix                # Fix all auto-fixable issues

# Frontend bundle analysis
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

- Details at @./frontend/CLAUDE.md
- Follow rules at @.cursor/rules/00-architecture/0-angular-architecture-structure.mdc

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

#### 3. Testing Strategy

- **Unit Tests**: Test business logic and component behavior
- **E2E Tests**: Critical path tests with real auth, feature tests with mocks

### Authentication Flow

1. **Frontend**: Supabase SDK manages JWT tokens
2. **Backend**: Validates tokens via `supabase.auth.getUser()`
3. **Database**: Row Level Security policies enforce data isolation
4. **Guards**: AuthGuard protects backend routes

### Key Files

- **Root config**: `turbo.json`, `pnpm-workspace.yaml`
- **Frontend config**: `frontend/angular.json`, `frontend/projects/webapp/src/app/app.config.ts`
- **Backend config**: `backend-nest/src/app.module.ts`, `backend-nest/src/config/environment.ts`
- **Shared types**: `shared/schemas.ts`, `shared/types.ts`
- **Database types**: `backend-nest/src/types/database.types.ts`

## References to business specs of project

- You can reference @memory-bank/SPECS.md dynamically to refer at all business data

## Important Notes

- Never use destructive (`db reset` for exemple) commands on supabase
