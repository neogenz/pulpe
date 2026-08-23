---
objective: "Every finding of the PR #678 review is closed: the TS trajectory mirrors the Swift one, a failed history query never bends the projection, and the details endpoint measures or skips the history cost."
status: implemented
---

# Plan: PR #678 review fixes

## Overview

| Field      | Value                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| **Goal**   | Close the 🔴 and 🟡 rows (and the two 🟢 code rows) of `2026_08_21_ios-design-refonte/review.md` |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_21_ios-design-refonte/review.md`                       |

## Phases

Phases are independent: one file set each, no shared edits, run them in parallel.

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | TS trajectory mirrors `real` and `trendBalance`    | [`phase-1.md`](./phase-1.md) |
| 2   | History query errors surface instead of faking data | [`phase-2.md`](./phase-2.md) |
| 3   | History cost measured, skipped off the current period | [`phase-3.md`](./phase-3.md) |
| 4   | Chart body hoists its series, eyebrow is one key   | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Mirror the full Swift surface (`real`, `plannedAvailable`, `trendBalance` with prior) in TS rather than declaring the chart iOS-only. | The rule is absolute and the web may draw the same chart later; an exemption is a second source of truth. |
| `fetchHistoryData` throws on query error; the use case catches and returns `history: null`. | Details must still load when history fails; a null prior is the documented "no history" state, a zeroed one is a lie. |
| History computed only when the budget is the current pay-day period. | Past budgets never show a projection; the 30 s cache does not help a list of past months. |
