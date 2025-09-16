# Pulpe - System Architecture

*AI Context Document for AIDD/BMAD Workflow*

## Executive Summary

**System Purpose**: Personal budget management application for the Swiss market, enabling users to plan their financial year using reusable monthly templates with automatic rollover mechanisms.

**Core Philosophy**:
- Planning > Tracking (anticipate rather than react)
- Simplicity > Completeness (KISS & YAGNI principles)
- Isolation > DRY (3-5x more valuable for maintainability)

**Technology Stack**:
- Frontend: Angular 20 (Standalone Components + Signals)
- Backend: NestJS 11 (Bun runtime)
- Database: Supabase (PostgreSQL + Auth + RLS)
- Shared: Zod schemas + TypeScript types
- Mobile: iOS SwiftUI (future)
- Orchestration: Turborepo + PNPM workspaces

**Deployment**:
- Frontend: Vercel
- Backend: Railway
- Database: Supabase Cloud
- CDN/Assets: Vercel Edge Network

## System Architecture

### Monorepo Structure
```
pulpe-workspace/
├── frontend/           # Angular 20 web application
├── backend-nest/       # NestJS API with Bun runtime
├── shared/            # Zod schemas and TypeScript types
├── mobile/            # iOS SwiftUI application (future)
├── .cursor/           # AI development rules and patterns
├── turbo.json         # Turborepo orchestration
└── memory-bank/       # AIDD context files
```

### Package Dependencies
- **@pulpe/shared**: Core package with REST DTOs (Zod schemas only)
- **frontend**: Depends on @pulpe/shared for API contracts
- **backend-nest**: Depends on @pulpe/shared for DTO validation
- **mobile**: Future dependency on shared for API consistency

### Build Orchestration (Turborepo)
- Cache-first approach with intelligent dependency resolution
- Automatic build order: `shared → frontend & backend (parallel)`
- Development mode: Hot reload with shared package watching
- Commands: `pnpm dev` (full stack), `pnpm build` (production)

### Key Principles
- **Zero Breaking Changes**: Shared package versioning strategy
- **Type Safety**: End-to-end TypeScript + Zod validation
- **Performance First**: Lazy loading, OnPush detection, caching

## Frontend Architecture

### Framework Configuration
- **Angular 20** with strict mode, standalone components
- **Change Detection**: OnPush strategy for all components
- **State Management**: Angular signals + direct service access
- **Styling**: Tailwind CSS v4 + Angular Material v20
- **Testing**: Vitest (unit) + Playwright (E2E)

### Architectural Types (5-Layer Pattern)
```
frontend/projects/webapp/src/app/
├── core/       # Headless services, guards (eager-loaded)
├── layout/     # Application shell components (eager-loaded)
├── ui/         # Stateless reusable components (cherry-picked)
├── feature/    # Business domains (lazy-loaded)
└── pattern/    # Stateful reusable components (imported)
```

### Dependency Rules (Acyclic)
```
core     ← layout, feature, pattern
ui       ← layout, feature, pattern
pattern  ← feature
feature  ← (isolated, no sibling dependencies)
```

### Routing Strategy
- **Lazy Loading**: All features via `loadChildren`
- **Feature Isolation**: Complete separation between business domains
- **Nested Features**: Support for multi-level navigation

### State Management
- **Angular Signals**: Reactive state primitives
- **Domain Services**: Feature-specific state in `core/` or `feature/`
- **No Global Store**: Direct service injection pattern

### Key Patterns
- **Standalone Everything**: No NgModules
- **OnPush + Signals**: Performance optimization
- **Feature Black Box**: Throwaway and replaceable architecture

## Backend Architecture

### Framework Configuration
- **NestJS 11** with TypeScript strict mode
- **Runtime**: Bun for performance and modern JS features
- **Validation**: Global ZodValidationPipe
- **Documentation**: Swagger/OpenAPI auto-generation
- **Logging**: Pino structured logging with request correlation

### Module Structure
```
backend-nest/src/modules/[domain]/
├── [domain].controller.ts    # HTTP routes + validation
├── [domain].service.ts       # Business logic
├── [domain].mapper.ts        # DTO ↔ Entity transformation
├── [domain].module.ts        # DI configuration
├── dto/                      # NestJS DTOs (createZodDto)
└── entities/                 # Business entities
```

### Authentication & Security
- **JWT Tokens**: Supabase Auth integration
- **AuthGuard**: Global protection with custom decorators
- **RLS Policies**: Database-level security (auth.uid())
- **Zero Trust**: All endpoints protected by default

### API Design
- **REST**: RESTful endpoints with `/api/v1` prefix
- **Validation Pipeline**: Zod schemas → DTO validation → Business rules
- **Error Handling**: Global exception filter with structured responses
- **Documentation**: Auto-generated Swagger from DTOs

