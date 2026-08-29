---
objective: "A detail page always renders one of loading, failed, loaded, and the standard iOS gates this project lacked (crash reporting, lint in CI, the shipping toolchain, one cold UI smoke, catalog parity) are in place."
status: implemented
---

# Plan: A cold page starts its load

## Overview

| Field      | Value                                                                                                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Fix the model (one content enum per detail page, exhaustive `switch`), then add the ordinary 2026 iOS guardrails that were missing and would have surfaced this class of bug: crash reporting, lint in CI, CI on the release toolchain, one UI smoke on the cold path, string-catalog parity. |
| **Source** | Conversation of 2026-08-28: build 10 blank page (fixed in `dff8a4ba6`), the `Group`-without-`else` root cause, and the request for the two test layers plus the design flaw behind them.                                          |

## Phases

| #   | Phase                         | File                         |
| --- | ----------------------------- | ---------------------------- |
| 1   | exhaustive-page-content-state       | [`phase-1.md`](./phase-1.md) |
| 2   | crash-reporting-through-posthog     | [`phase-2.md`](./phase-2.md) |
| 3   | ci-gates-that-match-the-release     | [`phase-3.md`](./phase-3.md) |
| 4   | ui-smoke-in-ci-on-the-cold-path     | [`phase-4.md`](./phase-4.md) |
| 5   | string-catalog-specifier-parity     | [`phase-5.md`](./phase-5.md) |

## Resources

| Source                                                              | Verified                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| https://posthog.com/docs/error-tracking/installation/ios            | Exception autocapture (`errorTrackingConfig.autoCapture`) needs posthog-ios ≥ 3.56; catches Mach exceptions and POSIX signals incl. SIGSEGV; sent on next launch. |
| https://posthog.com/docs/error-tracking/upload-source-maps/ios      | `posthog-cli dsym` uploads dSYMs; the Xcode run-script route needs `ENABLE_USER_SCRIPT_SANDBOXING=NO`, hence the archive-time script.      |
| https://github.com/actions/runner-images (macos-26 readme)          | Image ships Xcode 26.2 … 26.6 (26.6 default), iOS 26.5 simulator runtime, SwiftLint 0.65.                                                |

## Decisions

| Decision                                                                                                     | Why                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A page's rendering state is one enum (`loading`, `failed`, `loaded`) the body `switch`es on, never a set of booleans. | Three independent booleans give eight combinations; the body handled three and the fifth, "not started", rendered nothing. An enum with an exhaustive `switch` makes the compiler refuse the missing case. `CurrentMonthStore.ContentState` already does this; the two detail pages diverged from it. |
| No source-scanning architecture test and no `UIWindow`-hosted lifecycle test.                                | Once the body switches on an enum, the shape they would police cannot be written, and a hosted test would only re-check SwiftUI's own contract. Both are custom tooling to maintain for no property the compiler does not already hold. |
| Crash reporting rides on PostHog, not on a new SDK.                                                          | The SDK is already in the app with an opt-out the user controls; one config line plus a dSYM upload at archive time. Sentry or Crashlytics would add a dependency and a second privacy surface for the same signal. |
| One UI smoke in CI, not the suite.                                                                            | XCUITest in CI is standard; the whole suite is 15 files known to flake under load. The smoke is the exact journey that broke, on the exact path (cold cache) the harness used to hide.                                   |
