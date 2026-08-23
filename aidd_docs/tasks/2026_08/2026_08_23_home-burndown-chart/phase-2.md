---
status: pending
---

# Instruction: Le graphe dessine plan, réel, estimé

## Architecture projection

```txt
ios/Pulpe
├── Features/CurrentMonth/Components/HomeHeroCard+Chart.swift   ✏️ three series, labels, domain, a11y
├── Features/CurrentMonth/Components/CurrentMonthSkeletonView.swift ✏️ skeleton mirrors plan line + falling real line
├── Shared/Design/DesignTokens+Chart.swift                       ✏️ leadingInset
└── ios/PulpeTests/Features/CurrentMonth/HomeHeroCardTests.swift ✏️ domain + a11y + label position
```

## Wireframe

```txt
│ ●╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ Prévu │
│  ━━━━━╲                                                           │
│        ━━━━━━━╲                                                   │
│                ━━━━●╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ Si tu continues : 9'237  │
│              Aujourd'hui                                          │
│ 1er août                                                 31 août  │
```

## Tasks to do

### `1)` Three series

1. Plan: `LineMark` day 0 → totalDays, `plannedAvailable` → `plannedBalance`, `heroInkSecondary` muted, `markerDash`. Word « Prévu » at its end (no amount).
2. Real: `LineMark` + `AreaMark` on `trajectory.real`, solid `heroInk`, `.monotone`.
3. Estimate: `projection(for:)` starts at `real.last` and ends at `trend`; dashed, label « Si tu continues : X » (`showsTrendLabel` compares trend with `real.last` balance gap against `span`).
4. Today dot on `real.last`, « Aujourd'hui » below-trailing.
5. `chartYDomain`/`span` read plan + real + trend values; floor on `plannedOutflows` kept; `leadingInset` 16 pt on the plot.
6. a11y label: « Disponible prévu X. Prévu fin de mois Y. Réel aujourd'hui Z. » + trend sentence when shown; hidden variant unchanged. Keys in 4 locales.

### `2)` Skeleton

1. `chartSkeleton`: dashed diagonal from top-left to ~bottom-right (plan), thick curve from top-left falling to 2/3 width (real), dashed tail on.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `HomeHeroCardTests` + `HomeHeroCardTrendTests` green; screenshot on device: three strokes readable, no label crossed |
| 2 | Skeleton and loaded chart share the same silhouette |
