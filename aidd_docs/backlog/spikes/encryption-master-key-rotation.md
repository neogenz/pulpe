---
type: spike
status: resolved
---

# Spike: Encryption master key rotation

## Question

Can Pulpe rotate its server master key and affected data keys without additional user input, while preserving existing recovery keys and financial data? What is the smallest defensible alternative if the current architecture prevents this?

## Decision

Recommendation, not implementation approval: introduce explicit key versions and a safe per-vault transition; automate only cases whose recovery path can be preserved. Keep legacy vaults readable. Do not replace the Railway variable or turn the current PIN-rekey flow into an automatic migration.

The user accepts retaining the old master key, prefers no additional input, and accepts a one-time interaction if necessary. Rotation must not force a PIN change. Keeping an existing recovery key is preferred. None of these choices establishes that an exposed key was harmless.

## Bounds

- Source snapshot: `5b6f779911c4927df689ff5b02080a6a860afb56`, inspected on 2026-10-23. No fresh production inventory was performed.
- Evidence: source inspection, 171 existing unit tests, synthetic cryptographic assertions, and exact rekey function bodies executed against minimal tables in disposable PostgreSQL 17.6.
- Stop condition met: distinguish feasible options and security limits, recommend the smallest approach, and enumerate evidence required before production.
- Scope: this report and disposable local experiments only. No production data or secrets read, application implementation, schema/configuration changes, commit, or publication. No persisted parent artifact exists; no relations or parent statuses changed.

## Investigation

| Attempt                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                    | Result                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Derivation, recovery and cache inspection | [Crypto service](../../../backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts), especially lines 146, 223, 254, 670, 865, 991, 1323                                                                                                                                                                                                                         | Master rotation changes the DEK; the old recovery wrapper still yields the old DEK; writes and recovery metadata do not share one complete transition.                                     |
| Database boundary inspection              | [Core RPC](../../../backend-nest/supabase/migrations/20260804130000_lock_down_user_encryption_key.sql), [v2 wrapper](../../../backend-nest/supabase/migrations/20260808170000_harden_savings_goal_plan_concurrency_and_rekey.sql), [transaction writes](../../../backend-nest/src/modules/transaction/infrastructure/persistence/supabase-transaction.repository.ts)                        | Payload reads precede the RPC; ordinary writes do not participate in an encryption-version check at commit.                                                                                |
| Existing tests                            | Crypto service, encryption repository, AuthGuard specs; command below                                                                                                                                                                                                                                                                                                                       | 171 passed, 0 failed, 443 assertions. Database calls are mocked; this is not production rotation coverage.                                                                                 |
| Synthetic crypto experiment               | [Local script](/private/tmp/pulpe-rotation-study-crypto.ts), fresh random keys; imports the actual crypto service                                                                                                                                                                                                                                                                           | Six assertion groups passed: changed DEK, stale recovery, unchanged-DEK limitations, recovery supplied, bridge counterexamples, HMAC/fallback behavior.                                    |
| SQL counterexample and positive control   | [Local runner](/private/tmp/pulpe-rotation-study-sql.py); cached image `public.ecr.aws/supabase/postgres:17.6.1.158`; no network, host volume or existing database                                                                                                                                                                                                                          | Three unsafe schedules reproduced; missing plan-withdrawal payload correctly rolled back all RPC updates. Container removed on exit.                                                       |
| Client/MCP contracts                      | [Web recovery](../../../frontend/projects/webapp/src/app/feature/auth/recover-vault-code/recover-vault-code.ts), [iOS recovery](../../../ios/Pulpe/Features/Auth/Pin/PinRecoveryViewModel.swift), [Android vault](../../../android/src/core/vault/vault-store.ts), [MCP connection](../../../backend-nest/src/modules/mcp/infrastructure/persistence/supabase-mcp-connection.repository.ts) | Clients hold the client factor, not the DEK. Existing recovery flows generate a new recovery key; MCP stores a wrapped client factor. Compatibility cannot be inferred from backend tests. |

