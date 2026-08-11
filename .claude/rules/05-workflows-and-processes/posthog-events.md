---
description: Cross-platform PostHog event contract and naming
---

# PostHog Events

## Sources of truth

- Web and shared event names: `ANALYTICS_EVENTS` in `shared/src/feature-flags.ts`.
- iOS mirror: `AnalyticsEvent` in `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift`.

When an event is cross-platform, update both files and their tests in the same change. The
JSDoc on `ANALYTICS_EVENTS` owns the event purpose and property names; do not copy the full
catalog into documentation.

## Naming

- Event and property names use static `snake_case` strings.
- Events describe completed facts with `object_action`: `budget_created`, not `create_budget`
  or `created`.
- Flow markers use `_started`, `_completed`, `_cancelled`, `_abandoned`, `_resumed`, or
  `_failed`.
- Put variable data in properties; never interpolate it into the event name.
- Keep property value spaces stable once shipped so dashboards remain comparable.

## Adding or changing an event

1. Add or update `ANALYTICS_EVENTS`, including its property contract in JSDoc.
2. Mirror it in `AnalyticsEvent.swift` when iOS emits or queries it.
3. Update the emitter and a focused test for duplicate or missing emission.
4. Treat a rename as a new event. Historical PostHog data keeps the old name.

Do not re-emit these retired aliases: `welcome_page_viewed`, `welcome_screen_viewed`,
`vault_code_entered`, `vault_code_setup_completed`, `profile_step1_completed`,
`profile_step2_completed`, or `profile_step2_skipped`.

## Privacy

Never attach financial amounts, free-form budget or transaction labels, secrets, tokens, or
raw error payloads. Person properties are set through the identify flow; event payloads carry
only the minimum dimensions required by the analysis.
