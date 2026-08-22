---
objective: "The home projection bends toward where this user usually lands, computed by the backend from their closed months, and ships only if a backtest proves it beats the straight line."
status: in-progress
---

# Plan: Home projection learns from the user's history

## Overview

| Field      | Value                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Replace the zero prior of `trendBalance` with the user's usual drift rate, computed server-side from the ≤12 closed months as a Bühlmann credibility prior (data-derived strength K, sign-consistency and MAD guardrails); hero figure and label unchanged. |
| **Source** | Brainstorm of 2026-08-22 (this session): closed month = pay-day period ended AND every prévision pointed; median over mean; outflows only; backtest is a blocking gate.                       |

## Phases

| #   | Phase                                                  | File                         |
| --- | ------------------------------------------------------ | ---------------------------- |
| 1   | Backend drift history on the budget details response   | [`phase-1.md`](./phase-1.md) |
| 2   | Backtest gate: curve vs straight line on real history  | [`phase-2.md`](./phase-2.md) |
| 3   | iOS projection bends with the prior, guarded           | [`phase-3.md`](./phase-3.md) |
| 4   | Forecast journal and the 'when' profile, conditional   | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision                                                                                       | Why                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| History is computed in the backend and exposed as 3 small fields; iOS never sees past months.  | Business rule (closed month, median) lives once; payload stays bytes, not 12 months of lines. Maxime's explicit call.                                                |
| Drift at a point in the period = `remaining(transactions dated ≤ t) − plannedRemaining`, via the shared `BudgetFormulas.calculateAllMetrics`. | Same arithmetic the iOS landing line already uses, so the profile measures exactly what the chart draws. No new formula to mirror. |
| Model family = normal-normal / Bühlmann credibility (`w = j/(j+K)`, `K = σ²_within/σ²_between`, bounded [3,14]); no per-envelope model, no Holt-Winters. | Literature + stats review + empirical search on Maxime's export (2026-08-22): only defensible family at n ≤ 12; per-envelope was worst held-out (627 vs 214 CHF at j+7). |
| The 'when' profile (`driftProfile`) is computed but not consumed until a prod forecast journal proves it on ≥ 2 users × 3 months. | Held-out win (94 vs 214 at j+7) rests on 3 months, mostly one; too thin to ship. |
| Projection stays flat before day 7. | No model beats ~300 CHF error at j+3 on the data; showing a bend there is noise dressed as insight. |
| Phase 2 is a gate: if the curve is not closer to the real landing than the straight line at j+7 and j+15, phase 3 is not started and Maxime is told. **Gate passed on 2026-08-22** (payday 27, 6 replayed months): straight 725 → prior 554 CHF at j+7, 274 → 262 at j+15; held-out split 623 → 214 / 234 → 158. | Agreed in brainstorm. A prettier curve that predicts worse is debt.                                                                                                  |
| Computed on the fly on `GET /budgets/:id/details` (30 s cache), no persisted column.          | Same data the sparse list already loads and decrypts. Persist only if the cost shows up.                                                                             |
