# CLAUDE.md - Backend (NestJS)

This file provides guidance to Claude Code (claude.ai/code) for the backend API.

## Commands

```bash
bun run dev                    # Start with local Supabase (port 3000)
bun run build                  # Production build
bun test                       # Run all tests
bun test path/to/file.test.ts  # Single test file
bun run quality                # Type-check + Lint + Format
bun run generate-types:local   # Generate types from local Supabase
```

**BEFORE committing**: Run `bun run quality`
**AFTER schema changes**: Run `bun run generate-types:local`

## Module Structure

```
src/modules/[domain]/
├── [domain].controller.ts    # HTTP routes, validation, Swagger docs
├── [domain].service.ts       # Business logic, orchestration
├── [domain].module.ts        # Module configuration, DI setup
├── [domain].mapper.ts        # DTO ↔ Entity transformation
├── dto/                      # Request/Response DTOs with Zod
└── entities/                 # Business entities
```

## Architecture

### Authentication Flow

- **JWT Bearer tokens** validated via Supabase Auth
- **AuthGuard** protects all routes by default
- **@User() decorator** injects authenticated user
- **@SupabaseClient() decorator** provides authenticated DB client
- **Row Level Security (RLS)** enforces data isolation

### Data Pipeline

```
Frontend (Zod) → Backend DTO (createZodDto) → Service → Database (RLS)
DB Row (snake_case) → Mapper → API Response (camelCase)
```

- Shared schemas from `pulpe-shared`
- Runtime validation with Zod
- TypeScript strict mode

### Error Handling

- Global exception filter for consistent responses
- Structured logging with Pino
- Request ID tracking for debugging

## Database

| Feature | Implementation |
|---------|----------------|
| Auth | Supabase Auth with JWT |
| Database | PostgreSQL with RLS |
| Types | Auto-generated from schema |
| Isolation | `auth.uid()` in RLS policies |

### Key Tables

- `monthly_budget` - User budgets by month/year
- `transaction` - Financial transactions
- `template` - Budget templates (public + private)
- `template_line` - Template transaction items

### Working with Types

```typescript
import type { Database } from '../../types/database.types';
type BudgetRow = Database['public']['Tables']['monthly_budget']['Row'];
```

## Logging

- **Development**: Pretty-printed with `pino-pretty`
- **Production**: JSON structured logs
- **Correlation**: Request IDs propagated automatically

| Level | Use Case |
|-------|----------|
| `error` | Server errors (5xx), critical exceptions |
| `warn` | Client errors (4xx), abnormal situations |
| `info` | Business operations, audit, metrics |
| `debug` | Technical details (dev only) |

## Testing

- Mock Supabase client with `createMockSupabaseClient()`
- Test services and guards independently
- Performance tests: `bun test:performance` with `DEBUG_PERFORMANCE=true`

## Debugging

- Enable debug logging: `DEBUG_HTTP_FULL=true`
- Swagger docs: `http://localhost:3000/docs`

## Key Files

| Purpose | Path |
|---------|------|
| App module | `src/app.module.ts` |
| Environment | `src/config/environment.ts` |
| Database types | `src/types/database.types.ts` |

## Critical Rules

- **NEVER** use `any` types
- **ALWAYS** use Zod for external data validation
- **ALWAYS** use mappers for DTO ↔ Entity transformation
- **NEVER** expose database types in API responses
- **NEVER** log sensitive data
- **BEFORE** schema changes: Plan RLS policies
- **AFTER** schema changes: Regenerate types
