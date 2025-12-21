# Backend CLAUDE.md

## Commands

```bash
bun run dev                 # Start with local Supabase + watch mode (localhost:3000)
bun test                    # Run all tests
bun run quality:fix         # Type-check + lint:fix + format
bun run generate-types      # Regenerate TypeScript types from Supabase schema
```

## Module Structure

Each domain module in `src/modules/[domain]/`:
```
├── [domain].controller.ts     # HTTP routes + validation
├── [domain].service.ts        # Business logic
├── [domain].mapper.ts         # DTO <-> DB entity transformation
├── [domain].module.ts         # NestJS module config
├── dto/                       # NestJS DTOs (createZodDto from @pulpe/shared)
└── entities/                  # Business entities
```

## Key Components

| Component | Purpose |
|-----------|---------|
| `guards/AuthGuard` | JWT validation, injects user + supabase client |
| `@User()` decorator | Extract authenticated user from request |
| `@SupabaseClient()` decorator | Extract authenticated Supabase client |

## Patterns

### Controller with Decorators
```typescript
@Controller('budgets')
@UseGuards(AuthGuard)
export class BudgetController {
  @Post()
  async create(
    @Body() dto: BudgetCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ) { ... }
}
```

### DTO from Shared
```typescript
import { budgetCreateSchema } from '@pulpe/shared';
export class BudgetCreateDto extends createZodDto(budgetCreateSchema) {}
```

### Mapper (camelCase API ↔ snake_case DB)
```typescript
toApi(dbRow: BudgetRow): Budget { ... }
toDbInsert(dto: BudgetCreate, userId: string): BudgetInsert { ... }
```

## Database

- Types auto-generated in `src/types/database.types.ts`
- RLS policies enforce user data isolation
- Always use `@SupabaseClient()` decorator (respects RLS)

## URLs

- **API**: http://localhost:3000/api
- **Swagger**: http://localhost:3000/docs

## Critical Notes

- All routes protected by AuthGuard (opt-out with @Public())
- Regenerate types after schema changes: `bun run generate-types`
- Debug: `DEBUG_HTTP_FULL=true bun run dev`
