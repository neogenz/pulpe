---
description: Cross-platform PostHog event contract and naming
---

# PostHog Events

## Sources of truth

- Web app and shared event names: `ANALYTICS_EVENTS` in `shared/src/feature-flags.ts`.
- Landing-only CTA contract: `landing/lib/posthog.ts`.
- iOS mirror: `AnalyticsEvent` in `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift`.

When an event is cross-platform, update both files and their tests in the same change. The
JSDoc on `ANALYTICS_EVENTS` owns the event purpose and property names. Allowed values and
idempotency guarantees live beside the platform code and focused tests; do not copy the full
catalog into documentation.

## Contract locations

- Shared names, purposes, and property keys: `shared/src/feature-flags.ts`.
- Landing CTA name, properties, and delivery: `landing/lib/posthog.ts` and
  `landing/app/accessibility.test.tsx`.
- iOS names and payload sanitization: `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift` and
  `ios/Pulpe/Core/Analytics/AnalyticsService.swift`.
- Onboarding value spaces and idempotency: `ios/Pulpe/Features/Onboarding/OnboardingFlow.swift`
  and `ios/PulpeTests/Features/Onboarding/OnboardingStateTests.swift`.
- Auth diagnostics and session-reset classification: `ios/Pulpe/Core/Auth/AuthService.swift`,
  `ios/Pulpe/App/AppState+SessionReset.swift`,
  `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift`, and
  `ios/PulpeTests/App/AppStateLogoutScopeTests.swift`.

## Naming

- Event and property names use static `snake_case` strings.
- Events describe completed facts with `object_action`: `budget_created`, not `create_budget`
  or `created`.
- Flow markers use `_started`, `_completed`, `_cancelled`, `_abandoned`, `_resumed`, or
  `_failed`.
- Put variable data in properties; never interpolate it into the event name.
- Keep property value spaces stable once shipped so dashboards remain comparable.

## Adding or changing an event

1. Search the event and its property values across `shared/`, `frontend/`, `landing/`, and
   `ios/`; inspect every emitter and focused test before editing the contract.
2. Add or update `ANALYTICS_EVENTS`, including its property contract in JSDoc.
3. Update the platform-owned value space and mirror `AnalyticsEvent.swift` when iOS emits or
   queries the event.
4. Update a focused test for duplicate or missing emission.
5. Treat a rename as a new event. Historical PostHog data keeps the old name.

Do not re-emit these retired aliases: `welcome_page_viewed`, `welcome_screen_viewed`,
`vault_code_entered`, `vault_code_setup_completed`, `profile_step1_completed`,
`profile_step2_completed`, or `profile_step2_skipped`.

## Privacy

Never attach financial amounts, free-form budget or transaction labels, secrets, tokens, or
raw error payloads. Person properties are set through the identify flow; event payloads carry
only the minimum dimensions required by the analysis.
