# Codebase Audit: Android — code quality

The code is consistently typed, formatted, named, and documented. The main maintainability hotspot is one route that has accumulated most of the budget-detail workflow.

- Date: 2026-08-16
- Scope: `android/src/**/*.ts(x)` and Android quality scripts
- Health: good
- Findings: 0 critical, 1 warning, 0 minor

## Findings

| Sev | Category     | Location                                     | Issue                                                                                                                                                                                         | Suggested fix                                                                                                                                                                         | Effort |
| --- | ------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Code quality | `android/src/app/(main)/budget/[id].tsx:139` | The 708-line route owns data loading, search/filter state, menus, multiple sheets, mutations, undo and withdrawal flows; its 13 local state slots make changes hard to reason about and test. | Keep the route as orchestrator, but extract the row-list/search state and overlay coordination into one or two focused units already shaped by the current UI; avoid a new framework. | M      |

## Top actions

1. Refactor `budget/[id].tsx` incrementally with `aidd-dev:07-refactor`, preserving behavior and adding one focused check per extracted stateful unit.

## Coverage

- Scanned: 285 TypeScript/TSX files (33,055 lines), largest files, state density, naming, comments, duplication patterns, TypeScript, ESLint and Prettier.
- Verified: `pnpm --filter pulpe-android quality` passes after building `pulpe-shared`.
- Skipped: dedicated unused-export and duplication scanners; neither is installed in the workspace.
