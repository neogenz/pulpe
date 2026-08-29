# Diagnostics and analytics

What the Android app sends to PostHog, when, and how a user refuses.

## When anything is sent

Production builds only. `ENV.posthog` is `null` on the `local` and `preview`
profiles, so `startAnalytics()` (`src/core/observability/analytics.ts`) never
builds a client there and no socket to PostHog is opened. The same gate holds
on iOS.

## What is sent

- Product events from `ANALYTICS_EVENTS` (`shared/src/feature-flags.ts`) with
  the minimum dimensions each analysis needs.
- Uncaught JavaScript exceptions and unhandled rejections (PostHog error
  tracking); native crashes and session replay are off.
- API failures through `reportApiError`
  (`src/core/observability/api-error-reporting.ts`): HTTP method, status,
  error code, request id and a path with every id replaced by `:id`. Auth
  refusals (401, 403), rate limits and the vault's own codes are dropped.
- App identity: version, build, platform, locale.

Never sent: amounts, budget or transaction labels, tokens, e-mail addresses,
raw error payloads, deep-link URLs. Lifecycle autocapture is off because it
would attach the initial URL, which can carry recovery tokens.

## The default, and how to refuse

Sharing is **on by default**: a device that has never answered counts as a yes,
and only a refusal is written down (`diagnostics-consent.ts`). This is an
informed opt-out, the same as iOS and the webapp: an opt-in default would
silence the product funnels the retention work depends on for every user who
never opens the preferences.

Refusing in Préférences (`src/app/(main)/settings/preferences.tsx`,
"Partager les diagnostics") flips the toggle, and the toggle is the single
source: `startAnalytics` subscribes to it and calls `reset()` then `optOut()`
on the SDK, so the device identity is dropped and nothing further leaves the
phone. Re-enabling calls `optIn()` and identifies the user again.
