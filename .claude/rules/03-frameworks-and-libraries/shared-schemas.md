---
description: Shared Zod schemas — single source of truth for API contracts
paths:
  - "shared/**/*.ts"
  - "backend-nest/**/dto/**/*.ts"
  - "frontend/**/api/**/*.ts"
---

# Shared Schemas (pulpe-shared)

## Purpose

`shared/` is the single source of truth for API contracts between frontend and backend. All validation schemas and their inferred TypeScript types live here.

## Stack

- **Zod 4** (`^4.1.13`) — uses top-level validators
- **ESM** with `moduleResolution: "NodeNext"`
- Published as `pulpe-shared` workspace package

## Zod 4 Syntax (CRITICAL)

```typescript
// ALWAYS: Zod 4 top-level validators
z.uuid()
z.email()
z.url()
z.iso.datetime({ offset: true })
z.iso.date()

// NEVER: deprecated method chaining
z.string().uuid()    // Zod 3 — DO NOT USE
z.string().email()   // Zod 3 — DO NOT USE
```

## Schema Naming

```typescript
// Entity schema (DB read)
export const budgetSchema = z.object({ ... });
export type Budget = z.infer<typeof budgetSchema>;

// Create schema (user input)
export const budgetCreateSchema = z.object({ ... });
export type BudgetCreate = z.infer<typeof budgetCreateSchema>;

// Update schema (partial)
export const budgetUpdateSchema = budgetCreateSchema.partial();
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;

// Response wrapper
export const budgetResponseSchema = z.object({
  success: z.literal(true),
  data: budgetSchema,
});
```

## Numeric Types from Supabase

Supabase returns `numeric` columns as strings. Use `z.coerce.number()`:

```typescript
// Supabase numeric(12,2) comes as string "1234.56"
amount: z.coerce.number()
target_amount: z.coerce.number()
ending_balance: z.coerce.number()
```

## ESM Import Rule

```typescript
// CORRECT — .js extension required for ESM
import { BudgetFormulas } from './budget-formulas.js';

// WRONG — causes ERR_MODULE_NOT_FOUND in production
import { BudgetFormulas } from './budget-formulas';
```

## Backend Usage (createZodDto)

```typescript
import { createZodDto } from 'nestjs-zod';
import { budgetCreateSchema } from 'pulpe-shared';

export class BudgetCreateDto extends createZodDto(budgetCreateSchema) {}

// In controller — auto-validated by ZodValidationPipe
@Post()
async create(@Body() dto: BudgetCreateDto) { ... }
```

## Frontend Usage (ApiClient)

```typescript
import { budgetSchema, type Budget } from 'pulpe-shared';

// ApiClient validates responses with Zod schema
this.apiClient.get<Budget>('/budgets/123', budgetSchema);
```

## Build Order

```bash
pnpm build:shared    # MUST run before frontend or backend
```

Turborepo handles this automatically with `pnpm dev` or `pnpm build`.

## Rules

- **Always** use Zod 4 top-level validators (`z.uuid()`, not `z.string().uuid()`)
- **Always** infer types with `z.infer<>` — never write manual TypeScript interfaces
- **Always** use `z.coerce.number()` for Supabase numeric columns
- **Always** use `.js` extension in imports (ESM requirement)
- **Always** build shared before other packages after schema changes
- **Always** add JSDoc comments for business rules on schemas
- **Never** import from frontend or backend (shared is dependency-free)
- **Never** create duplicate type definitions — schema IS the type
