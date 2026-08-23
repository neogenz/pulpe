---
objective: "Android routes returning users through PIN or biometric unlock, keeps existing Google users out of onboarding, and exposes password visibility on sign-in."
status: implemented
---

# Plan: Correct Android auth and resume routing

## Overview

| Field      | Value                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| **Goal**   | Reconcile persisted onboarding with server vault state and complete the sign-in password affordance. |
| **Source** | User-reported Android defects, 2026-08-17; diagnosis in [`debug.md`](./debug.md).                    |

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Make vault state authoritative across Google auth and resume | [`phase-1.md`](./phase-1.md) |
| 2   | Add password reveal and device-level regression coverage     | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                                    | Why                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Treat the authenticated server vault status as authoritative over a local onboarding draft. | A device draft can be stale after process death or an existing Google login; it must never make a user choose a second encryption PIN. |
