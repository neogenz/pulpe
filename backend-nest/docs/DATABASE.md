# Database

Pulpe uses Supabase PostgreSQL without an ORM. The checked-in contract is
`src/types/database.types.ts`; migrations under `supabase/migrations/` own schema history.

## Current tables

- `monthly_budget`, `budget_line`, `transaction`;
- `template`, `template_line`;
- `savings_goal`, `savings_goal_plan_withdrawal`;
- `tag`, `budget_line_tag`, `transaction_tag`, `template_line_tag`;
- `user_encryption_key`.

Do not maintain column copies in documentation. Read the generated types or the migration
that introduced the field.

## Access and invariants

- RLS isolates user-owned rows. Parent-owned tables such as join tables use relational
  ownership checks.
- Multi-row writes and invariants use PostgreSQL functions when they must be atomic. See
  [ADR-0013](../../docs/adr/0013-postgresql-rpcs-for-atomic-writes.md).
- HTTP wire schemas live in `pulpe-shared`; persistence-only RPC payload schemas stay next
  to their repositories.
- User-data repositories use the authenticated Supabase provider from CLS by default.
  Encryption-key and account-deletion infrastructure use the service-role client for explicit
  privileged operations; the user repository uses both where its contract requires it. See
  [ADR-0014](../../docs/adr/0014-service-role-encryption-key-boundary.md).

Templates are user-owned. Historical migrations mention public templates, but current
application reads and budget-generation RPCs require the requesting owner because ciphertext
cannot be copied across user DEKs.

## Encrypted values

Financial columns such as `amount`, `target_amount`, and `ending_balance` are `text` columns
containing AES-256-GCM ciphertext. Repositories cross `ENCRYPTION_PORT` before every write and
return decrypted domain entities. See [ENCRYPTION.md](../../docs/ENCRYPTION.md).

## Local workflow

Run Supabase from this directory, never from the workspace root:

```bash
cd backend-nest
supabase start
supabase status
supabase migration new descriptive_name
```

After applying a schema change locally:

```bash
bun run generate-types:local
git diff -- src/types/database.types.ts
```

Never use a destructive reset or a forced push on a linked database. Production migrations
are applied by the gated workflow documented in [DEPLOYMENT.md](../../docs/DEPLOYMENT.md).

## Verification

- `bun run test:integration` exercises repositories and RLS against local Supabase.
- `bun run quality` checks types, lint, dependency boundaries, and formatting.
- Migration policy and CI gates live in [CI.md](../../docs/CI.md).
