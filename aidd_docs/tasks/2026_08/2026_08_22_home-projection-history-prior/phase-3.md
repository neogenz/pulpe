---
status: done
---

# Instruction: iOS projection bends with the prior, guarded

## Architecture projection

```txt
.
├── ios/Pulpe/Domain/Models/Budget.swift                                   ✏️ `DriftHistory` {usualOutflowDrift, closedMonths, priorStrength, driftMad, driftProfile}; optional `history` on the details payload
├── ios/Pulpe/Domain/Formulas/BalanceTrajectory.swift                      ✏️ `trendBalance(history:)` keeps its shape; prior = usual drift, K from history, MAD cap, flat before day 7
├── ios/Pulpe/Domain/Store/CurrentMonthStore.swift                         ✏️ keep `history` from the details response, hand it to the trajectory
├── ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard+Chart.swift    ✏️ unchanged shape; `trendPriorDays` replaced by `history.priorStrength` (fallback 7)
├── ios/Pulpe/App/ContextualCreationUITestHarness.swift                    ✏️ `UITEST_CHART_STATE` gains a history variant
├── ios/PulpeTests/Features/CurrentMonth/HomeHeroCardTrendTests.swift       ✏️ no history = today's numbers; prior bends; sign/MAD guardrails; flat before day 7
├── ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard+Chart.swift    ✏️ (same file) projection in `.settling` state while a home mutation is in flight: shimmer on the dashed stroke, label faded; spring to the new position on response
├── ios/Pulpe/Domain/Store/CurrentMonthStore.swift                         ✏️ (same file) `isSettling` true from mutation start to server response or rollback
└── ios/DESIGN.md                                                          ✏️ one sentence: the projection leans toward where the user usually lands; while the server settles an entry, the dashed stroke shimmers and then springs
```

## User Journey

```mermaid
flowchart TD
  A[home loads details] --> B{history?}
  B -->|null| C[dashed line = straight trend, as today]
  B -->|present| D[dashed line leans toward usualOutflowDrift × plannedOutflows, blended with this month's pace by K, capped by driftMad]
  D --> E[label "à ce rythme X" = last point; hero unchanged]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    launch harness with UITEST_CHART_STATE=history => home shows the hero chart: 5: system
  section Happy path
    read the dashed stroke => one segment from today whose end differs from the no-history end by the prior term: 5: browser
    read the label => "à ce rythme" prints the last point's amount: 5: browser
  section Edge case - no history
    UITEST_CHART_STATE=deficit => launch => dashed stroke is one straight segment, label as before: 1: browser
  section Edge case - early month
    history present, today < 7 => unit => trend equals the estimate (flat): 1: system
  section Edge case - entry added from the home
    add an expense from the home sheet => dashed stroke shimmers until the response, then springs to its new end; label fades out and back: 1: browser
  section Edge case - capped prior
    history with a huge usual drift and tiny MAD => unit => the prior term never exceeds driftMad: 1: system
```

## Tasks to do

### `1)` Model and decode

> Optional field, old backends keep working.

1. `DriftHistory: Codable, Equatable` with the three fields; `history: DriftHistory?` where the details payload is decoded.
2. Store exposes it to `computeBalanceTrajectory`.

### `2)` Prior

> Same blend as today, prior no longer zero, three guards.

1. `trendBalance(history: DriftHistory?)`: `remaining = totalDays − today`; `K = history?.priorStrength ?? trendPriorDays`; `w = today/(today+K)`; `h = n/(n+2)`; `priorTerm = h × usualOutflowDrift × plannedOutflows × remaining/totalDays`, clamped to `±driftMad`; `trend = estimated + w × pace × remaining + (1−w) × priorTerm`, rounded 2.
2. Fallbacks: `history == nil` → today's formula exactly; `today < 7` → `estimatedBalance` (flat); `remaining == 0` → estimate.
3. `driftProfile` decoded but unused (phase 4).

### `3)` Chart

> Plot the points, nothing else moves.

1. `trend(for:)` passes the store's history; label, domain, accessibility unchanged.
2. Harness variant `history` (usual drift −8 %, n = 6); screenshots deficit/gain/history on the test simulator.
3. Settling state: store flag set around every home mutation (add, delete, amount edit; not pointing); chart reads it, shimmer reuses the skeleton material, position change animated with the chart spring, `accessibilityReduceMotion` → crossfade only. No spinner, no fake delay.
4. `DESIGN.md` one sentence. SwiftLint strict, `PulpeTests` green.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Details JSON with and without `history` both decode; store test sees the value.                                                |
| 2    | `HomeHeroCardTrendTests`: nil history reproduces today's numbers exactly; n=1 bends less than n=12; day 6 flat, day 7 bends; prior term capped at driftMad; alternating history (rate 0) equals no-history. |
| 3    | Screenshots: the history variant lands visibly lower than the deficit variant with the same month; a UI test adds an entry from the home and sees the projection end move; lint and unit suite green. |
