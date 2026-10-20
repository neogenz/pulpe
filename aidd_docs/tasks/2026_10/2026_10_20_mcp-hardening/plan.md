---
objective: "Every MCP write tool reports, and logs, only what it actually changed; get_month shows a realized planned withdrawal as Pointé; iOS names every write tool in French; the consent screen shows the host the access is sent to."
status: implemented
---

# Plan: Reliable MCP tools and an honest consent screen

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Close the ten audit gaps (CA1-CA10) between what the agent connector says and what it writes, without changing any REST behaviour iOS relies on |
| **Source** | Linear [PUL-362](https://linear.app/pulpe/issue/PUL-362/fiabiliser-les-outils-du-connecteur-mcp-et-lecran-de-consentement) (CA1-CA10); evidence: the adversarially verified MCP audit (13 findings, deduplicated into the ticket's ten CAs) |

## Phases

| #   | Phase                                                                 | File                         |
| --- | --------------------------------------------------------------------- | ---------------------------- |
| 1   | Questions stay out of the activity log, and tool-level refusals (CA8, CA4, CA5, CA6) | [`phase-1.md`](./phase-1.md) |
| 2   | Agent write ports and the allocated-movement kind rule (CA1, CA2, CA3) | [`phase-2.md`](./phase-2.md) |
| 3   | Planned withdrawal state in month reports (CA7)                      | [`phase-3.md`](./phase-3.md) |
| 4   | Consent screen shows where access is sent (CA10)                     | [`phase-4.md`](./phase-4.md) |
| 5   | iOS activity labels for the eight write tools (CA9)                  | [`phase-5.md`](./phase-5.md) |

Phase 1 lands first: its `askUser` marker is what makes the phase-1 refusals leave no activity row, and PUL-359 (tags) and PUL-360 (templates), planned on the same branch, call `askUser` unchanged on top of it. Phases 2 to 5 can land in any order after it; the only file two phases share is the gated `mcp-oauth.integration.spec.ts`, where phases 1 and 4 each edit a separate test. Phase 5 is the only Swift change and builds once.

This plan lands before PUL-359 and PUL-360 on `claude/mcp-tags-models-crud-4b8b54`. Their plans already edit `month-report.ts` (PUL-359 phase 3 changes `renderMonth`'s signature), `ConnectionDetailView.label(for:)` (both append cases) and add optional fields to update tools: they rebase on the shapes this plan leaves, and the "nothing to change" guard of phase 1 is written over every argument except the id so a later `tagIds` is covered without an edit.

## Decisions

| Decision | Why |
| -------- | --- |
| A tool reply that wrote nothing carries `wrote: false` on `McpToolResult`; only `askUser` sets it, and `CallToolUseCase` records no activity row for it. | One check in the single dispatch point covers the three current elicitations, the phase-1 refusals and every later tool. The marker lives on the domain type, so the application layer reads it without importing `askUser` from infrastructure (the constraint PUL-360 already names). |
| Missing or contradictory input the user can settle (currency without amount, nothing to change, a goal on a non-Épargne forecast) is an `askUser` question; a target that does not exist (CA3) is a `BusinessException`, so the call is `isError` and the log says « (échec) ». | Same split as PUL-360's decision table. `error-handling-backend.md` forbids raw Nest exceptions, so the not-found reply is the module's existing `TRANSACTION_NOT_FOUND`, the same error `update_movement` and `toggle_check` already return for a wrong id. |
| CA1 and CA3 are enforced in the in-process write ports (`WriteBudgetLinesInProcessUseCase.update` forces `isManuallyAdjusted: true`; `WriteTransactionsInProcessUseCase.remove` asks `RemoveTransactionUseCase` to require an existing row), not in REST nor in the tool. | Both ports have one consumer, the MCP module (grep: only `tools/write/*`). `DELETE /transactions/:id` stays idempotent for iOS (tested at `remove-transaction.use-case.spec.ts` "PGRST116 path"), and PUL-360's `adjust_over_months`, which updates forecasts through the same port, inherits the manual-adjustment protection. |
| CA2 is a domain invariant (`TransactionInvariants.validateKindMatchesLine`) called by both `CreateTransactionUseCase` and `UpdateTransactionUseCase`. | The root cause is the update use case, shared by `update_movement` and iOS `PATCH /transactions/:id` (iOS lets the kind change on an allocated movement). One rule, two callers, same `TRANSACTION_VALIDATION_FAILED` reason as creation. |
| CA7 reuses `BudgetFormulas.calculateConsumption` (shared, mirrored in Swift) and applies the app's presentation rule in `renderMonth`: a live planned withdrawal is Pointé when `available <= 0`. No new shared formula. | The pointed-state rule lives in the web builder (`budget-item-data-builder.ts:287`) and iOS `BudgetLine.isPointed(allocated:)` as presentation, not in `shared/src/calculators`. `formula-mirrors-ts-swift.md` forbids extending the mirror doctrine; the consumption it compares against is already the shared one. |
| The consent details carry `redirectHost`: the `hostname` of the `redirect_uri` stored on the pending authorization, required in `mcpConsentDetailsResponseSchema`. | The server already holds the URI the code will be sent to; `URL.hostname` drops path, port and query and returns punycode for an IDN, so a look-alike domain cannot render as `claude.ai`. Required, not optional: a page that cannot show the host fails closed instead of asking for the PIN without it. |
