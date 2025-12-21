# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
bun run dev                 # Start with local Supabase + watch mode (localhost:3000)
bun run dev:local           # Watch mode only (without starting Supabase)
bun run start               # Start without watch
```

### Testing
```bash
bun test                    # Run all tests
bun test <file>             # Run single test file
bun test --watch            # Watch mode
bun run test:performance    # Performance tests with metrics
```

### Quality
```bash
bun run quality             # Type-check + lint + format check
bun run quality:fix         # Type-check + lint:fix + format
bun run lint                # ESLint only
bun run type-check:full     # Full TypeScript check
```

### Database (Supabase)
```bash
bun run generate-types      # Regenerate TypeScript types from Supabase schema
bun run supabase:start      # Start local Supabase
bun run supabase:reset      # Reset local database
bun run supabase:diff       # Show schema changes
```

## Architecture

### Module Structure

Each domain module in `src/modules/[domain]/`:
```
├── [domain].controller.ts     # HTTP routes + validation
├── [domain].service.ts        # Business logic
├── [domain].mapper.ts         # DTO <-> DB entity transformation
├── [domain].module.ts         # NestJS module config
├── dto/                       # NestJS DTOs (createZodDto from shared schemas)
└── entities/                  # Business entities
```

### Key Components in `src/common/`

| Component | Purpose |
|-----------|---------|
| `guards/AuthGuard` | JWT validation via Supabase, injects user + supabase client |
| `decorators/@User()` | Extract authenticated user from request |
| `decorators/@SupabaseClient()` | Extract authenticated Supabase client from request |
| `filters/GlobalExceptionFilter` | Standardized error responses |
| `middleware/RequestIdMiddleware` | Correlation IDs for logging |

### Request Flow
```
Request → AuthGuard → Controller → Service → Mapper → Supabase
                          ↓
                    @User() + @SupabaseClient() decorators
```

## Patterns

### Controller Pattern
```typescript
@Controller('budgets')
@UseGuards(AuthGuard)
export class BudgetController {
  @Post()
  async create(
    @Body() dto: BudgetCreateDto,           // Auto-validated by Zod
    @User() user: AuthenticatedUser,        // From AuthGuard
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ) {
    return this.service.create(dto, user, supabase);
  }
}
```

### DTO Pattern (using @pulpe/shared)
```typescript
import { budgetCreateSchema } from '@pulpe/shared';
import { createZodDto } from 'nestjs-zod';

export class BudgetCreateDto extends createZodDto(budgetCreateSchema) {}
```

### Mapper Pattern
Mappers transform between API DTOs (camelCase) and database entities (snake_case):
```typescript
toApi(dbRow: BudgetRow): Budget { ... }
toDbInsert(dto: BudgetCreate, userId: string): BudgetInsert { ... }
```

## Database

- **Supabase types** are auto-generated in `src/types/database.types.ts`
- **RLS policies** enforce user data isolation at database level
- All queries go through authenticated Supabase client (respects RLS)

### Type Helpers
```typescript
import type { Database } from '../types/database.types';
type BudgetRow = Database['public']['Tables']['monthly_budget']['Row'];
type BudgetInsert = Database['public']['Tables']['monthly_budget']['Insert'];
```

## URLs

- **API**: http://localhost:3000/api
- **Swagger**: http://localhost:3000/docs
- **Health**: http://localhost:3000/health

## Critical Notes
- All routes protected by AuthGuard by default (opt-out with @Public())
- Never bypass RLS - always use @SupabaseClient() decorator
- Regenerate types after ANY schema change: `bun run generate-types`

## Debugging
- Full HTTP logs: `DEBUG_HTTP_FULL=true bun run dev`
- Performance debug: `DEBUG_PERFORMANCE=true bun test`