### Key Patterns
- **Controller → Service → Mapper**: Clear separation of concerns
- **Dependency Injection**: Constructor injection with decorators
- **Type Safety**: Supabase generated types + Zod validation

## Data Architecture

### Database Platform
- **Supabase**: PostgreSQL with built-in auth, real-time, and REST API
- **Row Level Security (RLS)**: User data isolation at database level
- **Type Generation**: Automatic TypeScript types from schema

### Core Tables
```sql
auth.users                 -- Managed by Supabase Auth
public.monthly_budget       -- Monthly budget instances
public.transaction          -- Financial transactions
public.template            -- Budget templates (reusable)
public.template_line       -- Template transaction items
```

### Security Model
- **RLS Policies**: `WHERE auth.uid() = user_id` on all user tables
- **JWT Validation**: Backend validates tokens with Supabase
- **API Layer**: Additional business rule validation
- **Database**: Final constraint validation and RLS enforcement

### Data Flow
```
Frontend DTO (Zod) → Backend DTO (createZodDto) → Service Logic → Supabase Client → RLS → PostgreSQL
```

### Key Features
- **Automatic Rollover**: Monthly budget surplus/deficit propagation
- **Template System**: Reusable budget structures
- **Financial Calculations**: Server-side computed values

## Shared Package (@pulpe/shared)

### Purpose
Single source of truth for API contracts between frontend and backend.

### Content Strategy
- **Zod Schemas**: Runtime validation + type generation
- **REST DTOs Only**: No Supabase types (backend-only)
- **ESM Format**: Modern module system with proper exports

### Validation Pipeline
- **Frontend**: Client-side UX validation
- **Backend**: Server-side business validation
- **Database**: Structural validation + RLS

### Key Files
- `schemas.ts`: All Zod schemas and inferred types
- `index.ts`: Single export point
- `calculators/`: Business logic utilities

### Usage Pattern
```typescript
// Frontend
import { budgetCreateSchema, type BudgetCreate } from '@pulpe/shared';

// Backend
import { budgetCreateSchema } from '@pulpe/shared';
export class CreateBudgetDto extends createZodDto(budgetCreateSchema) {}
```

## Key Patterns & Conventions

### Authentication Flow
1. **Frontend**: Supabase Auth SDK manages JWT tokens
2. **Backend**: AuthGuard validates tokens with `supabase.auth.getUser()`
3. **Database**: RLS policies enforce data isolation
4. **API**: Custom decorators inject authenticated user context

### Error Handling
- **Global Exception Filter**: Structured error responses
- **Correlation IDs**: Request tracking across services
- **Sensitive Data Redaction**: Automatic PII filtering in logs
- **User-Friendly Messages**: Client-appropriate error formatting

### Testing Strategy
- **Unit Tests**: Business logic with mocked dependencies
- **Integration Tests**: API endpoints with real database
- **E2E Tests**: Critical user flows with Playwright
- **Performance Tests**: Load testing for API endpoints

### Development Conventions
- **Naming**: Descriptive, purpose-driven file names
- **Architecture**: Enforce via `eslint-plugin-boundaries`
- **Git Flow**: Feature branches with PR reviews
- **Code Quality**: Automated linting, formatting, type-checking
G

### API Contracts
- **REST API**: JSON over HTTP with `/api/v1` prefix
- **Content-Type**: `application/json` for all endpoints
- **Authentication**: `Bearer {jwt_token}` in Authorization header
- **Validation**: Zod schemas enforce contract compliance

### External Services
- **Supabase Auth**: User management and JWT validation
- **Supabase Database**: PostgreSQL with RLS and real-time features
- **Vercel**: Frontend hosting with edge network
- **Railway**: Backend hosting with automatic deployments

### Real-time Features
- **Database Changes**: Supabase real-time subscriptions (future)
- **WebSocket**: Not currently implemented
- **Server-Sent Events**: Not currently implemented

## Development Guidelines

### Essential Commands
```bash
# Full stack development
pnpm dev                    # Start all services
pnpm build                  # Build all packages
pnpm test                   # Run all tests

# Quality assurance
pnpm quality:fix            # Fix all auto-fixable issues
pnpm type-check             # TypeScript validation
```

### Environment Setup
1. **Node.js**: Bun runtime required for backend
2. **Database**: Local Supabase or cloud connection
3. **Auth**: Supabase credentials in environment
4. **IDE**: VS Code with Angular/NestJS extensions

### Debugging & Monitoring
- **Frontend**: Angular DevTools + browser console
- **Backend**: Structured logs with Pino + request correlation
- **Database**: Supabase dashboard + query performance
- **API**: Swagger documentation at `/docs`

### Performance Considerations
- **Bundle Size**: Lazy loading + tree shaking
- **Database**: RLS policy optimization with proper indexes
- **Caching**: Turborepo build cache + Vercel edge cache
- **Change Detection**: OnPush strategy + signals optimization

---

*This document provides essential context for AI-driven development following BMAD methodology principles.*