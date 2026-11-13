---
status: pending
---

# Instruction: Encrypted writes and account conversion

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── backend-nest/
│   ├── .env.example ✏️
│   ├── scripts/
│   │   └── label-snapshot.ts ✅
│   ├── supabase/
│   │   ├── migrations/
│   │   │   ├── YYYYMMDDHHMMSS_convert_user_labels.sql ✅
│   │   │   └── YYYYMMDDHHMMSS_release_label_constraints.sql ✅
│   │   └── tests/
│   │       ├── README.md ✏️
│   │       └── convert_user_labels.sql ✅
│   └── src/
│       ├── config/
│       │   ├── environment.ts ✏️
│       │   └── environment.spec.ts ✏️
│       ├── test/
│       │   └── label-journey.ts ✏️
│       ├── types/
│       │   └── database.types.ts ✏️
│       ├── common/
│       │   └── utils/
│       │       └── tag-links.util.ts ✏️
│       └── modules/
│           ├── encryption/
│           │   ├── label-encryption-gates.integration.spec.ts ✅
│           │   ├── application/
│           │   │   ├── convert-user-labels.use-case.ts ✅
│           │   │   └── convert-user-labels.use-case.spec.ts ✅
│           │   ├── domain/
│           │   │   └── ports/
│           │   │       └── encryption.port.ts ✏️
│           │   └── infrastructure/
│           │       ├── crypto/
│           │       │   ├── aes-gcm.crypto-service.ts ✏️
│           │       │   └── aes-gcm.crypto-service.spec.ts ✏️
│           │       ├── persistence/
│           │       │   ├── schemas/
│           │       │   │   ├── rpc-payload.schemas.ts ✏️
│           │       │   │   └── rpc-payload.schemas.spec.ts ✏️
│           │       │   └── supabase-encryption-key.repository.ts ✏️
│           │       └── scheduler/
│           │           └── label-encryption-status.cron.ts ✅
│           ├── transaction/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-transaction.repository.ts ✏️
│           ├── budget-line/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-budget-line.repository.ts ✏️
│           ├── budget/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-budget.repository.ts ✏️
│           ├── budget-template/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-budget-template.repository.ts ✏️
│           ├── savings-goal/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-savings-goal.repository.ts ✏️
│           ├── tag/
│           │   ├── domain/
│           │   │   └── tag.entity.ts ✏️
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-tag.repository.ts ✏️
│           ├── asset/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-asset.repository.ts ✏️
│           ├── transaction-import/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-transaction-import.repository.ts ✏️
│           └── demo/
│               └── infrastructure/
│                   └── persistence/
│                       └── supabase-demo.repository.ts ✏️
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
| Setup      | Local Supabase up; a plaintext account built by the journey with the switch off, its decoded content saved; switch then set to `listed` with that account | An account with plaintext in the 13 columns and a reference snapshot | api |
| Happy path | Send one request with the valid key, wait for the background conversion | No label of the account is left without the marker; the decoded content equals the snapshot; one structured log line with counts and no content | api |
| Happy path | Run the journey with the switch on | Every written label carries the marker and decrypts to what was sent; no response contains the marker | api |
| Happy path | Canary token: one unique string used in every label of the journey | Switch on: absent from a dump of the database and from the captured server logs. Switch off: present in the dump, which proves the dump check can go red. The log check is proven red by a deliberate log line: the sanitizer already redacts `name`, `description`, `label`, `title` and `q` | system |
| Edge case  | Request with a stale key for an account under the switch | 400 from phase 1, no conversion, zero write | api |
| Edge case  | A write changes a row while the conversion is in flight | The conversion rolls back as a whole and the next request retries it | system |
| Edge case  | Two devices trigger the conversion together | One converts, the other finds nothing to do | system |
| Edge case  | Plaintext reappears in a converted account, as an old backend writes during a deploy | The next validated request converts the remainder | api |
| Edge case  | A conversion computed before a PIN change reaches the database after it | Under the row lock the function compares the `key_check` it was given with the stored one, raises and writes nothing; the next validated request converts under the new key | system |
| Edge case  | Switch turned back to `off` after a conversion | New writes are plaintext, older values stay encrypted, every read works | api |
| Edge case  | The plan apply or the budget generation is called without its text | Raises: SQL can no longer write a label | system |
| Edge case  | Goal with linked lines and movements, created and renamed under the switch | Each `source_savings_goal_name` equals the goal's stored value byte for byte and decodes to its name | api |
| Edge case  | 30-character tag and 100-character asset name, encrypted | Stored; a 31-character tag is still refused by the request schema | api |
| Edge case  | Demo session with the switch on `all` | Demo labels are stored encrypted | api |
| Edge case  | Break each gate on purpose once: skip a column in a write, log a name, return a raw value | The matching gate goes red | system |
| Teardown   | `bun run supabase:reset` | Seed restored, in plaintext by design: it exercises the legacy read and the conversion | system |

## Tasks to do

### `1)` Add the switch

> Off by default, then one account, then everyone (Q11).

