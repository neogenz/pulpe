---
status: done
---

# Instruction: dead-catches-and-test-busy-wait

## Architecture projection

```txt
.
└── ios
    ├── Pulpe/App/Auth
    │   ├── SessionLifecycleCoordinator.swift   ✏️ remove 2 dead catch clauses
    │   └── StartupCoordinator.swift            ✏️ remove 1 dead catch clause
    └── PulpeTests/App
        └── BiometricPreferencePersistenceTests.swift  ✏️ busy-wait → waitForCondition
```

## Tasks to do

### `1)` Remove dead `catch AuthServiceError.biometricSessionExpired` on the regular-session path

> Production `validateRegularSession` = `AuthService.validateSessionStrict()`, which only rethrows SDK errors (AuthError/URLError) — it never throws `AuthServiceError.biometricSessionExpired` (sole throw site: `AuthService.swift:458`, biometric path). No test injects it through the regular seam. Fallthrough to each function's existing generic `catch` (→ `.networkError`, session kept, no biometric wipe) is the desired conservative behavior.

1. `ios/Pulpe/App/Auth/SessionLifecycleCoordinator.swift` — in `fallbackToRegularSession(reason:)`, delete the `catch AuthServiceError.biometricSessionExpired { ... }` clause (lines 141-144).
2. Same file — in `attemptRegularSessionValidation()`, delete the `catch AuthServiceError.biometricSessionExpired { ... }` clause (lines 165-168).
3. `ios/Pulpe/App/Auth/StartupCoordinator.swift` — in `performRegularValidation(runId:context:)`, delete the `catch AuthServiceError.biometricSessionExpired { ... }` clause (lines 344-347).
4. Do NOT touch the live `catch AuthServiceError.biometricSessionExpired` in `SessionLifecycleCoordinator.attemptBiometricSessionValidation()` (line 90) — that one guards the biometric path and is test-covered.
5. Do NOT touch `AppState+SessionReset.swift` at all (rejected finding).

### `2)` Replace busy-wait with `waitForCondition` in BiometricPreferencePersistenceTests

> `while pending.value == nil { await Task.yield() }` hangs the whole suite forever on regression; the project helper polls with a timeout and fails cleanly.

1. `ios/PulpeTests/App/BiometricPreferencePersistenceTests.swift:26` — replace the `while` line with `await waitForCondition("hydration must reach the credentialsAvailability continuation") { pending.value != nil }` (helper in `PulpeTests/Helpers/AsyncTestHelpers.swift`, `@MainActor`, default 2 s timeout).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | Build green; `SessionLifecycleCoordinatorTests` and `StartupCoordinatorTests` pass unchanged (no test injected this error through the regular seam, so none needs editing). |
| 2    | `BiometricPreferencePersistenceTests` passes; no `Task.yield()` busy-wait remains in the file. |

Validation command (from `ios/`, per ios/CLAUDE.md):

```bash
xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.2' \
  -only-testing:PulpeTests/SessionLifecycleCoordinatorTests \
  -only-testing:PulpeTests/StartupCoordinatorTests \
  -only-testing:PulpeTests/BiometricPreferencePersistenceTests \
  CODE_SIGNING_ALLOWED=NO
```
