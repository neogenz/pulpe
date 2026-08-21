# Codebase Audit: Android — performance

Caching, query-key reuse and server aggregates avoid obvious N+1 patterns. The two concrete scaling risks are a frame-rate state update in a shared rail and an intentionally unbounded budget collection.

- Date: 2026-08-16
- Scope: render hot paths, query/data volume, bundle export and static performance heuristics
- Health: good
- Findings: 0 critical, 2 warnings, 0 minor

## Findings

| Sev | Category    | Location                                        | Issue                                                                                                                                                    | Suggested fix                                                                                                                                               | Effort |
| --- | ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Performance | `android/src/core/ui/fading-rail.tsx:76`        | The rail calls React `setState` on every 16 ms scroll event merely to derive two edge-visibility booleans, forcing up to one component render per frame. | Store only the two booleans and update when either changes, or keep the offset off the React render path with the already-installed animation stack.        | S      |
| 🟡  | Performance | `android/src/features/budgets/budget-api.ts:23` | The budget list is deliberately unbounded to preserve the current month, so payload, validation and cache cost grow for the lifetime of an account.      | Add a server/query shape that returns the current period plus a cursor-paginated history; keep a single cache entry only if measurement still justifies it. | M      |

## Top actions

1. Stop per-frame React renders in `FadingRail`; this is the smallest local performance fix.
2. Design a bounded API response before long-lived accounts make the budget list expensive.

## Coverage

- Scanned: list rendering, scroll handlers, query pagination, request reuse, memoization and generated Expo assets.
- Verified: production Expo export succeeds (3,764 modules, 10 MB Hermes bytecode, 13 MB exported assets).
- Skipped: device CPU/memory traces, startup timing and React Native profiler capture; no emulator/device session was available.
