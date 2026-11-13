---
status: pending
---

# Instruction: Read both formats

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── backend-nest/
│   └── src/
│       ├── test/
│       │   └── label-journey.ts ✏️
│       └── modules/
│           ├── encryption/
│           │   ├── label-columns.integration.spec.ts ✅
│           │   ├── label-parity.integration.spec.ts ✏️
│           │   ├── domain/
│           │   │   ├── label-columns.ts ✅
│           │   │   └── ports/
│           │   │       └── encryption.port.ts ✏️
│           │   └── infrastructure/
│           │       └── crypto/
│           │           ├── aes-gcm.crypto-service.ts ✏️
│           │           └── aes-gcm.crypto-service.spec.ts ✏️
│           ├── transaction/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           └── supabase-transaction.repository.ts ✏️
│           ├── budget-line/
│           │   └── infrastructure/
│           │       └── persistence/
│           │           ├── supabase-budget-line.repository.ts ✏️
│           │           └── supabase-budget-line-spread.reader.ts ✏️
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
└── docs/
    └── adr/
        ├── 0020-label-encryption-format.md ✅
        └── README.md ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Phase 2 spec green; a second fixture account whose labels the test writes already encrypted, with the crypto service and the account key | One plaintext account and one encrypted account holding the same content | api |
| Happy path | Run every read endpoint, the search, the orders and the duplicate checks on both accounts | Identical decoded responses for both | api |
| Happy path | Column gate: compare the text columns of the nine tables in `information_schema` with the registry plus the list of columns left in clear | Green; a text column in neither list turns it red | system |
| Edge case  | `decryptLabel` on a value carrying the marker that fails authentication (tampered, or encrypted under another key) | It throws: never the ciphertext nor garbage | system |
| Edge case  | One such value among the rows of a list or a detail read through the API | That row shows the neutral placeholder of Q8, the other rows their names; one warning is logged with the table, the row id and the error type, never the value; no response contains the marker | api |
| Edge case  | `null` and empty string | Returned as they are, never treated as ciphertext | api |
| Edge case  | Plaintext write whose value starts with the marker | Refused with a validation error | api |
| Edge case  | Account mixing both formats inside one table | Each value decoded by its own format | api |
| Edge case  | Every response recorded for the encrypted account | None contains the marker | api |

## Tasks to do

### `1)` Decide and record the format

> ADR-0020, written with the code that introduces the format (Q16).

1. `0020-label-encryption-format.md`: a versioned ASCII marker followed by `base64(IV ‖ tag ‖ ciphertext)`, AES-256-GCM under the same key as the amounts, no AAD as in ADR-0015. A value without the marker is plaintext and stays readable forever. Decoding is strict. State the accepted limits: dormant accounts stay in clear, the PIN brute force, the loss of SQL support for names.
2. Add the ADR to `docs/adr/README.md`.
3. Before merging, count in production the existing values that start with the marker over the 13 columns: read-only, expected 0, figure in the pull request.

### `2)` Add text primitives to the port

> The only door to label crypto, for every module.

1. `encryption.port.ts` and `aes-gcm.crypto-service.ts`: `encryptLabel(value, dek)` and `decryptLabel(value, dek)`. Decryption passes a value without the marker through, throws on a marked value that fails, and leaves `null` and the empty string alone.
2. A plaintext write whose value starts with the marker is refused at this boundary.
3. `aes-gcm.crypto-service.spec.ts`: round trip, tampered value, wrong key, legacy passthrough, `null`, empty string, marker-prefixed plaintext.

### `3)` Add the column registry

> One list of what is a label, read by the gates, the rekey and the conversion.

1. `label-columns.ts`: the 13 columns, each with how its row reaches its user, directly or through a parent table.
2. `label-columns.integration.spec.ts`: every text column of the nine tables is in the registry or in an explicit list of columns left in clear.
3. `label-journey.ts` takes its column list from the registry.

### `4)` Decode on every read

> No label leaves a repository undecoded.

1. The ten repositories of the projection decode in their mappers.
2. Reads that bypass a mapper: budgets of a template usage, search rows and the embedded budget description, history names, the mutation context and allocation lookups, the deletion impact, the plan-apply rows, the attachable lines of an import.
3. Function results that carry labels: `create_budget_from_template`, `create_budgets_from_template`, `create_template_with_lines`, the goal-plan apply, `reconcile_savings_goal_target_date`, `get_savings_goal_deletion_impact`.
4. Read paths that derive no key today get one: template header, tag and asset-category reads, asset list and update, allocation lookup.

### `5)` Show a placeholder for an isolated unreadable label

> One bad value must not take a screen down (Q8).

1. `tryDecryptLabel` beside `tryDecryptAmount`, on the port and in the crypto service: a marked value that fails returns the placeholder and logs a warning with the table, the row id and the error type, never the value.
2. The mappers of lists and details use it. The strict `decryptLabel` stays for the rekey and the conversion, where a failure must abort.
3. A stale key must never reach it: phase 1 refuses that request before a row is read, and phase 6, the first to encrypt a production value, depends on phase 1.
4. ADR-0020 fixes the placeholder text, one server-side string for every client and language, and states what saving such a row from a client does.

### `6)` Prove both formats

> Before any production write is encrypted.

1. `label-parity.integration.spec.ts`: add the encrypted fixture account and compare it with the plaintext one, response by response.
2. Assert no recorded response of the encrypted account contains the marker.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | ADR-0020 is listed as Proposed in the index and the production count of marker-prefixed values is 0 |
| 2    | The seven unit cases pass; `bun run lint:arch` shows no module reaching crypto outside the port |
| 3    | The column gate is green, and red when a text column is added to one of the nine tables without being listed |
| 4    | The plaintext account behaves exactly as before: the phase 2 spec stays green untouched |
| 5    | A tampered value shows the placeholder on its row only, the warning carries no value, and the strict primitive still throws on it |
| 6    | The encrypted account returns the same decoded responses as the plaintext one, and none contains the marker |
