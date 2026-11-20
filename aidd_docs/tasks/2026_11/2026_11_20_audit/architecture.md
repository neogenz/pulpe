# Codebase Audit: architecture (PR #915, cbe305587..213322c41)

Boundaries hold: the one formula comes from shared; chart geometry and scrub are view-level on both platforms.

- **Date**: 2026_11_20
- **Scope**: diff of branch claude/android-home-hero-ios-parity-e3c75b against main, read with callers and neighbours
- **Health**: good
- **Findings**: 0 critical, 0 major, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |

No finding. `trendBalance` comes from `shared/src/calculators/balance-trajectory.ts` and gets `history` on both sides (`current-month-view-model.ts:199`, iOS `CurrentMonthStore.swift:407`). The `plotted()` domain fix ships on Android (`balance-chart-scale.ts`) and iOS (`HomeHeroCard+Chart.swift`) with tests in one commit (0778de7d2). Chart geometry, scrub and the accessibility label are view code on iOS too, so the formula-mirror rule does not apply.

## Top actions

1. None.

## Coverage

- **Scanned**: architecture (layering view/view-model/shared, formula-mirror rule, cross-platform parity of the domain fix)
- **Skipped**: none
