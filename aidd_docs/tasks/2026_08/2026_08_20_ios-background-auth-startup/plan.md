---
objective: "Pulpe starts its UI authentication flow exactly once on the first active scene, never mistakes an unavailable returning-user Keychain marker for an absent user, and exposes enough non-PII telemetry to prove the behavior in production."
status: in-progress
---

# Plan: Prevent background launches from misrouting authenticated iOS users

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Keep background widget refresh independent from UI authentication, preserve legitimate onboarding recovery, and make every exceptional startup decision observable. |
| **Source** | User report with screenshot, PostHog incident timeline, and code investigation completed in the Codex task on 2026-08-20. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Start UI authentication once, on the first active scene | [`phase-1.md`](./phase-1.md) |
| 2   | Preserve returning-user identity when Keychain is unavailable | [`phase-2.md`](./phase-2.md) |
| 3   | Prove the locked-device path and install production reporting | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| [Apple `ScenePhase`](https://developer.apple.com/documentation/swiftui/scenephase) | `.active` means foreground and interactive; `.background` means the scene is not visible, so UI authentication must wait for activation. |
| [Apple `BGAppRefreshTask`](https://developer.apple.com/documentation/backgroundtasks/bgapprefreshtask) | App refresh work runs while the app is in the background and must remain independent from visible-scene startup. |
| [Apple `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`](https://developer.apple.com/documentation/security/ksecattraccessiblewhenunlockedthisdeviceonly) | The returning-user marker intentionally belongs to the unlocked-device accessibility class. |
| [Apple `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`](https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly) | Items needed by background work remain accessible after the first unlock, matching the existing Supabase session storage requirement. |
| [Pulpe PostHog project](https://eu.posthog.com/project/87621/) | `auth_session_observed`, `app_opened`, and `onboarding_resumed` already provide the base taxonomy needed for the incident report. |

## Decisions

| Decision | Why |
| -------- | --- |
| Put the one-shot startup gate in the existing `AppRuntimeCoordinator` | It already owns scene transitions and process-lifetime flags, so no new coordinator or SwiftUI-only state machine is needed. |
| Keep `last_used_email` at `WhenUnlockedThisDeviceOnly` and model read outcomes explicitly | The fix should not weaken or migrate Keychain accessibility; an unavailable item is an unknown returning-user state, not proof of absence. |
| Reuse `auth_session_observed` with bounded `source` and `outcome` values | Existing diagnostics, privacy controls, app/build properties, and PostHog queries remain valid without a new event or any email value. |
