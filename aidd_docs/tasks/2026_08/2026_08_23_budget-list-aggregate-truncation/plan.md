---
objective: "The budget list shows the same `remaining` as the budget detail, whatever the number of budget lines and transactions the account holds."
status: implemented
---

# Plan: budget list aggregates survive PostgREST's row cap

## Overview

| Field      | Value                                                                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Goal**   | Paginate the batched reads behind `GET /budgets?fields=…` so aggregates stop being computed from a truncated row set.                                                                                            |
| **Source** | Reproduced locally: adding 900 amount-less rows to one 2025 budget made 17 of 24 budgets report a wrong `remaining` in the list (2026-08 → `0.00`) while `GET /budgets/:id/details` still returned `809.02`.     |

## Phases

| #   | Phase                                | File                         |
| --- | ------------------------------------ | ---------------------------- |
| 1   | Paginate the batched aggregate reads | [`phase-1.md`](./phase-1.md) |

## Resources

| Source                                                  | Verified                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `backend-nest/supabase/config.toml:18` (`max_rows`)      | PostgREST caps every unpaginated response at 1 000 rows, locally and on the hosted project.  |
| `aes-gcm.crypto-service.ts` (`#fetchAllPages`)           | The repository layer already owns a page-until-short-page loop; the fix reuses it, not a new one. |

## Decisions

| Decision                                                                                          | Why                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Page the existing queries rather than move the aggregation into a Postgres view or RPC.           | Amounts are AES-GCM ciphertext: the sums cannot be computed in SQL. Paging is the only fix that keeps the encryption boundary where it is.                                                        |
| Extract the paging loop to `common/utils` and let the crypto service delegate to it.              | Two copies of a silent-truncation guard is how the second copy drifts. One implementation, two callers.                                                                                          |
