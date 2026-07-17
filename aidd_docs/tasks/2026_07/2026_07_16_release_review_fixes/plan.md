---
objective: "Every warning-level finding of the 2026_07_16 release review is fixed or formally re-ticketed, with the release verdict path clear of `fix`-tagged criteria."
status: implemented
---

# Plan: Release review fixes — warnings v0.37.1 → preview

## Overview

| Field      | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Goal**   | Fix the 10 confirmed warnings from the release review (code on web/iOS/backend, ops on Linear) |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_16_release_review_preview_since_v0_37_1/review.md`             |

## Phases

| #   | Phase                                                    | File                         |
| --- | -------------------------------------------------------- | ---------------------------- |
| 1   | Webapp — PUL-205 dialog/toast, PUL-217 URL, aria-label   | [`phase-1.md`](./phase-1.md) |
| 2   | iOS — PUL-186 first-install, PUL-205 toast, destination  | [`phase-2.md`](./phase-2.md) |
| 3   | Backend — releases-data ↔ landing parity gate            | [`phase-3.md`](./phase-3.md) |
| 4   | Types — regenerate database.types.ts on clean local DB   | [`phase-4.md`](./phase-4.md) |
| 5   | Linear ops — PUL-138 residue, PUL-186 copy decision      | [`phase-5.md`](./phase-5.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| CA13 fixed via `autoFocus` selector in `SettingsDialogService.open` config, NOT `cdkFocusInitial` in the shared `ConfirmationDialog` | The dialog is shared with destructive `warn` confirms (delete flows); auto-focusing confirm globally would make Enter destructive there |
| Keep the unused `title` field in the whats-new payload | Deployed iOS binaries decode the current shape; removing a field risks silent decode failure (fail-open hides it) for non-updated apps. CA3 resolved by documenting the copy decision on Linear |
| Parity gate = backend spec reading `landing/data/releases.json` via fs, not a new CI workflow | Runs inside the existing backend CI test job; zero pipeline config, fails exactly when either file drifts |
| PUL-186 CA6 fixed inside `WhatsNewFlagsStore.init` (seed marker on fresh install), not in `AppState.bootstrap` | The store already owns the pre-bootstrap capture ordering; seeding there needs no cross-concern coupling and keeps bootstrap untouched |
| PUL-138 residue: reopen the existing issue with an explicit item list, not a new issue | The inventory, phasing table, and audit history already live on PUL-138; a new ticket would orphan that context |
