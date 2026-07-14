---
objective: "Make the template loading-error E2E test independent of the local application port and prove it passes repeatedly without retries."
status: in-progress
---

# Plan: Stabilize template details error E2E

## Overview

| Field | Value |
| ----- | ----- |
| **Goal** | Remove the test's fixed localhost origin and verify the error flow remains deterministic across Playwright server ports. |
| **Source** | User request: "il ne faut aucun flaky" after the observed `template-details-view.spec.ts:67` failure. |

## Phases

| # | Phase | File |
| - | ----- | ---- |
| 1 | Make template error navigation hermetic | [`phase-1.md`](./phase-1.md) |
