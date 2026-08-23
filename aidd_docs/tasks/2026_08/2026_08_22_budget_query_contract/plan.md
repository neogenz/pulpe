---
objective: "Budget list query modifiers are accepted only when sparse fields make them effective, so validated requests can no longer be silently ignored or cached under misleading keys."
status: implemented
---

# Plan: Enforce the budget list query contract

## Overview

| Field      | Value                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Reject ineffective `limit`, `offset`, and `year` parameters unless a non-empty sparse `fields` selection is provided   |
| **Source** | Pull-request review comment on `shared/schemas.ts:1993`, confirmed by Maxime for planning and immediate implementation |

## Phases

| #   | Phase                                          | File                         |
| --- | ---------------------------------------------- | ---------------------------- |
| 1   | Align validation, regression tests and Swagger | [`phase-1.md`](./phase-1.md) |
