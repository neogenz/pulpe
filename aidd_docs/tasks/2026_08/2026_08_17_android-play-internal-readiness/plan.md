---
objective: "PR #608 is conflict-free, secure on password recovery, correct on savings flows, green through Android delivery checks, and installable by one Google Play internal tester."
status: blocked
blocked_by: "PR approval from another reviewer, then Play Console identity and physical non-root Android 10+ device verification."
---

# Plan: Android PR #608 and Play internal-test readiness

## Overview

| Field      | Value                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Close the confirmed PR findings, merge safely into `preview`, then deliver one Play-signed internal build without promoting `main`. |
| **Source** | Maxime's annotated request plus the review of PR #608 at `3355c19` against `preview` at `018b557` on 2026-08-17.                    |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Reconcile the branch with `preview`                | [`phase-1.md`](./phase-1.md) |
| 2   | Secure the password-recovery boundary              | [`phase-2.md`](./phase-2.md) |
| 3   | Preserve savings invariants and query truth        | [`phase-3.md`](./phase-3.md) |
| 4   | Make modal and settings failure states trustworthy | [`phase-4.md`](./phase-4.md) |
| 5   | Prove the delivery path and publish internally     | [`phase-5.md`](./phase-5.md) |

## Resources

| Source                                                                  | Verified                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| https://docs.expo.dev/eas/workflows/syntax/                             | Manual workflow inputs require an object; custom concurrency groups and `cancel_in_progress: false` are unsupported. |
| https://reactnative.dev/docs/modal                                      | Native `Modal` owns Android Back through `onRequestClose` and presents content above its enclosing view.             |
| https://support.google.com/googleplay/android-developer/answer/9842756  | Play's app-signing keys, not the EAS upload key alone, identify the APK installed by testers.                        |
| https://support.google.com/googleplay/android-developer/answer/9845334  | An internal track supports a one-person tester list and human distribution through an opt-in link.                   |
| https://support.google.com/googleplay/android-developer/answer/10787469 | Internal-only builds are exempt from Data safety disclosure, while later tracks include third-party SDK collection.  |

## Decisions

| Decision                                                                          | Why                                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Gate required user settings once in the authenticated layout.                     | One boundary prevents every currency/pay-day consumer from inventing CHF or day 1.                                             |
| Use React Native's installed native `Modal` for sheets and the system gate.       | It fixes Android Back, stacking and TalkBack without another dependency.                                                       |
| Run the first production-profile workflow manually from the merged `preview` SHA. | Internal testing is proven without prematurely promoting `preview` to `main`; the Play release remains a human-promoted draft. |
