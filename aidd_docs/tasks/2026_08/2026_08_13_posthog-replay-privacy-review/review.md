# Review: PostHog replay privacy and screen tracking

- **Verdict**: approve
- **Diff**: `02b29a3e8162df16de8335de1e1a606044a2711d...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_13
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Useful, private web replay

- [x] Session replay remains configurable, sampled and enabled when requested — `frontend/projects/webapp/src/app/core/analytics/posthog.ts:108`
- [x] Product copy and layout remain visible while inputs and `ph-no-capture` subtrees are protected by the installed PostHog recorder — `frontend/projects/webapp/src/app/core/analytics/posthog-sdk-contract.spec.ts:36`
- [x] Request and response bodies, headers, URL queries and dynamic route identifiers are excluded before transport — `frontend/projects/webapp/src/app/core/analytics/posthog.ts:138`
- [x] Replay snapshots remain opaque to application code instead of being reconstructed against an unstable rrweb schema — `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.ts:881`
- [x] The PostHog SDK is pinned exactly and its real recorder behavior has contract coverage — `frontend/package.json:42`

### Phase 2 — Actionable analytics and production correlation

- [x] Authenticated pageviews and structure-only click events remain captured without DOM text, values, attributes or URLs — `frontend/projects/webapp/src/app/core/analytics/posthog.ts:284`
- [x] Exception events retain session, request, HTTP status, backend error code, release and commit context while financial fields and free-form messages are removed — `frontend/projects/webapp/src/app/core/analytics/posthog-sdk-contract.spec.ts:167`
- [x] The request identifier remains correlated end-to-end between the frontend error context and backend diagnostics — `frontend/projects/webapp/src/app/core/analytics/http-error-interceptor.spec.ts:105`

### Phase 3 — Stable iOS screen tracking

- [x] Only consecutive duplicate `SavingsGoalsList` screen events are suppressed; other or enriched screen events remain observable — `ios/Pulpe/Core/Analytics/AnalyticsService.swift:22`
- [x] Deduplication resets with analytics identity/consent state and has deterministic clock-based regression coverage — `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:303`

## Findings

None.

## Verification

| Metric           | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified         | 100% (10/10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Files checked    | `.claude/rules/05-workflows-and-processes/posthog-privacy.md`, `frontend/package.json`, `frontend/projects/webapp/src/app/core/analytics/posthog.ts`, `frontend/projects/webapp/src/app/core/analytics/posthog-sanitizer.ts`, their specs and SDK contract test, `frontend/projects/webapp/src/app/core/analytics/http-error-interceptor.spec.ts`, `frontend/projects/webapp/src/app/core/config/application-configuration.spec.ts`, `ios/Pulpe/Core/Analytics/AnalyticsService.swift`, `ios/Pulpe/Features/SavingsGoals/SavingsGoalsListView.swift`, `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift`, `pnpm-lock.yaml` |
| Runtime evidence | `pnpm test` (5/5 packages; frontend 2,940 tests), iOS `xcodebuild test` (2,089 tests), `pnpm build:frontend`, targeted PostHog SDK contract tests, `pnpm quality`, `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Unchecked        | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Unplanned        | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
