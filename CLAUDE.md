# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pulpe is a personal budget management application for the Swiss market. Users plan their financial year using reusable monthly templates with automatic rollover mechanisms.

**Core Philosophy**: Planning > Tracking, Simplicity > Completeness (KISS & YAGNI), Isolation > DRY

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Angular 20+ (Standalone Components, Signals, OnPush), Tailwind CSS v4, Angular Material v20, Vitest, Playwright
- **Backend**: NestJS 11+ with Bun runtime, Supabase (PostgreSQL + Auth + RLS)
- **Shared**: `@pulpe/shared` package with Zod schemas for API contracts

## Commands

### Development
```bash
pnpm dev                    # Full stack (frontend + backend + shared watch)
pnpm dev:frontend           # Frontend only (http://localhost:4200)
pnpm dev:backend            # Backend only (http://localhost:3000)
```

### Quality & Testing
```bash
pnpm quality:fix            # Fix all auto-fixable issues (lint, format, type-check)
pnpm test                   # Run all tests
pnpm test:e2e               # Run Playwright E2E tests

# Frontend specific
cd frontend && pnpm test:watch              # Vitest watch mode
cd frontend && pnpm test:e2e:ui             # Playwright UI mode
cd frontend && pnpm deps:circular           # Check circular dependencies

# Backend specific
cd backend-nest && bun test                 # Run backend tests
cd backend-nest && bun run test:performance # Performance tests
```

### Build
```bash
pnpm build                  # Build all packages
pnpm build:shared           # Build shared package only
```

## Architecture

### Monorepo Structure
```
pulpe-workspace/
├── frontend/               # Angular 20 web app
├── backend-nest/           # NestJS API with Bun
├── shared/                 # @pulpe/shared - Zod schemas for API contracts
└── turbo.json              # Turborepo orchestration
```

### Frontend 5-Layer Architecture

Located in `frontend/projects/webapp/src/app/`:

| Layer | Purpose | Loading |
|-------|---------|---------|
| `core/` | Headless services, guards, interceptors | Eager |
| `layout/` | Application shell components | Eager |
| `ui/` | Stateless reusable components (inputs/outputs only) | Cherry-picked |
| `pattern/` | Stateful reusable components bound to services | Imported |
| `feature/` | Business domains (complete isolation between features) | Lazy |

**Dependency Rules (one-way only)**:
- `feature` can import from: `ui`, `pattern`, `core`
- `pattern` can import from: `ui`, `core`
- `layout` can import from: `ui`, `core`
- `ui` cannot import from `core` (generic components only)
- Features cannot import from sibling features (complete isolation)

### Backend Module Structure

Each module in `backend-nest/src/modules/[domain]/`:
```
├── [domain].controller.ts     # HTTP routes + validation
├── [domain].service.ts        # Business logic
├── [domain].mapper.ts         # DTO <-> Entity transformation
├── [domain].module.ts         # DI configuration
├── dto/                       # NestJS DTOs (createZodDto from shared schemas)
└── entities/                  # Business entities
```

### Shared Package Usage

`@pulpe/shared` is the single source of truth for API contracts:

```typescript
// In backend - create NestJS DTO from shared schema
import { budgetCreateSchema } from '@pulpe/shared';
export class BudgetCreateDto extends createZodDto(budgetCreateSchema) {}

// In frontend - use types directly
import { type BudgetCreate } from '@pulpe/shared';
```

**What belongs in shared**: API request/response types, form validation schemas, enums, business domain types.
**What does NOT belong**: Database types, backend implementation details, frontend UI types.

## Key Patterns

### Angular Patterns
- All components are standalone (no NgModules)
- Use `input()`, `output()`, `computed()` signals - avoid decorators
- OnPush change detection everywhere
- Inline templates/styles for small components
- No template functions - use `computed()` instead
- Avoid renaming inputs/outputs

### Backend Patterns
- Controllers inject `@User()` and `@SupabaseClient()` via custom decorators
- Services use mappers for DTO <-> Entity transformation
- Global `ZodValidationPipe` for automatic DTO validation
- RLS policies enforce data isolation at database level

### State Management
- Angular Signals for reactive state
- Direct service injection (no global store)
- Feature-specific state in `core/` or within the feature

## Deployment

- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Supabase Cloud

## Pre-commit

Lefthook runs `pnpm quality` on changed files. Skip with `--no-verify` if needed.

## Important Notes
- Never use destructive commands (`db reset`) on Supabase
