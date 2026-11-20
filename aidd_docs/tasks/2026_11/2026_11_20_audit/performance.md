# Codebase Audit: performance (PR #915, cbe305587..213322c41)

Scrub path is cheap; one pre-existing re-render pattern, unmeasured.

- **Date**: 2026_11_20
- **Scope**: diff of branch claude/android-home-hero-ios-parity-e3c75b against main, read with callers and neighbours
- **Health**: good
- **Findings**: 0 critical, 0 major, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟢 | performance | `android/src/features/current-month/components/balance-trajectory-chart.tsx:104` | `data`, `plan`, `projection`, `domain`, inline `yKeys` and `Gesture.Pan()` are rebuilt on each render, i.e. on every day crossed while scrubbing. Pre-existing pattern, no jank measured (≤32 points). | `useMemo` on `[trajectory]`, module-level `Y_KEYS`; only if a device shows jank. | S |

## Top actions

1. Profile a scrub sweep on a low-end device before memoizing; keep it as is if no jank.

## Coverage

- **Scanned**: performance (scrub setState/haptic per day, view-model memoization in `current-month-queries.ts:125`, chart inputs per render)
- **Skipped**: none (no profiler run, code reading only)
