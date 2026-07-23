---
status: done
---

# Instruction: Frontend dedup and guard cleanup (findings #7, #8, #9)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp/src/app/
├── core/validators/
│   ├── safe-field-tree.ts                                           ✅ safeFieldTreeRead() — NG0950 catch, single-sourced (#8)
│   └── index.ts                                                     ✏️ re-export
├── pattern/
│   ├── amount-input/amount-input.ts                                 ✏️ #safeControl = computed(() => safeFieldTreeRead(…))
│   └── tag-picker/tag-picker.ts                                     ✏️ same
└── feature/budget/budget-details/
    ├── view-models/
    │   ├── table-items.view-model.ts                                ✏️ export isGroupHeaderRow() + isDataRow() next to TableRowItem (#7)
    │   ├── tag-filter.util.ts                                       ✏️ delete local isGroupHeader, import shared
    │   └── budget-item-data-builder.ts                              ✏️ delete local isDataItem, import shared (cumulativeBalance path)
    ├── components/
    │   ├── budget-table/budget-table.ts                             ✏️ matRowDef predicate delegates to isGroupHeaderRow
    │   ├── budget-table/cells/name-cell.ts                          ✏️ drop redundant @if around <pulpe-tag-indicator> (#9)
    │   ├── budget-grid/budget-grid-card.ts                          ✏️ drop redundant @if
    │   └── budget-grid/budget-grid-mobile-card.ts                   ✏️ drop INNER @if only — keep outer [indicators] projection gate
    └── allocated-transactions/details-dialog/
        ├── dialog.ts                                                ✏️ drop redundant @if
        └── bottom-sheet.ts                                          ✏️ drop redundant @if

PUL-18-TAG-REVIEW-FINDINGS.md                                        ❌ delete once phases 1-3 are done (file self-describes as delete-once-consumed)
```

## Tasks to do

### `1)` Canonical row guards (#7)

> One predicate next to the union it narrows; three call sites import it.

1. In `table-items.view-model.ts`: export `isGroupHeaderRow(row): row is GroupHeaderTableItem` and `isDataRow(row): row is BudgetLineTableItem | TransactionTableItem` (negation of the first).
2. Delete the private `isGroupHeader` in `tag-filter.util.ts` and `isDataItem` in `budget-item-data-builder.ts`; import the shared guards.
3. `budget-table.ts`: keep the `(_index, row)` arrow (matRowDef `when` signature) but delegate its body to `isGroupHeaderRow(row)`.

### `2)` Shared NG0950 workaround (#8)

> The unstable Angular error-string check lives in exactly one place.

1. Create `core/validators/safe-field-tree.ts` with `safeFieldTreeRead<T>(read: () => FieldTree<T>): FieldTree<T> | null` (type-only `FieldTree` import from `@angular/forms/signals`, precedent: `touched-field-errors.ts`); re-export from `index.ts`.
2. Both `#safeControl` computeds become `computed(() => safeFieldTreeRead(() => this.control()))`; delete the duplicated try/catch bodies (`pattern/` may import `@core/`).

### `3)` Drop redundant empty guards (#9)

> The component already no-ops on an empty array; call sites stop re-checking.

1. Remove the `@if (tagNames().length > 0)` / `@if (tagNamesFor(tx.tagIds).length > 0)` wrappers at the 5 sites; render `<pulpe-tag-indicator …/>` directly.
2. `budget-grid-mobile-card.ts`: keep the outer `@if (…isPropagationLocked || …isSpread || tagNames().length > 0)` projection gate verbatim — it gates the `[indicators]` slot, not the indicator.

### `4)` Verify and clean up

> No visual change; the review scratch file leaves the repo.

1. Run touched frontend specs + `pnpm quality` (build inside `shared/` first if Vitest serves stale specs).
2. Delete `PUL-18-TAG-REVIEW-FINDINGS.md` — only after phases 1-3 are also done.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | Budget table renders identically (group headers, trackBy, tag filter, cumulativeBalance unchanged); guards exist once, in `table-items.view-model.ts`. |
| 2    | amount-input and tag-picker still render without NG0950 on first paint; the error-string check exists once, in `core/validators`. |
| 3    | Rows/cards/dialogs with zero tags show no indicator (component-internal no-op); with tags, indicator unchanged. |
| 4    | `pnpm quality` green; findings file gone. |
