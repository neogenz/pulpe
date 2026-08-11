---
objective: "PR #510 contains only durable savings-goal product code, regression tests, migrations, and maintained documentation, with all merge gates green."
status: implemented
---

# Plan: Prepare `pul-12-epic` for merge

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Remove local-generation and one-off capture artifacts, retain durable contracts and tests, then prove PR #510 is merge-ready. |
| **Source** | User request concerning worktree `../pulpe-pul12-epic` and GitHub PR #510, verified against `origin/preview...pul-12-epic` on 2026-07-14. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | remove-work-artifacts-and-consolidate-docs | [`phase-1.md`](./phase-1.md) |
| 2   | remove-one-off-capture-and-keep-contract-tests | [`phase-2.md`](./phase-2.md) |
| 3   | close-the-failing-gate-and-verify-merge-readiness | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| [GitHub PR #510](https://github.com/neogenz/pulpe/pull/510) | Base is `preview`; PR is open and mergeable, but the feature E2E gate currently fails. |
| [Failed GitHub Actions run](https://github.com/neogenz/pulpe/actions/runs/29284559619/job/86934899914) | The sole feature-test failure looks for `savings-goal-Vacances été 2027`; the component contract uses the goal ID. |

## Decisions

| Decision | Why |
| -------- | --- |
| Keep one savings source of truth: migrate the few unique durable simulator rules into `docs/SAVINGS.md`, then delete `docs/SAVINGS_PLAN.md`. | `SAVINGS_PLAN.md` mixes durable rules with completed implementation planning, file inventories, phasing, risks, and Linear backlog; code references alone do not justify retaining that coupling. |
| Keep the LikeC4 savings diagram and its dedicated config, but align its status with the implemented feature. | The diagram is required project documentation; only its “BRAINSTORM, rien validé” framing is stale. |
| Keep the schema contract tests, but rename the ticket-coded file by responsibility. | The assertions protect durable public schemas; only the `savings-goal-pul12.spec.ts` name is temporary/project-management-oriented. |
