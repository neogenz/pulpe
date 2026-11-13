---
objective: "Every free-text label a user types is stored encrypted under the same PIN-bound key as the amounts, for each account that signs in after activation, with no client change and no lost feature."
status: pending
---

# Plan: Encrypt user labels at rest

Source: design interview of 2026-11-12 and 2026-11-13 (decisions Q1 to Q16), recorded in Linear epic PUL-382. The feature is parked: build it only if the epic is reopened. Phase 1 is worth shipping on its own and is tracked as PUL-381; phase 2 is PUL-383.

"Label" means the 13 columns of Q2: `transaction.name`, `transaction.source_savings_goal_name`, `budget_line.name`, `budget_line.source_savings_goal_name`, `template_line.name`, `template_line.description`, `template.name`, `template.description`, `savings_goal.name`, `monthly_budget.description`, `tag.name`, `asset.name`, `asset_category.name`.

## Phases

| #   | Phase                                   | File                         | Depends on |
| --- | --------------------------------------- | ---------------------------- | ---------- |
| 1   | Stale key lands on the PIN screen       | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Safety net on the real database         | [`phase-2.md`](./phase-2.md) | none       |
| 3   | Postgres stops reading labels           | [`phase-3.md`](./phase-3.md) | 2          |
| 4   | Read both formats                       | [`phase-4.md`](./phase-4.md) | 2, 3       |
| 5   | PIN change and recovery cover labels    | [`phase-5.md`](./phase-5.md) | 4          |
| 6   | Encrypted writes and account conversion | [`phase-6.md`](./phase-6.md) | 1, 3, 4, 5 |
| 7   | Activation and public wording           | [`phase-7.md`](./phase-7.md) | 6          |

## External sources

| URL  | What it settled |
| ---- | --------------- |
| none | none            |

## Impact

