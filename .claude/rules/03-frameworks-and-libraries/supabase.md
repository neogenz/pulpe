---
description: Supabase integration patterns — RLS, Auth, type safety, migrations
paths:
  - "backend-nest/**/*.ts"
  - "backend-nest/supabase/**/*.sql"
---

# Supabase Patterns

## Stack

- `@supabase/supabase-js` v2.50+
- PostgreSQL with Row-Level Security (RLS)
- Supabase Auth (JWT verification)
- Types auto-generated in `src/types/database.types.ts`

## Authenticated Client

`AuthGuard` validates the bearer token and stores the authenticated client in CLS.
Repositories inject `AuthenticatedSupabaseProvider` and read `.client`; use cases do not receive
or inject Supabase clients. `@SupabaseClient()` remains only in legacy controller paths.

The service-role client bypasses RLS. Keep it limited to explicit administrative infrastructure
such as encryption-key management and account deletion; never use it for ordinary user data.

## Type Safety

### Generated Types

```typescript
import type { Database } from '../../types/database.types';

// Helper types from supabase-helpers.ts
type BudgetRow = Database['public']['Tables']['monthly_budget']['Row'];
type BudgetInsert = Database['public']['Tables']['monthly_budget']['Insert'];
```

### After Schema Changes

```bash
bun run generate-types:local   # Regenerate types from local Supabase
```

**Always regenerate types after ANY migration.** Stale types = silent bugs.

## RLS Policies

### Pattern: User Isolation

```sql
-- SELECT: user sees only their data
CREATE POLICY "users_select_own" ON "public"."monthly_budget"
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- INSERT: user creates only for themselves
CREATE POLICY "users_insert_own" ON "public"."monthly_budget"
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE: both USING and WITH CHECK required
CREATE POLICY "users_update_own" ON "public"."monthly_budget"
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE: user deletes only their data
CREATE POLICY "users_delete_own" ON "public"."monthly_budget"
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
```

### Pattern: Parent-Based Access (template_line)

```sql
CREATE POLICY "users_select_template_line" ON "public"."template_line"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "public"."template"
      WHERE template.id = template_line.template_id
      AND (SELECT auth.uid()) = template.user_id
    )
  );
```

### Performance Rules

- **Always** wrap `auth.uid()` in subselect: `(SELECT auth.uid())` — cache per statement (94%+ perf gain)
- **Always** index policy columns: `CREATE INDEX ON table(user_id);`
- **Always** add explicit `.eq('user_id', userId)` in queries even if RLS enforce — help optimizer
- **Always** specify `TO authenticated` in policy definitions

### Anti-Patterns

- NEVER use a destructive reset or forced push on a linked project
- For local reset, use only `bun run supabase:reset`; bare `supabase db reset` leaves the seed amounts unencrypted
- NEVER modify existing migrations — always create new ones
- NEVER expose service role key in frontend or client code
- NEVER create tables without enabling RLS and adding policies immediately
- NEVER use views without `security_invoker = true` (bypass RLS)

## Migrations

```bash
# Both from backend-nest/ — the Supabase project and the scripts live there, not at the root.
supabase migration new add_feature_table   # Create migration file
bun run supabase:reset                     # LOCAL ONLY — reset + re-encrypt the seed amounts
```

### Migration Checklist

0. Must run from backend-nest/ directory
1. Create table with constraints
2. Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
3. Create policies for SELECT, INSERT, UPDATE, DELETE
4. Add indexes on policy columns (`user_id`, foreign keys)
5. Add foreign keys with `ON DELETE CASCADE` where appropriate
6. Test locally with `bun run supabase:reset` (never bare `supabase db reset` — it leaves a plaintext seed, every amount reads 0)
7. Regenerate types: `bun run generate-types:local`

## Database Schema

`backend-nest/src/types/database.types.ts` is the canonical table and RPC inventory. Read
`backend-nest/docs/DATABASE.md` for access patterns and privileged repository exceptions; do not
copy table lists into rules.

## SECURITY DEFINER Functions

Prefer invoker rights plus RLS. When an atomic operation requires a privileged boundary, use
`SECURITY DEFINER` with explicit authorization checks, an empty `search_path`, schema-qualified
objects, and least-privilege grants. Follow ADR-0013 and a current hardened migration such as
`backend-nest/supabase/migrations/20260808170000_harden_savings_goal_plan_concurrency_and_rekey.sql`;
do not copy privileged function bodies from prose examples.

Call from NestJS: `await supabase.rpc('function_name', { ...params })`

## RPC JSONB Parameters — Zod Required

Supabase generate `Args` type of every RPC with `Json` (opaque, ≈ `any`) for JSONB params. Compiler can't catch key typo — and `jsonb_to_recordset` silently map unknown keys to NULL, corrupts encrypted columns without raising.

**Rule:** any RPC with JSONB param containing ciphertexts MUST have strict Zod schema validating shape before `supabase.rpc(...)`.

- Schema location: `backend-nest/src/modules/<module>/infrastructure/persistence/schemas/rpc-payload.schemas.ts`
- Each object schema MUST use `.strict()` to reject extra keys
- Wrap `ZodError` in `BusinessException` with `{ cause }` so no leak to client as generic 500
- Add companion `.spec.ts` covering: valid payload, null ciphertext if column nullable, `.strict()` reject extras, UUID validation

RPCs with only scalar params (`uuid`, `text`, `int`, `boolean`) are covered by generated
TypeScript types and do not need a duplicate Zod schema.
