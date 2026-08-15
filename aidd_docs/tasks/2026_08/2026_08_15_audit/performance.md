# Codebase Audit: i18n branch — performance

The production bundle remains within its measured i18n budget and the branch introduces no evidenced hot-path regression.

- **Date**: 2026_08_15
- **Scope**: `origin/preview@07433bbe6...working tree` (feature tip `38ae006`, latest preview base and production-readiness commits)
- **Health**: good
- **Findings**: 0 critical, 0 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |

## Top actions

1. Keep the 1.40 MB warning and 1.50 MB error budgets as regression gates.

## Coverage

- **Scanned**: performance; production Angular stats and chunk attribution, Next.js static generation, locale data access cardinality and static N+1/heavy-operation heuristics
- **Skipped**: no runtime profiler or production trace; static and build-time evidence only
