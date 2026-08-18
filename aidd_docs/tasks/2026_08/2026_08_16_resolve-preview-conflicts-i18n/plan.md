---
objective: "The i18n branch contains the current preview tip, preserves the native iOS segmented-picker work and all FR/EN/DE/IT behavior, and passes the production merge gates."
status: implemented
---

# Plan: Resolve `preview` conflicts on the i18n branch

## Overview

| Field      | Value                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Merge the current `origin/preview` into `feat/i18n-en-de-it`, resolve the two iOS conflicts without losing either localization or the native picker refactor, and validate the resulting branch. |
| **Source** | User request from 2026-08-16; read-only merge simulation of `0f19dc12b` with `origin/preview` at `3f8181e3d`.                                                                                    |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Integrate preview and reconcile iOS picker changes | [`phase-1.md`](./phase-1.md) |
| 2   | Prove merge readiness and publish the resolution   | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                         | Why                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Merge `origin/preview` into the published feature branch instead of rebasing it  | The branch is already remote and reviewed; a merge preserves the published history and records exactly which preview tip was integrated.                                 |
| Keep preview's native `SegmentedPicker` and the i18n branch's `AppLocale` titles | `preview` deliberately removes `CapsulePicker`; retaining it would undo PR #603, while passing raw `String` titles would render French under a non-French Pulpe locale.  |
| Treat clean auto-merges as review targets, not automatically safe changes        | The preview commit and the i18n branch both touch the same iOS product surfaces; a syntactically clean merge can still reintroduce a locale or accessibility regression. |
