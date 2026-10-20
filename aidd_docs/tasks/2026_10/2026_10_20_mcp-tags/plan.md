---
objective: "A read_write agent can list, create, rename and delete the user's tags and add or remove tags on up to 50 movements or prévisions in one call, every month and search rendering shows tag names, and each new write tool has an activity label on web and iOS."
status: in-progress
---

# Plan: Tags through the MCP connector

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Five MCP tools (`list_tags`, `create_tag`, `rename_tag`, `delete_tag`, `tag_items`), tag names in `get_month` / `get_current_month` / `search_movements`, a tag filter on `search_movements`, activity labels on web and iOS |
| **Source** | Linear [PUL-359](https://linear.app/pulpe/issue/PUL-359/laisser-lagent-ranger-mes-mouvements-et-previsions-avec-mes-tags); intent brief [`brainstorm.md`](../2026_10_20_mcp-tags-templates-budget-delete/brainstorm.md) |

## Phases

| #   | Phase                                                       | File                         |
| --- | ----------------------------------------------------------- | ---------------------------- |
| 1   | Tag module exposes in-process read and write ports          | [`phase-1.md`](./phase-1.md) |
| 2   | Item tag ids reachable in process (find + search results)   | [`phase-2.md`](./phase-2.md) |
| 3   | MCP read side: `list_tags`, tag names, search by tag        | [`phase-3.md`](./phase-3.md) |
| 4   | MCP tag CRUD: `create_tag`, `rename_tag`, `delete_tag`      | [`phase-4.md`](./phase-4.md) |
| 5   | MCP bulk tagging: `tag_items`                               | [`phase-5.md`](./phase-5.md) |
| 6   | Tool catalog surfaces: activity labels and the e2e contract | [`phase-6.md`](./phase-6.md) |

Phases 1 and 2 are independent backend groundwork. Phase 3 needs both (the MCP module imports `TagModule` there and the tag-name helper lands in `month-report.ts`). Phases 4 and 5 both need 1 and 3, and 5 also needs 2; run them one after the other because both append to the `TOOLS` array in `mcp.module.ts`. Phase 6 needs 3, 4 and 5: it is the only phase that edits the explicit tool lists of the gated integration spec, so those lists change once.

## Decisions

| Decision | Why |
| -------- | --- |
| `TagModule` exposes two in-process ports, `TAG_READ_PORT` (`list`) and `TAG_WRITE_PORT` (`create`, `rename`, `remove`), bound with `useExisting` to `ReadTagsInProcessUseCase` / `WriteTagsInProcessUseCase`, which delegate to the existing use cases. The "unknown id → 404" rule for removal lives in the in-process write path; REST `DELETE /tags/:id` keeps answering 200. | ADR-0002 forbids the MCP module from reaching `tag/application`. Changing the REST status code is a contract change (`api-contract-changes.md`, "Risque") that the ticket does not ask for. |
| An item's current tags are read through a new `find(id)` on the existing `TransactionWritePort` and `BudgetLineWritePort`, delegating to the existing `FindTransactionUseCase` / `FindBudgetLineUseCase`. No new read port. | `tag_items` reasons in add/remove while the API replaces the whole set, so it must read before writing. Both find use cases already exist and are already providers; adding one method to each existing port is the smallest change. |
| Search results carry `tagIds` through an unfiltered `all_tags:` embed on the search selects; the shared `transactionSearchResultSchema` gains `tagIds` as optional (the backend always fills it). | CA2 needs tag names on `search_movements`. The `!inner` embed used to filter by tag returns only the matched links, so a second, unfiltered alias is needed. Optional keeps web fixtures and older clients untouched (additive response field, non-breaking). |
| `tag_items` writes item by item through the existing update use cases (atomic `update_*_with_tags` RPC each), sequentially. A 4xx on an item lists it as failed and the loop continues; anything else aborts the call. | The ticket forbids a new RPC. Add/remove sets converge, so re-running after an abort is safe. Known ceiling: one budget recalculation per written item. |
| French messages for "tag not found" and "name already taken" are produced in the MCP layer from the tag module's `BusinessException` codes. | The domain error definitions stay English like every other module; the agent-facing copy is French like every MCP tool. |
