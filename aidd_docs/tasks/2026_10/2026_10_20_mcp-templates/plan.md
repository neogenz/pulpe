---
objective: "An agent connected to Pulpe reads, creates, renames, deletes and duplicates templates, edits template lines with an explicit propagation scope, and adjusts a forecast or an allocated movement over several months, asking instead of guessing whenever the scope or the target is unclear."
status: implemented
---

# Plan: Templates and multi-month adjustments through the agent connector

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Seven new MCP tools (`get_template`, `create_template`, `update_template`, `delete_template`, `duplicate_template`, `edit_template_lines`, `adjust_over_months`) over ports exported by the template module, plus their activity labels |
| **Source** | Linear [PUL-360](https://linear.app/pulpe/issue/PUL-360/gerer-mes-modeles-et-ajuster-une-prevision-sur-plusieurs-mois-depuis) (CA1-CA16), intent brief [`../2026_10_20_mcp-tags-templates-budget-delete/brainstorm.md`](../2026_10_20_mcp-tags-templates-budget-delete/brainstorm.md) |

## Phases

| #   | Phase                                                                   | File                         |
| --- | ----------------------------------------------------------------------- | ---------------------------- |
| 1   | Template module: read/write ports, duplicate, bounded propagation, in-use months | [`phase-1.md`](./phase-1.md) |
| 2   | MCP tools: get, create, update, delete, duplicate a template            | [`phase-2.md`](./phase-2.md) |
| 3   | MCP tool: `edit_template_lines` with an explicit scope                  | [`phase-3.md`](./phase-3.md) |
| 4   | MCP tool: `adjust_over_months`                                          | [`phase-4.md`](./phase-4.md) |
| 5   | iOS activity labels for the six new write tools                        | [`phase-5.md`](./phase-5.md) |

Order: 1 → 2 → 3 → 4 → 5. Phase 4 needs nothing from phase 1, but phases 2, 3 and 4 all append to the same files (`mcp.module.ts` `TOOLS`, the four i18n catalogs, `mcp-oauth.integration.spec.ts`), so they land one after the other. Phase 5 is the only Swift change and builds once.

This plan lands on the same branch as PUL-359 (tags through the agent), whose phases land first. Every shared file is an append: add after PUL-359's entries in `TOOLS`, in the `settings.connections.tools` blocks, in the iOS label table, and in the integration spec's `reads` / `writes` / `destructive` / idempotent lists. Tool counts in this plan are written as `N + k`, where `N` is the catalog size once PUL-359 has landed (15 if it has not).

Each new write tool gets its web label in the same phase that adds it: `catalog-parity.spec.ts` reads `tools/write/*.tool.ts` and fails on a write tool without a label in all four catalogs.

## Decisions

| Decision | Why |
| -------- | --- |
| The MCP module reaches templates only through `BUDGET_TEMPLATE_READ_PORT` (extended with `get`) and a new `BUDGET_TEMPLATE_WRITE_PORT`, both bound with `useExisting` to in-process use cases in `budget-template/application/`. | ADR-0002 and `lint:arch` (`no-cross-module-direct`) forbid importing another module's `application/`; this is the pattern every existing MCP tool follows. |
| `DuplicateTemplateUseCase` copies at repository level (`validateAccess`, `validateTemplateLimit`, `createTemplateWithLines`) instead of calling `CreateTemplateUseCase`. | An exact copy keeps each line's historical FX rate (BUSINESS_RULES: « Ce taux est historique »), whereas the create path re-fetches rates; source rows may also fail the create DTO (`description` null, amount 0). |
| Bounded propagation is an optional fourth argument of `BulkTemplateLineOperationsUseCase.execute`, filtering `fetchPropagationBudgets`; the shared DTO, the REST endpoint and the RPC do not change. | `templateLinesBulkOperationsSchema` is a `strictObject` shared with web and iOS (a new key breaks deployed clients), and the RPC already takes an explicit `budget_ids` list. |
| `adjust_over_months` orchestrates in `mcp/application/adjust-over-months.use-case.ts` over `BUDGET_MONTH_READ_PORT`, `BUDGET_LINE_WRITE_PORT`, `TRANSACTION_WRITE_PORT` and `ResolveCurrencyUseCase`, and returns a result union that the tool renders. | No module owns "the same forecast across months"; the application layer cannot import `askUser` from infrastructure, so the tool turns "ambiguous" into the question. |
| A refusal the user cannot fix by answering a question is a `BusinessException` (tool result `isError`, activity outcome `error`); missing information is `askUser` (no write). Template in use: `RemoveTemplateUseCase` now puts the months in `TEMPLATE_IN_USE`, so REST and MCP get the same list. | `error-handling-backend.md` forbids raw Nest exceptions; an `ok` outcome on a refused delete would show « Modèle supprimé » in Réglages > Connexions although nothing was deleted. |
| `adjust_over_months` takes `chosenIds` so the ambiguity question can be answered on the next call. | The stateless transport answers questions by a second call; without a field to carry the answer, the same call would ask the same question forever. |
