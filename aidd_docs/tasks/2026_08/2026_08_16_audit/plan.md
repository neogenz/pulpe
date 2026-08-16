---
objective: "Close the Android audit's security and correctness risks, then reduce its verified maintenance and delivery debt without changing financial rules."
status: blocked
---

# Plan: Android audit corrections

## Overview

| Field      | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| **Goal**   | Correct the actionable Android audit findings in risk order. |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_16_audit/report.md`         |

## Phases

| #   | Phase                                    | File                         |
| --- | ---------------------------------------- | ---------------------------- |
| 1   | Secure device and account boundaries     | [`phase-1.md`](./phase-1.md) |
| 2   | Make query failures honest and visible   | [`phase-2.md`](./phase-2.md) |
| 3   | Simplify boundaries and render hot path  | [`phase-3.md`](./phase-3.md) |
| 4   | Clean dependencies and automate smoke QA | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                           | Verified                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| https://docs.expo.dev/versions/latest/config/app/                                | `android.allowBackup: false` disables Android app-data backup.          |
| https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/ | The installed Reanimated version exposes a synchronous motion setting.  |
| https://docs.maestro.dev/get-started/supported-platform/android                  | Existing YAML flows can run against a local Android emulator/device.    |
| https://docs.expo.dev/eas/workflows/examples/e2e-tests/                          | Expo documents an Android preview build followed by a Maestro E2E job.  |
| https://docs.expo.dev/eas/workflows/syntax/                                      | EAS supports pull-request/path filters and virtualized Android runners. |

## Decisions

| Decision                                                              | Why                                                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A cold process start always returns a configured vault to `locked`.   | Removing the ungated persisted key is smaller and safer than maintaining expiry metadata beside a key.                                 |
| Android backup is disabled for the whole app.                         | Pulpe is server-authoritative and its only backup-eligible draft contains financial estimates.                                         |
| Cross-stack budget pagination is not part of these correction phases. | The current API cannot preserve complete history and bound the response at once; no measured issue justifies that contract change yet. |
| Android E2E remains on the existing EAS Workflow.                     | This reuses Expo's first-party CNG path and avoids a second emulator pipeline or Maestro Cloud.                                        |
