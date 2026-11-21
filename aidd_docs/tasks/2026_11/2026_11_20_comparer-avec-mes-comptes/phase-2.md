---
status: pending
---

# Instruction: Backend: encrypted `user_reconciliation` table

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── backend-nest/
│   ├── supabase/
│   │   ├── migrations/
│   │   │   └── 20261121120000_create_user_reconciliation.sql ✅
│   │   └── tests/
│   │       ├── user_reconciliation_rls.sql ✅
│   │       └── rekey_user_reconciliation_rolling_deploy.sql ✅
│   └── src/
│       ├── types/
│       │   └── database.types.ts ✏️
│       └── modules/encryption/infrastructure/
│           ├── crypto/
│           │   ├── aes-gcm.crypto-service.ts ✏️
│           │   └── aes-gcm.crypto-service.spec.ts ✏️
│           └── persistence/
│               ├── supabase-encryption-key.repository.ts ✏️
│               └── schemas/
│                   └── rpc-payload.schemas.ts ✏️
├── docs/
│   └── ENCRYPTION.md ✏️
└── .claude/rules/05-workflows-and-processes/
    └── encryption-backend.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `cd backend-nest && bun run supabase:reset` from the main checkout's Supabase, then apply the migration | Table `user_reconciliation` exists with RLS on | cli |
| Happy path | Run `supabase/tests/user_reconciliation_rls.sql` | A user reads and writes only their own row; `anon` reads nothing | cli |
| Happy path | Run the rekey test: change the PIN of a user with a stored starting amount | `starting_amount` is re-encrypted with the new key and decrypts to the same number | cli |
| Edge case | Rekey for a user with no row, and during a rolling deploy where the old RPC version is called | Rekey succeeds; v1, v2 and v3 refuse with « requires v4 » for a person holding a starting amount and still work for a person without one, as in `rekey_asset_snapshot_rolling_deploy.sql` | cli |
| Edge case | Delete the auth user | The row goes with it (cascade) | cli |
| Teardown | `bun run supabase:reset` | Local base back to the seed | cli |

## Tasks to do

### `1)` Create the table

> One row per person holding the starting amount (ciphertext) and the time of the last completed comparison.

1. Migration `-- pulpe:migration-phase contract` with `-- pulpe:safe-after` set to the latest released tag, following `20261103120000_create_net_worth_tables.sql`.
2. Columns: `user_id uuid primary key references auth.users on delete cascade`, `starting_amount text null`, `last_completed_at timestamptz null`, `updated_at timestamptz not null default now()`.
3. RLS select, insert, update on `auth.uid() = user_id`; REVOKE then GRANT like `user_locale_preference`.
4. RLS test file modelled on `user_locale_preference_rls.sql`.

### `2)` Re-encrypt it on PIN change and recovery

> A PIN change never leaves a starting amount unreadable.

1. New rekey RPC version (v4) that also rewrites `user_reconciliation.starting_amount`, copied from the net worth rekey (`20261103120000_create_net_worth_tables.sql:132-238`), in the same migration.
2. Re-create v1, v2 and v3 fail-closed: each refuses when the person owns a `user_reconciliation` row with a starting amount, like `20261103120000_create_net_worth_tables.sql:245-380`, so an old server never leaves that amount under the old key.
3. Wire the column in `aes-gcm.crypto-service.ts` (owned-rows check, fetch, payload), `rpc-payload.schemas.ts` and `supabase-encryption-key.repository.ts`; extend `aes-gcm.crypto-service.spec.ts`.
4. Rolling-deploy rekey test like `rekey_asset_snapshot_rolling_deploy.sql`, old versions included.

### `3)` Types and docs

> The new column is typed and listed where encrypted columns are listed.

1. `bun run generate-types:local`, then `bun run format`.
2. Add the column to the tables of `docs/ENCRYPTION.md` and `encryption-backend.md`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | The RLS SQL suite passes in CI; `pnpm test:migration-contract` (`.github/scripts/check-migration-contract.cjs`) accepts the header |
| 2 | The rekey SQL tests and `bun test aes-gcm.crypto-service.spec.ts` pass; a PIN change keeps the starting amount readable; v1 to v3 refuse for a person holding one |
| 3 | CI `database.types.ts` drift check passes; both docs list `user_reconciliation.starting_amount` |
