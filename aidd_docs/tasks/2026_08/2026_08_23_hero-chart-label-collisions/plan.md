---
objective: "On the iOS home burn-down chart, no label pill ever overlaps today's dot, another pill, or the plot edge, whatever the month's shape."
status: implemented
---

# Plan: Hero chart label collision resolver

## Overview

| Field      | Value                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Replace the per-label top/bottom heuristics in `HomeHeroCard+Chart.swift` with one point-space layout pass that places the three pills (« Aujourd’hui », « Prévu », « Si tu continues ») around the dot. |
| **Source** | User report + screenshot 2026-08-23: « Prévu » pill drawn on top of today's dot late in the month; pills themselves no longer overlap.                                                                    |

## Root cause

Swift Charts `.annotation` resolves overflow against the plot bounds only, never against other marks. Each pill currently picks a side (`planLabelPosition`, `trendLabelPosition`, `todayLabelPosition`) from the data's slope. « Prévu » hangs under the plan's end; when that end sits about one pill height above the real balance (the screenshot), "under the plan's end" is exactly the dot. Late in the month all three anchors share the right edge, so any side rule has a losing configuration. The fix is a small greedy rect resolver fed with the plot's real geometry, the way Recharts/Chart.js label plugins do it.

## Phases

| #   | Phase                                             | File                         |
| --- | ------------------------------------------------- | ---------------------------- |
| 1   | Pure label layout resolver + tests                | [`phase-1.md`](./phase-1.md) |
| 2   | Draw pills from the resolver in the chart overlay | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                                        | Verified                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| https://developer.apple.com/documentation/charts/annotationoverflowresolution | Only `.fit`/`.padScale`/`.automatic`/`.disabled` against the chart or plot; no mark-to-mark collision. |
| https://developer.apple.com/documentation/charts/chartproxy/position(for:)    | `ChartProxy.position(for:)` turns a data value into a plot-space `CGPoint` inside `chartOverlay`.      |

## Decisions

| Decision                                                                                      | Why                                                                                                                            |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Pills leave `.annotation` and are drawn in `chartOverlay` from a pure resolver                | Only place where all anchors are known in points at once; the resolver stays unit-testable without a chart.                    |
| Greedy placement with fixed priority: dot > « Aujourd’hui » > « Si tu continues » > « Prévu » | Simplest thing that cannot overlap; ceiling noted in code (no global optimisation, add when a fourth label appears).            |
