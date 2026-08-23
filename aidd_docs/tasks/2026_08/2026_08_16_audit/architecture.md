# Codebase Audit: Android — architecture

The app has a clear Expo Router → feature → API structure, shared Zod contracts, central query caching and a coherent vault gate. One dependency points against that layering, and the project memory has not caught up with the Android client.

- Date: 2026-08-16
- Scope: Android module boundaries, data flow, shared contracts and architecture memory
- Health: good
- Findings: 0 critical, 1 warning, 1 minor

## Findings

| Sev | Category     | Location                                 | Issue                                                                                                                                                | Suggested fix                                                                                                                             | Effort |
| --- | ------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Architecture | `android/src/core/tags/tag-queries.ts:4` | A `core` module imports `budgetKeys` from a feature, reversing the intended dependency direction and coupling generic tag infrastructure to budgets. | Move tags under `features`, or move only the neutral cache-key registry to `core`; choose the smaller move based on existing tag callers. | S      |
| 🟢  | Architecture | `aidd_docs/memory/architecture.md:4`     | The architecture memory and diagram list web, API and iOS but omit Android, so future agent work can reason from an incomplete system map.           | Add Android once to the stack, C4 flow and mobile memory; keep platform-specific design rules in `android/DESIGN.md`.                     | S      |

## Top actions

1. Restore the `core` → feature boundary with `aidd-dev:07-refactor`.
2. Refresh the project memory with `aidd-context:02-project-memory` after the code boundary is settled.

## Coverage

- Scanned: route composition, `core`/`features` imports, TanStack Query ownership, Zustand stores, API boundary, `pulpe-shared` contracts and architecture/design memory.
- Confirmed: server data remains authoritative and vault-gated; no Android-side formula fork was found.
- Skipped: dedicated circular-dependency analyzer; `madge` or an equivalent tool is not installed, so cycle review was static.