### Current cryptographic boundary

Let `C` be the PIN-derived client key, `M0/M1` the old/new server keys, `S` the existing user salt, and `R` the recovery key:
`D0 = HKDF(C || M0, S, userContext)`, `D1 = HKDF(C || M1, S, userContext)`, `W0 = AEAD_R(D0)`.
Keeping `C`, `S`, and the KDF parameters unchanged preserves the normal PIN/biometric factor. Changing `M` changes `D`; old amounts require re-encryption. Normal unlock supplies `C`, but not `R`.

There is currently one configured master key and no per-vault master version in [the domain entities](../../../backend-nest/src/modules/encryption/domain/encryption.entity.ts). Financial ciphertext is IV + GCM tag + ciphertext, without a key ID. Simply retaining two environment variables does not make the current readers select the correct key.

Eleven encrypted fields across six tables must be covered: budget_line(amount, original_amount), transaction(amount, original_amount), template_line(amount, original_amount), savings_goal(target_amount, initial_amount, original_target_amount), monthly_budget(ending_balance), savings_goal_plan_withdrawal(amount). The inventory must be reconciled with the deployed schema before use.

The split-key design is useful, but a four-digit PIN is not a high-entropy independent secret. A stolen master plus database salts/canaries permits offline PIN guessing; this study did not benchmark its cost. With database contents and `MCP_WRAPPING_KEY`, wrapped MCP client factors may also be recoverable. This report neither confirms nor excludes incident exfiltration.

### Options and tradeoffs

| Option                                                                 | Extra input                                            | Actual protection change                                                              | Assessment                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replace the environment variable directly                              | None                                                   | Different DEKs, unreadable old ciphertext                                             | Reject.                                                                                                                                                 |
| Version keys; keep existing vaults on M0 and create new vaults on M1   | None                                                   | New vaults use M1; existing vaults remain dependent on M0                             | Compatibility foundation, not completed rotation.                                                                                                       |
| Preserve D0 and wrap it with a new server/client-derived key           | None                                                   | Changes storage protection, not the underlying data key; M0 + C still derives D0      | Reject as a remedy for old-DEK exposure.                                                                                                                |
| Re-encrypt with D1 and rewrap using the supplied R                     | R once, or during an already chosen recovery operation | Real data-key change; the same PIN and R can be retained in a dedicated rotation flow | Smallest defensible full rotation for recovery-enabled vaults, after safety gates.                                                                      |
| Re-encrypt with D1 and retain R through a server-gated recovery bridge | None at migration                                      | Can preserve recovery while requiring a new server secret to reach D1                 | Algebraically feasible, substantially more lifecycle complexity; not recommended for this precautionary change without separate security design review. |

For a validated PIN-only vault with `wrapped_dek = null`, there is no existing recovery wrapper to invalidate: an automatic transition during ordinary authenticated use is technically possible after the same data-integrity gates. Missing/invalid canaries and recovery-only legacy states are exceptions to investigate, not permission to initialize or overwrite them. The population of each state is unknown.

For recovery-enabled vaults, a direct `AEAD_R(D1)` wrapper requires R. Keeping `W0` unchanged does not give access to D1 under the current format. This is a limitation of the present architecture, not a proof that all transparent recovery designs are impossible.

The experiment tested a counterexample: retain W0 and store `B = AEAD_K(D1)`, where K derives from D0 plus M1 with a dedicated user-bound context. Normal unlock can create B; later R recovers D0 and the server uses M1 to open B. Tests rejected old-master, wrong-anchor, wrong-user and tampered inputs. In contrast, wrapping D1 under D0 alone lets an old-DEK holder cross directly to the new key and was rejected.

That bridge is only a feasibility demonstration, not a reviewed protocol. It adds another stored wrapped DEK beyond the present recovery mechanism and changes [ADR-0012](../../../docs/adr/0012-split-key-financial-encryption.md). R alone would no longer recover the current DEK offline: the corresponding server secret and bridge are also needed. Multiple rotations, recovery-anchor retirement, PIN changes, backups, key-purpose separation and complete authenticated metadata need design review. These are reasons not to introduce it solely to avoid a one-time interaction.

