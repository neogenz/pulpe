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

Every request gets its own Supabase client with the user's JWT — RLS enforces data isolation automatically.

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

- `@SupabaseClient()` decorator injects the authenticated client in controllers
- `AuthGuard` extracts JWT from `Authorization: Bearer` header
- Service role client (`getServiceRoleClient()`) bypasses RLS — use with caution

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

**Always regenerate types after ANY migration.** Stale types cause silent bugs.

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

- **Always** wrap `auth.uid()` in a subselect: `(SELECT auth.uid())` — caches per statement (94%+ perf gain)
- **Always** index policy columns: `CREATE INDEX ON table(user_id);`
- **Always** add explicit `.eq('user_id', userId)` in queries even though RLS enforces it — helps optimizer
- **Always** specify `TO authenticated` in policy definitions

### Anti-Patterns

- NEVER use `supabase db reset` or `supabase db push --force` on production or linked projet
- NEVER modify existing migrations — always create new ones
- NEVER expose service role key in frontend or client code
- NEVER create tables without enabling RLS and adding policies immediately
- NEVER use views without `security_invoker = true` (they bypass RLS)

## Migrations

```bash
supabase migration new add_feature_table   # Create migration file
supabase db reset                          # LOCAL ONLY — applies all migrations + seed
```

### Migration Checklist

0. Must be done from backend-nest/ directory
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

For atomic operations that cross RLS boundaries:

```sql
CREATE OR REPLACE FUNCTION create_budget_with_transactions(...)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$ ... $$;
```

Call from NestJS: `await supabase.rpc('function_name', { ...params })`
