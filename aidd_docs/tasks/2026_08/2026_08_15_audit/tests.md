# Codebase Audit: i18n branch — tests

The feature's locale, legal, release, analytics and cross-platform paths have automated unit, SQL, E2E and iOS coverage.

- **Date**: 2026_08_15
- **Scope**: `origin/preview@07433bbe6...working tree` (feature tip `38ae006`, latest preview base and production-readiness commits)
- **Health**: good
- **Findings**: 0 critical, 0 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |

## Top actions

1. Let the mandatory CI matrix confirm the exact pushed SHA on Linux and macOS.

## Coverage

- **Scanned**: tests; 5,355 monorepo unit tests, 238 Playwright tests, 2,125 passed iOS unit tests (0 failed, 9 skipped), 26 XCUITests, SQL RLS assertions, release validator, coverage reports and skipped-test scan
- **Skipped**: landing and iOS do not expose repository coverage percentages; behavior suites were used instead