1. `environment.ts`: `LABEL_ENCRYPTION_SCOPE` (`off` by default, `listed`, `all`) and `LABEL_ENCRYPTION_USER_IDS`; cases in `environment.spec.ts`; both documented in `.env.example`.

### `2)` Release the database constraints

> Ciphertext is longer than a name and never equal to another.

1. Contract migration, `-- pulpe:safe-after` the release that ships phase 3: drop the three length `CHECK` constraints on `tag.name`, `asset_category.name` and `asset.name`, the unique indexes `idx_tag_user_id_name_lower` and `asset_category_user_id_name_lower_idx`, and the trigram indexes `idx_transaction_name_trgm` and `idx_budget_line_name_trgm`.
2. In the same migration the plan apply and the budget generation raise when the caller sends no text: the SQL fallback kept in phase 3 goes.
3. The two `source_savings_goal_name_not_blank` checks (`btrim(...) <> ''`) stay: a marked value is never blank.

### `3)` Encrypt on write

> One decision point, every write path.

1. `encryption.port.ts` and the crypto service: one method returns the value to store for a user, ciphertext when the switch covers the account, plaintext otherwise.
2. Every repository of the projection and `tag-links.util.ts` store labels through it, the write paths with no key today included; the texts built by the server in phase 3 go through it too.
3. `supabase-demo.repository.ts` follows the same rule as any account.
4. `tag.entity.ts`: the comment that documents the plaintext posture is rewritten.
5. SQL keeps copying a goal's stored name into `source_savings_goal_name` as an opaque value: `enforce_budget_line_savings_goal_source`, `create_savings_goal_withdrawal`, `update_savings_goal_withdrawal`, the plan apply and `sync_savings_goal_withdrawal_name` need no change. The copy is the goal's own ciphertext, readable under the same key.

### `4)` Convert an account

> Whole account, all or nothing, retried while plaintext remains (Q7).

1. `convert_user_labels` in its own contract migration: `SECURITY DEFINER`, empty `search_path`, `service_role` only. It locks the `user_encryption_key` row and raises when the stored `key_check` differs from the one it was given: a conversion queued behind a PIN change writes nothing. It then replaces each value only if the stored one still equals the plaintext it was computed from, checks a row count per table and that no label of the user is left without the marker, writes `savings_goal` names last, and rolls back as a whole otherwise.
2. `convert-user-labels.use-case.ts`: reads the registry columns, encrypts, decrypts each result in memory and compares it with the source before sending, then calls the function through `supabase-encryption-key.repository.ts` with a strict Zod schema and the `key_check` the key was validated against.
3. Trigger in the crypto service, after a key derivation the canary validated, for an account under the switch that still holds plaintext: started in the background, it holds the derived key and never the client key, and its failure never fails the request.
4. `convert_user_labels.sql`: atomicity, compare-and-set, stale `key_check` refusal, cross-user refusal; listed in the tests README.

### `5)` Gates in CI

> Blocking, each proven able to go red (Q13).

1. `label-encryption-gates.integration.spec.ts`: the journey under the switch, the marker absent from every response, the canary token in a database dump and in the captured logs, the conversion against its reference snapshot, the stale key, the concurrency cases.
2. The column gate of phase 4 and the parity spec of phase 2 stay in the same run.
3. Record one deliberate red run per gate in the pull request.
4. `label-journey.ts` exposes the account snapshot the gate uses: every label read through the API, keyed by table, column and row id. `scripts/label-snapshot.ts` runs it against a base URL with a bearer token and a client key taken from the environment and prints the sorted result, nothing else. Phase 7 uses it on a real account.

### `6)` Observe

> Know the same day that something went wrong.

1. One structured log line per conversion: outcome, duration, counts per table, never a value.
2. `label-encryption-status.cron.ts`: once a day, log the number of converted accounts, of accounts mixing both formats, and of accounts under the switch still in plaintext.
3. The backend has no error tracker and no notification channel today: choose one, then wire two alerts, a failed conversion and a mixed account older than a day.

### `7)` Rule and documentation

> The written rule changes with the code.

1. `encryption-backend.md`: label columns in the encrypted-columns table and in the write rule.
2. `docs/ENCRYPTION.md`: format, switch, conversion.
3. `bun run generate-types:local`, then `bun run format`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | The backend refuses to start on an unknown scope value; with `off` the phase 2 and phase 4 specs stay green untouched |
| 2    | A 30-character tag stores encrypted; the plan apply and the budget generation raise without their text |
| 3    | After the journey under the switch, no label of the test account is stored without the marker, and each goal-name copy equals the goal's stored value |
| 4    | The converted account decodes to its reference snapshot; a stale key and a stale `key_check` write nothing; a concurrent write rolls the conversion back and the retry completes it |
| 5    | The gates run in the CI integration job and the pull request holds one red run per gate; the snapshot script prints the same content before and after a local conversion |
| 6    | A forced conversion failure produces its log line and its alert; the daily line shows the three counters |
| 7    | `encryption-backend.md` and `docs/ENCRYPTION.md` list the label columns; `database.types.ts` exposes the new function |