| Category      | Verdict and evidence | Handled in |
| ------------- | -------------------- | ---------- |
| runtime       | A read with a stale key answers 400 `ERR_ENCRYPTION_KEY_CHECK_FAILED` instead of 200 with zero amounts. Observed: `getUserDEK` returns the unvalidated key today; iOS handles the code on any request since commit `033198e10`, Android since v0.46.0 (`core/vault/key-invalidation.ts`), the web only validates the stored key at start (`client-key.service.ts`). Unverified: whether an iOS build older than its handler still has active devices; the version gate shipped later (`01c460c0c`) and cannot keep such a build out. | 1 |
| runtime       | Search leaves Postgres: labels are matched in memory, newest first, until 25 hits per type. Measured once locally during the interview with a script that was not committed; production latency unverified until the p95 read of phase 3. | 3 |
| runtime       | Ordering moves to the server. The local database collates with ICU `en-US` on PostgreSQL 17.6 (queried 2026-11-13); production collation unverified. | 2, 3 |
| runtime       | PIN change and recovery rewrite 13 more columns in the same transaction. Duration on the largest account unverified. | 2, 5 |
| runtime       | The first validated request of an account under the switch starts one background conversion. Cost in production unverified. | 6, 7 |
| regression    | Tag and asset-category names lose their unique index: two simultaneous creations of the same name can both succeed. Accepted in Q10. | 3, 6 |
| regression    | Conversion and rekey bump `updated_at` on every rewritten row (`update_*_updated_at` triggers) and the goal `balance_revision` (`sync_savings_goal_withdrawal_name`, then the revision triggers). No backend read sorts or filters on `updated_at` (explored); client use of `updatedAt` unverified. | 5 |
| regression    | A name of a converted account can no longer be read in the database: support by SQL ends for names. Accepted. | 7 |
| architecture  | `EncryptionPort` gains text primitives. Other modules still reach crypto only through the port (ADR-0008), repositories keep the boundary (ADR-0004), and PostgreSQL never receives a key (ADR-0013; ADR-0012 rejects database-side encryption). | 4 |
| architecture  | The legacy plaintext read path stays forever: an account that never comes back is never converted (Q6). | 4 |
| security      | Gain against a database-only leak and casual reading. A leak of database plus server secrets still allows trying the 10,000 PINs of an account; time per account not measured. Accepted, stated in ADR-0020. | 4 |
| data          | A conversion cannot be undone without the user's key. Rollback is turning the switch off: converted values stay encrypted and readable. | 6, 7 |
| data          | Writes take no lock on the key row: a write that validated its key just before a PIN change and lands after it stays under the old key, and that row shows amount 0 and the label placeholder. The window exists for amounts today. Documented, not closed. | 5 |
| documentation | `docs/ENCRYPTION.md`, `.claude/rules/05-workflows-and-processes/encryption-backend.md`, new ADR-0020, `backend-nest/supabase/tests/README.md`. Public copy says "montants" only today (`landing/content/dictionaries/fr.ts`, the privacy and about pages, and one in-app sentence on web, iOS and Android), so no current claim is false. | 1, 4, 5, 6, 7 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Encrypt through `ENCRYPTION_PORT`; repositories own the boundary (`encryption-backend.md`, ADR-0004, ADR-0008) | Labels follow the path of the amounts; use cases keep seeing plain strings |
| An RPC with a JSONB parameter holding ciphertexts gets a strict Zod schema and its spec (`supabase.md`) | Rekey, conversion and the text parameters of phase 3 carry label values in JSONB |
| Each migration declares `-- pulpe:migration-phase expand\|contract`; `DROP`, `RENAME`, `REVOKE` and any `EXECUTE`, a grant included, only in contract, with `-- pulpe:safe-after vX.Y.Z` (`.github/scripts/check-migration-contract.cjs`, `docs/DEPLOYMENT.md`) | Phase 3 replaces a function signature and grants execute on it; phases 5 and 6 revoke grants and drop indexes and constraints |
| Never edit an existing migration; after a schema change run `bun run generate-types:local`, then `bun run format` | Functions are redefined in new migrations in phases 3, 5 and 6 |
| `SECURITY DEFINER` only with an explicit authorization check, an empty `search_path` and least-privilege grants (ADR-0013) | Rekey v4 and the conversion function run with the service role |
| Never log a label, an amount or a raw error payload (`logging.md`, `posthog-privacy.md`) | Conversion and status logs carry counts only |
| Never a destructive Supabase command on a linked database; locally only `bun run supabase:reset` | The export and restore drill of phase 7 reads production and restores elsewhere |
| A written rule beats the code next to it | The label encryption rule lands in `encryption-backend.md` before the last repository follows it |
| Past about 300 net lines, stop and propose alternatives | Phases 3, 4 and 6 will pass it: re-slice each one when it starts |
| Product copy is French and solo-voiced; the word "transaction" never shows; no "tous", "100 %" or "au maximum" (Q12) | The What's New note and the public pages of phase 7 |

## Decisions

| Decision | Why |
| -------- | --- |
| Same PIN-bound key as the amounts, encrypted and decrypted in the repositories (Q1) | One trust model, no client change; the server-key variant was rejected |
| Ciphertext with a versioned marker in the existing `text` column; a value without the marker is plaintext and stays readable forever (Q3, Q6) | No parallel columns; accounts that never return are left as they are |
| The 13 columns ship as one lot (Q2, Q10) | A partial state would leave the same name readable through a sibling column |
| Postgres never reads a label: search, order, duplicates and generated texts move to the server (Q5, Q10) | Ciphertext is opaque and PostgreSQL never receives a key (ADR-0012, ADR-0013) |
| One conversion per account, in the background, at the first request with a canary-validated key, all or nothing (Q7) | No downtime, no script holding user keys, safe to retry |
| A stale key lands on the PIN screen; only an isolated unreadable label shows a neutral placeholder (Q8) | A wrong key must never look like data, and one bad row must not blank a screen |
| PIN and recovery key both lost means the labels are lost with the amounts (Q9) | Same guarantee as the amounts; the server has no path back into such an account |
| Rekey covers labels before the first encrypted write (Q15) | A PIN change must never leave a label under the old key |
| Rollback is the switch, there is no reverse conversion (Q11) | Reads accept both formats forever, so turning encryption off loses nothing |
