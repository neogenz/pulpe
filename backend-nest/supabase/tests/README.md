# SQL Integration Tests

Plain `.sql` files that exercise PostgreSQL functions end-to-end against a real local Supabase instance. Each script wraps its setup in `BEGIN; ... ROLLBACK;` so DB state is unaffected.

These complement the Bun unit tests (which mock Supabase). The unit tests cover the TypeScript layer; these cover the SQL layer.

## Run

```bash
# from backend-nest/
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

psql "$DB" -f supabase/tests/apply_template_line_operations_atomicity.sql
psql "$DB" -f supabase/tests/apply_template_line_operations_failure_rollback.sql
psql "$DB" -f supabase/tests/create_budget_from_template_owner_only.sql
```

Each script prints `NOTICE:  ALL ASSERTIONS PASSED` on success, or raises an exception on failure.

## What each test covers

| File | Function under test | Coverage |
|------|---------------------|----------|
| `apply_template_line_operations_atomicity.sql` | `apply_template_line_operations` | partial-patch UPDATE preserves untouched fields, INSERT with caller-supplied id, DELETE, budget propagation (UPDATE/INSERT/DELETE), return value |
| `apply_template_line_operations_failure_rollback.sql` | `apply_template_line_operations` | invalid enum cast raises, no template_line writes leak (atomicity guarantee) |
| `create_budget_from_template_owner_only.sql` | `create_budget_from_template` | owner can create budget from own template, other user's template is rejected (Bug #2 fix) |

## Why SQL files (not Bun specs)

The tests need real Postgres semantics: `auth.uid()` resolution, JSONB operators, enum casts, transaction rollback. Mocking these in JS would just re-test the mock. Plain SQL against a live database is the simplest way to prove the function actually works.
