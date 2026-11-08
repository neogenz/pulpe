---
status: pending
---

# Instruction: Breakdown diagram

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete. Files created by an earlier phase of this plan are marked `modify (phase n)`.

```txt
.
└── ios/
    ├── DESIGN.md ✏️
    ├── Pulpe/
    │   ├── Features/
    │   │   └── NetWorth/
    │   │       ├── NetWorthView.swift modify (phase 3)
    │   │       └── Breakdown/
    │   │           ├── NetWorthSankey.swift ✅
    │   │           ├── NetWorthSankeyLayout.swift ✅
    │   │           └── NetWorthBreakdownCard.swift ✅
    │   ├── Shared/
    │   │   └── Design/
    │   │       └── DesignTokens+Chart.swift ✏️
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        └── Features/
            └── NetWorth/
                ├── NetWorthSankeyTests.swift ✅
                └── NetWorthSankeyLayoutTests.swift ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | `NetWorth` fixtures from `TestDataFactory` mirroring the six cases of `net-worth-sankey.flows.spec.ts` (lines 38, 70, 107, 137, 155, 186) | Same inputs as the web spec | cli |
| Happy path | Each fixture through `NetWorthSankey.build(_:)` | Same nodes, flows, columns and priorities as the web spec expects | cli |
| Happy path | Simulator, UBS 12 000 CHF, Livret 3 000 EUR, Leasing 8 000 CHF | Card « Répartition aujourd'hui » under the hero: assets → categories → Ce que j'ai → Ce que je dois and Fortune nette; same shape as the web page for the same account | simulator |
| Edge case  | Every category holds one asset | No category column | cli |
| Edge case  | Debts above gross | « Il manque » node feeds the shortfall; the net node is absent; subtitle « De ce que j'ai à ce que je dois » | cli |
| Edge case  | Overdrawn own asset | Flows from gross to the debts side, never into its category | cli |
| Edge case  | Gross ≤ 0 or no own asset | No card at all | cli |
| Edge case  | Layout in a 320pt width | Node heights proportional to flow, bands never overlap, min node height from tokens; the card scrolls horizontally with the drag hint | cli |
| Edge case  | VoiceOver on the card | One element reading `sankey.ariaNet` or `ariaDebts` with formatted totals | simulator |
| Edge case  | Amounts hidden | Node labels blurred | simulator |
| Teardown   | Delete the test assets, remove the plist key | Baseline restored | simulator |

## Tasks to do

### `1)` Port the mapping

> Same graph as the web from the same API figures; widths only, no money computed.

1. `NetWorthSankey.build(_ netWorth: NetWorth) -> Graph?`: port of `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-sankey.flows.ts`, same node ids (`asset:<id>`, `category:<id>`, `gross`, `net`, `debt:<id>`, shortfall), the category column only when `categoryIds.count < owned.count`, shortfall column and priorities, `nil` when gross ≤ 0. Flow widths as `Double` from the API `convertedValue` or `latestValue`; no total recomputed for display.
2. `NetWorthSankeyTests`: the six web cases, one `@Test` each, with the web assertions.

### `2)` Pure layout

> Geometry testable without a view.

1. `NetWorthSankeyLayout.layout(_ graph:, in size: CGSize) -> [NodeFrame], [LinkBand]`: columns spread across the width, node height proportional to its largest in/out flow over the column scale, priorities ordering inside a column, gap and minimum height from `DesignTokens.Chart`, link bands as cubic bezier paths between stacked offsets.
2. `NetWorthSankeyLayoutTests`: proportional heights, no overlap within a column, bands start and end on their node frames, min height respected.

### `3)` Card

> The diagram on screen, tokens only.

1. `NetWorthBreakdownCard`: title and subtitle (`netWorth.sankey.*`), a `Canvas` drawing the bands and nodes in a horizontal `ScrollView` whose content keeps `DesignTokens.Chart.sankeyMinWidth`, node labels with `asCompactCurrency(totals.baseCurrency)` and `.sensitiveAmount()`, colors from existing asset/debt/net semantic colors; `.accessibilityElement(children: .ignore)` with one label.
2. New tokens in `DesignTokens+Chart.swift`: `sankeyMinWidth`, `sankeyNodeWidth`, `sankeyNodeGap`, `sankeyMinNodeHeight`, `sankeyHeight`, `sankeyBandOpacity`.
3. `NetWorthView` shows the card under the hero when `build` returns a graph.
4. `ios/DESIGN.md` V2 building blocks: one line for the breakdown card.
5. Copy from `netWorth.sankey.*` with `de`, `en`, `it`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `NetWorthSankeyTests` pass the six web cases with a non-zero executed count |
| 2    | `NetWorthSankeyLayoutTests` pass |
| 3    | The simulator card matches the web shape for the same account and is absent with nothing owned; `pnpm test:lexicon`, `swiftlint lint --strict` and `xcodebuild build -scheme PulpeLocal -configuration Local` pass |
