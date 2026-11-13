---
status: pending
---

# Instruction: PIN change and recovery cover labels

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── backend-nest/
│   ├── supabase/
│   │   ├── migrations/
│   │   │   └── YYYYMMDDHHMMSS_rekey_labels.sql ✅
│   │   └── tests/
│   │       ├── README.md ✏️
│   │       └── rekey_labels_rolling_deploy.sql ✅
│   └── src/
│       ├── types/
│       │   └── database.types.ts ✏️
│       └── modules/
│           └── encryption/
│               ├── encryption.integration.spec.ts ✏️
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
└── docs/
    └── ENCRYPTION.md ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | The rekey specs and the two rolling-deploy SQL tests green on the code before this phase; fixture account with encrypted labels in the 13 columns, one orphan `source_savings_goal_name` included | Green baseline, fixture ready | system |
| Happy path | Change the PIN | Every label decrypts with the new key and none with the old; amounts behave as before; `key_check` is written last | api |
| Happy path | Recover with the recovery key | Same outcome | api |
| Edge case  | Account mixing encrypted and legacy plaintext labels | Encrypted values are re-encrypted, plaintext values are left byte for byte | api |
| Edge case  | Payload missing one row of a label table | The function raises, nothing is rewritten, the old key still validates | system |
| Edge case  | v1, v2 or v3 called for a user holding an encrypted label, as an old backend does | Raises `rekey: labels require v4`, no row rewritten | system |
| Edge case  | v3 called for a user with no encrypted label | Works as today | system |
| Edge case  | Goal with linked lines and movements | After the rekey the linked `source_savings_goal_name` equal the goal's stored name byte for byte; the goal `balance_revision` moved, by an amount the test states | system |
| Edge case  | Account with more than 1000 rows in one label table | Every row rewritten | api |
| Edge case  | A request that starts after the rekey with the old key | 400 key check failed, zero write | api |
| Edge case  | A row encrypted under the old key is written after the rekey committed, as a request that validated its key just before the PIN change does | That row reads with amount 0 and the label placeholder, every other row reads normally; the window exists for amounts today | system |
| Teardown   | `bun run supabase:reset` | Seed restored | system |

## Tasks to do

### `1)` Lock the current rekey

> Green before, green after.

1. Run `aes-gcm.crypto-service.spec.ts`, `supabase-encryption-key.repository.spec.ts`, `rpc-payload.schemas.spec.ts`, `change-pin.use-case.spec.ts`, `recover-with-recovery-key.use-case.spec.ts`, `encryption.integration.spec.ts`, `encryption.e2e.spec.ts`.
2. Run `rekey_plan_withdrawal_rolling_deploy.sql` and `rekey_asset_snapshot_rolling_deploy.sql` per `backend-nest/supabase/tests/README.md`; record the baseline.

### `2)` Add rekey v4 and close the older entry points

> No backend, old or new, can leave a label under the old key.

1. One contract migration, `-- pulpe:safe-after` the release that ships phase 4, modelled on the v3 of `20261103120000_create_net_worth_tables.sql`: `rekey_user_encrypted_data_with_labels` takes the v3 parameters plus the label rows of the nine tables.
2. It keeps the `FOR UPDATE` lock on the `user_encryption_key` row, checks a row count for every label table, writes `savings_goal` names last so the copies made by `sync_savings_goal_withdrawal_name` end equal to the goal's stored name, and writes `key_check` last.
3. v1, v2 and v3 raise `rekey: labels require v4` when the user holds at least one label carrying the marker.
4. `SECURITY DEFINER`, empty `search_path`, execute granted to `service_role` only.
5. `rekey_labels_rolling_deploy.sql` on the model of `rekey_asset_snapshot_rolling_deploy.sql`; list it in the tests README.

### `3)` Rekey labels in the backend

> The crypto service reads, re-encrypts and sends labels through v4.

1. `aes-gcm.crypto-service.ts`: `reEncryptAllUserData` reads the registry columns with the paged readers it already uses; the payload builder re-encrypts only values carrying the marker, strictly, and leaves plaintext to the conversion.
2. `#hasEncryptedUserData` and `#hasEncryptedOwnedRows` count a label carrying the marker as encrypted data.
3. `rpc-payload.schemas.ts`: strict schema for a label rekey item, with its spec.
4. `supabase-encryption-key.repository.ts`: `rekeyUserData` calls v4.
5. Extend the specs and `encryption.integration.spec.ts` with the cases of the Test Scope.

### `4)` Check the side effects

> A PIN change must not surprise a client.

1. Grep the three clients for an order or a display based on `updatedAt` of the nine entities: the rekey bumps it on every rewritten row.
2. Confirm a client holding a goal's previous `balance_revision` recovers on its next goal write, or document the limit.
3. Writes take no lock on the `user_encryption_key` row: `ensureUserDEK` checks the key once per request. A write that validated before a PIN change and lands after it stays under the old key; that row then shows amount 0 and the label placeholder. It needs a PIN change on one device and a write from another within the same request time. Closing it means every write path runs in a transaction that share-locks the key row. State the window in `docs/ENCRYPTION.md` and ADR-0020; ask Maxime before adding that lock.

### `5)` Types and documentation

> Types and the reference doc match the new function.

1. `bun run generate-types:local`, then `bun run format`.
2. `docs/ENCRYPTION.md`: the rekey section names v4 and the label columns.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | The seven specs and the two SQL tests pass on the untouched code |
| 2    | `rekey_labels_rolling_deploy.sql` passes: v1 to v3 raise for a user with an encrypted label, v4 rewrites every label or none |
| 3    | After a PIN change and after a recovery, every label of the fixture decrypts with the new key, plaintext labels are unchanged, and the existing rekey cases stay green |
| 4    | The pull request lists the client uses of `updatedAt` found and what a stale `balance_revision` does; the in-flight write window is documented and its case passes |
| 5    | `database.types.ts` exposes v4; `docs/ENCRYPTION.md` describes it |
