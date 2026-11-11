---
status: done
---

# Instruction: iOS : Sankey par Type et contraste

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/
├── Pulpe/Resources/Localizable.xcstrings ✏️
├── Pulpe/Features/NetWorth/Breakdown/
│   ├── NetWorthSankey.swift ✏️
│   ├── NetWorthSankeyLayout.swift ✏️
│   └── NetWorthBreakdownCard.swift ✏️
└── PulpeTests/Features/NetWorth/
    ├── NetWorthSankeyTests.swift ✏️
    └── NetWorthSankeyLayoutTests.swift ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Demo account with 3 Types, 25 elements, 2 debts | Patrimoine tab loaded | system |
| Happy path | Open the tab in light then dark | 3 Type nodes, labels readable, same shape as web phase 2 | system |
| Edge case | One Type and no debt | No breakdown card | system |
| Edge case | Net below zero | « Il manque » node kept, amber, never red | system |
| Teardown | none | Read-only | system |

## Tasks to do

### `1)` Same columns as web

> Types → Ce que j'ai → Dettes by Type / Fortune nette.

1. `NetWorthSankey.build`: drop the asset column and `hasCategoryColumn`; group debts by Type, with overdrafts under « Découverts »; return `nil` with one Type and no debt. Add « Découverts » to `Localizable.xcstrings` (fr, en, de, it); it is the only string this phase adds, so rebase on phase 4 if both are open.
2. Rewrite `NetWorthSankeyTests` (`flowsAssetsIntoTheirCategory…`, `flowsAssetsStraightIntoGross…` become Type-level cases).
3. Keep `NetWorthSankeyLayoutTests` green; adapt the column count.

### `2)` Contrast measured in both appearances

> Same thresholds as web.

1. Measure, in light and dark, `pulpePrimary` / `financialOverBudget` / `financialIncome` nodes against the card surface and the label inks against what is behind them (band at `sankeyBandOpacity` 0.3, pill `surfaceContainerLowest`).
2. Fix the failing pairs through the existing adaptive tokens; write the ratios in the PR.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `NetWorthSankeyTests`: 25 elements in 3 Types → 3 left nodes; one Type without debt → `nil` |
| 2 | Ratios in the PR: labels ≥ 4.5:1, nodes ≥ 3:1, light and dark |
