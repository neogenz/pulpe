# CLAUDE.md - Shared

## Commands

```bash
pnpm run build              # Build (REQUIRED before frontend/backend)
pnpm run test               # Run tests
pnpm run test:watch         # Watch mode
```

## Purpose

Shared types and validation between frontend and backend:
- `schemas.ts` - Zod schemas (single source of truth)
- `src/calculators/` - Budget calculation formulas
- `src/types.ts` - TypeScript type definitions

## Zod 4 Rules

**CRITICAL:** This project uses Zod 4. Follow these rules strictly.

### Top-Level Validators (Zod 4 syntax)

```typescript
// ✅ Zod 4 - ALWAYS use top-level
z.uuid()
z.email()
z.url()
z.iso.datetime({ offset: true })
z.iso.date()

// ❌ NEVER - deprecated method chaining
z.string().uuid()
z.string().email()
z.string().datetime()
```

### Schema Patterns

```typescript
// Entity schema (read from DB)
export const budgetSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).trim(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Budget = z.infer<typeof budgetSchema>;

// Create schema (user input)
export const budgetCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});
export type BudgetCreate = z.infer<typeof budgetCreateSchema>;

// Update schema (partial)
export const budgetUpdateSchema = budgetCreateSchema.partial();
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;
```

### Response Wrappers

```typescript
export const budgetResponseSchema = z.object({
  success: z.literal(true),
  data: budgetSchema,
});
```

## Adding Schemas

1. Define Zod schema with JSDoc explaining business rules
2. Export inferred type: `export type X = z.infer<typeof xSchema>`
3. Run `pnpm build` to regenerate types

## Critical Rules

- **ALWAYS** build shared before frontend/backend changes
- **ALWAYS** use Zod 4 top-level validators (`z.uuid()`, not `z.string().uuid()`)
- **ALWAYS** add JSDoc comments for business rules
- **NEVER** import from frontend or backend (shared is dependency-free)
