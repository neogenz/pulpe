---
description: Supabase integration patterns — RLS, Auth, type safety, migrations
paths: "backend-nest/**/*.ts"
---

# Supabase Patterns

## Stack

- `@supabase/supabase-js` v2.50+
- PostgreSQL with Row-Level Security (RLS)
- Supabase Auth (JWT verification)
- Types auto-generated in `src/types/database.types.ts`

## Authenticated Client

Each request get own Supabase client with user JWT — RLS enforce data isolation auto.

```typescript
@Injectable()
export class SupabaseService {
  createAuthenticatedClient(accessToken: string): AuthenticatedSupabaseClient {
    return createClient<Database>(this.supabaseUrl, this.supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });
  }
}
```

- `@SupabaseClient()` decorator inject authenticated client in controllers
- `AuthGuard` extract JWT from `Authorization: Bearer` header
- Service role client (`getServiceRoleClient()`) bypass RLS — use with caution

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
      AND ((SELECT auth.uid()) = template.user_id OR template.user_id IS NULL)
    )
  );
```

### Performance Rules

- **Always** wrap `auth.uid()` in subselect: `(SELECT auth.uid())` — cache per statement (94%+ perf gain)
- **Always** index policy columns: `CREATE INDEX ON table(user_id);`
- **Always** add explicit `.eq('user_id', userId)` in queries even if RLS enforce — help optimizer
- **Always** specify `TO authenticated` in policy definitions

### Anti-Patterns

- NEVER use `supabase db reset` or `supabase db push --force` on production or linked project
- NEVER modify existing migrations — always create new ones
- NEVER expose service role key in frontend or client code
- NEVER create tables without enabling RLS and adding policies immediately
- NEVER use views without `security_invoker = true` (bypass RLS)

## Migrations

```bash
supabase migration new add_feature_table   # Create migration file
supabase db reset                          # LOCAL ONLY — applies all migrations + seed
```

### Migration Checklist

0. Must run from backend-nest/ directory
1. Create table with constraints
2. Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
3. Create policies for SELECT, INSERT, UPDATE, DELETE
4. Add indexes on policy columns (`user_id`, foreign keys)
5. Add foreign keys with `ON DELETE CASCADE` where appropriate
6. Test locally with `supabase db reset`
7. Regenerate types: `bun run generate-types:local`

## Database Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `auth.users` | Managed by Supabase Auth | N/A |
| `monthly_budget` | User budgets by month/year | user_id isolation |
| `transaction` | Financial transactions | user_id isolation |
| `template` | Budget templates (public + private) | user_id OR NULL (public) |
| `template_line` | Template items | parent template access |
| `user_encryption_key` | Encryption salt + wrapped DEK | service_role only |

## SECURITY DEFINER Functions

For atomic ops crossing RLS boundaries:

```sql
CREATE OR REPLACE FUNCTION create_budget_with_transactions(...)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$ ... $$;
```

Call from NestJS: `await supabase.rpc('function_name', { ...params })`

## RPC JSONB Parameters — Zod Required

Supabase generate `Args` type of every RPC with `Json` (opaque, ≈ `any`) for JSONB params. Compiler can't catch key typo — and `jsonb_to_recordset` silently map unknown keys to NULL, corrupts encrypted columns without raising.

**Rule:** any RPC with JSONB param containing ciphertexts MUST have strict Zod schema validating shape before `supabase.rpc(...)`.

- Schema location: `backend-nest/src/modules/<module>/schemas/rpc-payload.schemas.ts`
- Each object schema MUST use `.strict()` to reject extra keys
- Wrap `ZodError` in `BusinessException` with `{ cause }` so no leak to client as generic 500
- Add companion `.spec.ts` covering: valid payload, null ciphertext if column nullable, `.strict()` reject extras, UUID validation

RPC with only scalar params (`uuid`, `text`, `int`, `boolean`) covered by generated TS types — no Zod needed.

Current implementations:
- `budget-template/schemas/rpc-payload.schemas.ts` — `create_template_with_lines`, `apply_template_line_operations`
- `encryption/schemas/rpc-payload.schemas.ts` — `rekey_user_encrypted_data`