[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html#cryptoperiods-and-rotation) likewise distinguishes rewrapping a DEK from replacing it; rewrapping does not reset that DEK's lifetime. Its [backup guidance](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html#escrow-and-backup) explains why losing required key material can make encrypted data unrecoverable.

### Proven gaps before any bulk/automatic rekey

1. Lost edit: backend reads an amount; a different request commits an edit; the existing RPC then overwrites it with a re-encrypted stale value. Its ID/row-count checks pass.
2. Missed insert: a transaction inserted after the backend snapshot is absent from the payload; the RPC still advances the canary. That row remains under the old DEK. Only plan withdrawals currently have an authoritative full-table-per-user count check in the v2 wrapper.
3. Stale writer: a request that obtained the old DEK can write after the new canary commits. Guard/cache validation occurs before the write, not atomically with it. The SQL fixture demonstrated acceptance of such ciphertext.
4. Recovery gap: the current flow nulls wrapped_dek before the data RPC and restores/rewraps it with separate calls. Failure can leave a readable vault without working recovery. Successful financial-data commit alone is not success.
5. Read consistency: cached DEKs and data snapshots can cross versions. Tolerant reads return 0/null on decryption failure; a healthy page or canary is not proof that all amounts survived.

The SQL experiment used deterministic interleavings of committed statements and the repository's exact function bodies, with synthetic ciphertext labels and minimal tables. It was not a parallel production load test or a complete Supabase/RLS/trigger replay. The source-level writer paths support these schedules; no production occurrence is claimed. Increasing isolation only inside the final RPC would not include earlier HTTP reads or prevent a later stale writer; see [PostgreSQL 17 isolation](https://www.postgresql.org/docs/17/transaction-iso.html).

### Import identity is a separate dependency

[Fingerprint generation](../../../backend-nest/src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.ts) derives an HMAC key from the master and user ID, independently of C. Changing the master changes import identities. The [ledger](../../../backend-nest/supabase/migrations/20261012130000_transaction_import_fingerprint_ledger.sql) stores fingerprints, not all original source material; deleted/spread imports cannot simply be rehashed.

The smallest compatibility option, given accepted old-key retention, is to pin legacy fingerprint derivation separately from the active financial master. This preserves deduplication but explicitly leaves that HMAC dependency unrotated. A later dual-version fingerprint design would need atomic deduplication across key versions and coordinated writer rollout; querying both hashes alone does not protect mixed old/new concurrent writers. Financial migration completion therefore does not imply permission to delete M0.

### Required production acceptance evidence

- Restore an actual protected backup in isolation with separately escrowed required key versions; prove recovery using test-authorized client/recovery factors. A database backup alone does not contain every factor. Inactive vaults cannot all be decrypted administratively without their client/recovery factor.
- For each migrating vault, strictly decrypt and compare every protected field before/after, preserving IDs, nulls, cardinality, metadata and exact decoded values. Verify serialization compatibility separately; aggregate totals and the canary are insufficient. Never log values or stable low-entropy hashes of amounts.
- One committed state must include data, master version, canary and recovery wrapper (or explicit preserved absence). Failed transitions leave the previous coherent state. A commit with a lost HTTP response must be identifiable and safely retryable without duplicate migration.
- All writers, including direct database/RPC paths, imports, recalculation, scheduled work and MCP, must reject stale-version writes at commit. Prevent or detect edits/inserts/deletes since the preparatory snapshot; drain or fence requests already in flight. A process-local lock is insufficient.
- Readers and caches must select a consistent version, including several backend replicas and a rolling deployment. Do not interpret stale-version failures as a wrong PIN or display zero amounts. Old binaries that cannot read migrated vaults must not receive traffic.
- Exercise failures before/after every boundary, corrupted ciphertext, pagination over 1,000 rows, repeated retries, null/no-recovery states, simultaneous PIN/recovery changes, user deletion and import replays.
- Demonstrate normal PIN, remembered-device/biometric unlock, recovery and an existing MCP connection on web, iOS and Android. Preserve existing verify-recovery read-only semantics; do not hide a bulk mutation behind that endpoint.
- Rollback must preserve writes accepted after a migration. A compatible prior release or verified reverse rekey is needed; restoring an old snapshot is not a lossless rollback. Retain keys while any vault, import identity or retained backup still depends on them.
- Establish non-sensitive progress/error counts, measured interruption/latency limits and an explicit stop condition before a first production cohort. No all-users completion claim while legacy vaults remain.

### Change surface for a subsequent design

| Surface                   | Existing entry points that must agree                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Crypto and contracts      | AES service, encryption entities/ports/use cases, recovery DTOs, shared schemas/error codes if public behavior changes                     |
| Persistence               | Encryption repository, rekey RPCs, all six financial tables and write paths, generated DB types, full-schema tests                         |
| Runtime and compatibility | Environment validation, key-ring availability, request validation, DEK caches, read behavior, multi-replica deploy/rollback                |
| Import and MCP            | Fingerprint repository/ledger and concurrent import tests; MCP client-factor unwrap and recovery/PIN revocation semantics                  |
| Clients                   | Web encryption API and recovery views, iOS EncryptionAPI/ClientKeyManager, Android vault store; normal/biometric/recovery regression tests |
| Fixtures and operations   | Seed encryption script, CI synthetic key configuration, backups, deployment secret inventory, ENCRYPTION.md and ADR-0012                   |

## Outcome

- Result: transparent rotation is feasible for validated vaults without recovery; preserving existing recovery keys transparently needs a different recovery architecture. The present code is not safe for automatic/bulk master-key rotation.
- Recommendation: retain old keys, add version-aware compatibility and the integrity guarantees above, then migrate eligible vaults. For other vaults, use a moment when the recovery factor is already intentionally supplied, or an optional one-time request to supply the existing recovery key while keeping the PIN. Users who defer stay on M0; do not call this complete rotation.
- Confidence: high in these bounded findings because code, unit tests and local counterexamples agree; insufficient to approve any production migration.
- Remaining uncertainty: deployed schema/version, counts of each vault state, real backup restoration, full-stack concurrency, client/device behavior, migration duration and any incident data exposure. The bridge has no independent cryptographic review.

## Follow-up

This spike resolves feasibility only. Implementation, the chosen user interaction and any architecture change require a concrete design review. No production operation or separate backlog change is approved or performed by this report.

## Challenge of production readiness

The following skill rubric assesses readiness of the proposed rotation, not a measured failure probability; its fixed section labels are not guarantees.

My confidence level of correctness now: 60%

# Correctness (100%)

- Real data-key rotation can keep the same client factor/PIN. Old-key retention avoids forced migration of inactive vaults.
- The experiments distinguish a real rekey from merely wrapping the old DEK, and do not mistake a successful unit suite for production proof.

# Deal breakers

- The current migration can lose concurrent edits or leave mixed-key data; recovery metadata is outside the complete transaction.
- Transparent recovery for recovery-enabled vaults lacks an approved/reviewed design; restores and deployed multi-client behavior remain untested.

# Suggestions (enhancements only)

- None. The unresolved items above are acceptance gates, not optional enhancements.

## Reproduction

From `backend-nest/`: `bun --no-env-file test src/modules/encryption/infrastructure/crypto/aes-gcm.crypto-service.spec.ts src/modules/encryption/infrastructure/persistence/supabase-encryption-key.repository.spec.ts src/common/guards/auth.guard.spec.ts`.
Then `bun --no-env-file /private/tmp/pulpe-rotation-study-crypto.ts`; the SQL runner is `python3 /private/tmp/pulpe-rotation-study-sql.py` and requires the cached image/Docker. These temporary helpers contain only synthetic inputs; their paths are local evidence, not durable application tools.
