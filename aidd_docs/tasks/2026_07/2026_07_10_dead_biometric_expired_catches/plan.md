---
objective: "The regular-session validation path carries no dead biometricSessionExpired catch, and BiometricPreferencePersistenceTests waits via waitForCondition instead of a busy-wait."
status: reviewed
---

# Plan: Remove dead biometricSessionExpired catches + fix test busy-wait

## Overview

| Field      | Value                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| **Goal**   | Apply the 2 confirmed review findings on `fix/ios-recurring-logout`; reject the third. |
| **Source** | Review findings passed in-session (sdlc args); verified against code 2026-07-10.       |

## Phases

| #   | Phase                                        | File                         |
| --- | -------------------------------------------- | ---------------------------- |
| 1   | dead-catches-and-test-busy-wait              | [`phase-1.md`](./phase-1.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Remove the sibling dead catch in `StartupCoordinator.performRegularValidation` (not named by the findings) | Same seam (`validateRegularSession` → `validateSessionStrict()`), same dead pattern, same commit (914aebd18); leaving one of three occurrences keeps a destructive `clearExpiredBiometricState()` path reachable only by a future wiring mistake. |
| Reject finding on `AppState+SessionReset.swift:67` (`catch AuthServiceError.sessionExpired`) | Contract of the injectable seam, enforced by `AppStateBackgroundLockTests.foregroundBiometricUnlock_genuineSessionLoss_logsOut` which injects that throw and asserts logout. Do not touch. |
