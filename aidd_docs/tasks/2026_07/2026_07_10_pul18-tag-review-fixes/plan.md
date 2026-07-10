---
objective: "All 11 PUL-18 review findings are fixed: tag writes abort-before-commit or compensate, tag-junction plumbing is single-sourced, and redundant frontend guards are gone."
status: in-progress
---

# Plan: PUL-18 tag review fixes

## Overview

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| **Goal**   | Fix the 11 findings of the PUL-18 tag review (atomicity, duplication, guards) |
| **Source** | `PUL-18-TAG-REVIEW-FINDINGS.md` (repo root, review scratch file)      |

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Single-entity tag atomicity (findings #1, #3, #11)           | [`phase-1.md`](./phase-1.md) |
| 2   | Bulk tag propagation atomicity (findings #2, #6)             | [`phase-2.md`](./phase-2.md) |
| 3   | Shared tag-junction helper (findings #4, #5, #10)            | [`phase-3.md`](./phase-3.md) |
| 4   | Frontend dedup and guard cleanup (findings #7, #8, #9)       | [`phase-4.md`](./phase-4.md) |

Phase 4 is independent of 1-3. Phase 2 depends on phase 1 (logger injection in the template repository). Phase 3 depends on 1 and 2 (it extracts the code they touch).

## Decisions

| Decision | Why |
| -------- | --- |
| Finding #1 fixed by reordering (tag RPC before scalar update), not by folding scalars into an atomic RPC | Tag ids are the user-dependent, failure-prone input; once tags succeed, the scalar update on an owned row is near-certain. Reorder needs zero migration and no encryption plumbing in SQL. Residual risk (tags committed, scalar failed) is user-recoverable by re-editing and non-financial in that direction. The full atomic fold (3 new RPCs with ciphertext JSONB + Zod + tests) is deliberately rejected as disproportionate. |
| Finding #2 fixed by compensation, not a client idempotency key | On a failed bulk tag step, replay `apply_template_line_operations` with `delete_ids` = created line ids — the hardened RPC atomically removes created `template_line`s AND their propagated `budget_line`s (FK is `ON DELETE SET NULL`, so a raw delete would orphan them). Retry then converges naturally. An idempotency key would touch shared schemas + frontend + replay-heal logic for the same outcome. |
| Finding #6 fixed by one new `bulk_replace_template_line_tags_and_sync` RPC, edited into the uncommitted `20260707120000` migration | The migration has not shipped (untracked, same PR); editing it in place avoids ever shipping the dead `sync_template_line_tags_to_budgets` function. Single plpgsql body = single implicit transaction for N tag sets + budget sync. |
| SQL layer keeps 3 explicit `replace_*_tags` functions; only the TypeScript wrapper is unified | Constraint carried from the findings: parameterizing table names in plpgsql needs dynamic SQL (injection surface, loses static FK typing). |
