---
status: pending
---

# Instruction: iOS Patrimoine at large text

## Architecture projection

```txt
.
└── ios/Pulpe/Features/NetWorth/
    ├── AssetFormSheet.swift ✏️
    └── Breakdown/NetWorthBreakdownCard.swift ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Simulator at AX5, `net_worth` flag on (UserDefaults override, see `FeatureFlagsStore`), demo account; the seed has no assets, so add one and a debt in the app | Patrimoine shown | system |
| Happy path | Open « Ajouter à mon patrimoine », scroll to « Sens » and « Type »; scroll to « Répartition aujourd'hui » | « Sens » segments and the chosen type read in full; every node of the diagram is listed under it with its amount | system |
| Edge case  | Same screens at the default size | Diagram labels stay beside the nodes, no list; « Type » row unchanged | system |

## Tasks to do

### `1)` Asset sheet type row

> The chosen type no longer breaks mid-word.

1. Stack « Type » and its value at accessibility sizes, chevron kept on the right.

### `2)` Breakdown labels

> The diagram is drawn in points, so its labels move to a legend at accessibility sizes.

1. Hide the in-diagram labels and their headroom at accessibility sizes.
2. List each node with its colour, title and amount under the diagram.
3. `ios/DESIGN.md` `NetWorthBreakdownCard` states the legend at accessibility sizes.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | At AX5 the type value wraps on whole words under « Type » |
| 2    | At AX5 no breakdown label is truncated or clipped by the card; at the default size the diagram is unchanged |
