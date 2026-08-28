---
objective: "Every warning of the 2026-08-28 review is closed: Preview builds send no crash, the catalog guards see substitutions and run pre-commit, the template page's cold load is tested through its seam, and one CI run proves the new gates."
status: implemented
---

# Plan: Close the cold-page review

## Overview

| Field      | Value                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Fix the 7 warnings and the 4 cheap minors of `../2026_08_28_ios-cold-page-starts-its-load/review.md` (verdict `changes-requested`) without reopening the design; leave the two minors that need new infrastructure (composite action, a stub service for `ContextualCreationUITestHarness`) out. |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_28_ios-cold-page-starts-its-load/review.md`, Findings table, diff `c0c1fce73...4ed7e26e7`.                                                                                                             |

## Phases

| #   | Phase                                  | File                         |
| --- | -------------------------------------- | ---------------------------- |
| 1   | preview-builds-send-no-crash           | [`phase-1.md`](./phase-1.md) |
| 2   | catalog-parity-in-the-lexicon-guard    | [`phase-2.md`](./phase-2.md) |
| 3   | template-page-cold-load-through-seam   | [`phase-3.md`](./phase-3.md) |
| 4   | one-ci-run-proves-the-gates            | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision                                                                                              | Why                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The specifier-parity guard moves from `PulpeTests` (Swift) to `.github/scripts/lexicon.test.mjs`, and the Swift suite is deleted. | Reverses the previous plan's placement. The lexicon file already walks the same catalog for five invariants and runs in `pnpm quality` (pre-commit and every PR job), while the Swift suite ran only in the macOS job and re-implemented the walker. One walker, one place, and the walker must learn `substitutions` anyway or the Italian plural escapes every guard. |
| Crash autocapture follows `POSTHOG_ENABLED`, not the presence of a key.                               | `Preview.xcconfig` carries the production key with `POSTHOG_ENABLED = false`; a Preview TestFlight build must send nothing, crashes included. Gating `autoCapture` on `isConfiguredEnabled` keeps one switch for all traffic.                                                                     |
| `TemplateServicing` stays and gets its test, rather than being deleted.                               | The template page had the same blank-page bug as the budget page and the smoke covers only the budget journey; a ViewModel test through the seam is the cheapest guard for that page's cold path.                                                                                              |
