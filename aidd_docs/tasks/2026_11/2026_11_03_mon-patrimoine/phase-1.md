---
status: pending
---

# Instruction: Asset tables and rekey safety net

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── backend-nest/
│   ├── supabase/
│   │   ├── migrations/
│   │   │   └── 20261103120000_create_net_worth_tables.sql ✅
│   │   └── tests/
│   │       ├── README.md ✏️
│   │       └── rekey_asset_snapshot_rolling_deploy.sql ✅
│   └── src/
│       ├── types/
│       │   └── database.types.ts ✏️
│       └── modules/
│           ├── account-deletion/
│           │   └── application/
│           │       └── cleanup-expired-deletions.use-case.ts ✏️
│           └── encryption/
│               └── infrastructure/
│                   ├── crypto/
│                   │   ├── aes-gcm.crypto-service.ts ✏️
│                   │   └── aes-gcm.crypto-service.spec.ts ✏️
│                   └── persistence/
│                       ├── schemas/
│                       │   ├── rpc-payload.schemas.ts ✏️
│                       │   └── rpc-payload.schemas.spec.ts ✏️
│                       ├── supabase-encryption-key.repository.ts ✏️
│                       └── supabase-encryption-key.repository.spec.ts ✏️
├── docs/
│   └── ENCRYPTION.md ✏️
└── .claude/
    └── rules/
        └── 05-workflows-and-processes/
            └── encryption-backend.md ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | `bun run supabase:reset` from the main repo, then `bun run generate-types:local` and `bun run format` | Local DB has `asset_category`, `asset`, `asset_snapshot`; types compile | system |
| Happy path | PIN change for a user holding budget lines, plan withdrawals and asset snapshots | Every `asset_snapshot.value` decrypts with the new key; `key_check` written last | api |
| Happy path | Run the existing rekey specs and `rekey_plan_withdrawal_rolling_deploy.sql` before touching the rekey | All green on the current code, then still green after the change | system |
| Edge case  | Old backend calls `rekey_user_encrypted_data_with_plan_withdrawals` for a user with one asset snapshot | RPC raises, no row rewritten, old key still valid | system |
| Edge case  | v3 receives a payload missing one of the user's snapshots | Row-count assertion raises, transaction rolled back | system |
| Edge case  | User A reads or writes user B's `asset`, `asset_category` or `asset_snapshot` through PostgREST | RLS returns zero rows or refuses the write | system |
| Edge case  | Delete a category that still holds an asset | FK `RESTRICT` error | system |
| Edge case  | Insert an asset pointing at another user's category id | Composite FK error | system |
| Edge case  | Delete the user | The three tables are emptied by cascade | system |
| Teardown   | `bun run supabase:reset` | Seed restored | system |

## Tasks to do

### `1)` Lock the current rekey

> Prove today's rekey is green before changing it.

1. Run `aes-gcm.crypto-service.spec.ts`, `supabase-encryption-key.repository.spec.ts`, `rpc-payload.schemas.spec.ts`, `change-pin.use-case.spec.ts`, `recover-with-recovery-key.use-case.spec.ts`.
2. Run the SQL tests per `backend-nest/supabase/tests/README.md`; record the green baseline.

### `2)` Create the three tables

> Store categories, assets and encrypted dated snapshots under RLS.

1. One contract migration, `-- pulpe:migration-phase contract` and `-- pulpe:safe-after v0.59.0`, modelled on `20260702120000_create_tag_table.sql` and `20261012130000_transaction_import_fingerprint_ledger.sql`.
2. `asset_category`: `id`, `user_id` FK `auth.users` cascade, `name`, timestamps, unique `(user_id, lower(normalize(name, NFC)))`.
3. `asset`: `id`, `user_id`, `category_id` FK `RESTRICT`, `name`, `currency` check `CHF|EUR`, `direction` check `own|owe`, `in_pulpe` boolean default false, `archived_at` nullable, timestamps.
4. `asset_snapshot`: `id`, `user_id`, `asset_id` FK cascade, `value text not null`, `recorded_at timestamptz default now()`, index `(asset_id, recorded_at desc)`.
5. Tenant integrity by composite FK, no trigger: unique `(id, user_id)` on `asset_category` and `asset`; `asset (category_id, user_id)` and `asset_snapshot (asset_id, user_id)` reference them.
6. `update_updated_at_column` triggers, RLS with the four `TO authenticated` policies on `(SELECT auth.uid()) = user_id`, grants.

### `3)` Add the rekey v3 and close the old entry points

> PIN change and recovery re-encrypt asset snapshots, and no older backend can skip them.

1. In the same migration, `rekey_user_encrypted_data_with_asset_snapshots` takes the v2 parameters plus `p_asset_snapshots jsonb`, locks `asset_snapshot`, rewrites each row, asserts the row count, and writes `key_check` last, as in `20260808170000_harden_savings_goal_plan_concurrency_and_rekey.sql`.
2. Redefine the v1 and v2 entry points to raise `rekey: asset snapshot requires v3` when the user has a snapshot.
3. REVOKE from `public`, `anon`, `authenticated`; GRANT EXECUTE to `service_role`.
4. Write `rekey_asset_snapshot_rolling_deploy.sql` on the model of `rekey_plan_withdrawal_rolling_deploy.sql`; list it in the tests README.

### `4)` Rekey asset snapshots in the backend

> The crypto service reads, re-encrypts and sends snapshots through v3.

1. `aes-gcm.crypto-service.ts`: add `asset_snapshot` to `#hasEncryptedOwnedRows` and to the rekey readers and payload builder.
2. `rpc-payload.schemas.ts`: strict schema for an asset snapshot rekey item; spec for it.
3. `supabase-encryption-key.repository.ts`: `rekeyUserData` calls the v3 RPC with `p_asset_snapshots`.
4. Extend the specs with a user holding snapshots.

### `5)` Regenerate types and document

> Types and docs match the new schema.

1. `bun run generate-types:local`, then `bun run format`.
2. `docs/ENCRYPTION.md` rekey section and the encrypted-columns table of `encryption-backend.md` list `asset_snapshot.value` and the v3 RPC.
3. Add the three tables to the JSDoc table list of `cleanup-expired-deletions.use-case.ts`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | The five rekey specs and the SQL tests pass on the untouched code |
| 2    | A user can insert and read only their own rows; a cross-user category or asset id is refused; deleting a non-empty category fails; deleting the user empties the three tables |
| 3    | `rekey_asset_snapshot_rolling_deploy.sql` passes: v1 and v2 raise for a user with a snapshot, v3 rewrites every snapshot or none |
| 4    | After a PIN change in the specs, every snapshot decrypts with the new key and the existing rekey cases stay green |
| 5    | `database.types.ts` exposes the three tables; `pnpm quality` passes from the root |
