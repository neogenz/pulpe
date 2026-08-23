---
objective: "PostHog is the sole Android telemetry and error-tracking vendor, with no Sentry runtime, dependency, configuration, generated native integration, artifact, or actionable setup left outside this removal record."
status: implemented
---

# Plan: Remove Sentry from Android observability

## Overview

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| **Goal**   | Remove Sentry and keep error reporting in the existing PostHog client |
| **Source** | User request in this task, 2026-08-17                                 |

## Phases

| #   | Phase                                                         | File                         |
| --- | ------------------------------------------------------------- | ---------------------------- |
| 1   | Remove Sentry and validate PostHog-only Android observability | [`phase-1.md`](./phase-1.md) |

## Resources

| Source                                                            | Verified                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://posthog.com/docs/libraries/react-native                   | The installed React Native SDK supports opt-out, `before_send`, and a client created without a React provider.                                    |
| https://posthog.com/docs/error-tracking/installation/react-native | `posthog-react-native` supports uncaught-exception and unhandled-rejection autocapture; console and native-crash capture are independent options. |

## Decisions

| Decision                                                                                | Why                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostHog is the only Android telemetry and error-tracking client.                        | The repository rules and deployment memory already designate PostHog, while the Sentry client has no DSN and is inert.                                                                                                           |
| Enable JavaScript exception autocapture without console capture or a new native plugin. | The existing SDK covers uncaught exceptions and rejected promises; console capture risks typed financial content, while native crash symbolication would add credentials and build infrastructure not required for this removal. |
