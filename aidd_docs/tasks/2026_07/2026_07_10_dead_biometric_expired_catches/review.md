# Review: Remove dead biometricSessionExpired catches + fix test busy-wait

- **Verdict**: approve
- **Diff**: `98fef3f9b...3ab1deb2e`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_10
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — dead-catches-and-test-busy-wait

- [x] Dead `catch AuthServiceError.biometricSessionExpired` removed in `fallbackToRegularSession` — SessionLifecycleCoordinator.swift:141 (gone; generic catch → `.networkError` at :147-150)
- [x] Dead catch removed in `attemptRegularSessionValidation` — SessionLifecycleCoordinator.swift:158 (gone; generic catch → `.networkError` at :166-169)
- [x] Sibling dead catch removed in `performRegularValidation` — StartupCoordinator.swift:344 (gone; generic catch → `.networkError` at :344-350)
- [x] Live biometric-path catch untouched — SessionLifecycleCoordinator.swift:90 (still present, still covered by SessionLifecycleCoordinatorTests:164)
- [x] `AppState+SessionReset.swift` not touched — not in diff (3 files only)
- [x] Busy-wait replaced with `waitForCondition` — BiometricPreferencePersistenceTests.swift:26; no `Task.yield()` remains
- [x] Build green; 3 suites / 60 tests pass unchanged (executor evidence: TEST SUCCEEDED)

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |

None.

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (5/5 claims + 2/2 acceptance criteria)       |
| Files checked | SessionLifecycleCoordinator.swift, StartupCoordinator.swift, BiometricPreferencePersistenceTests.swift, AppState.swift, AuthService.swift, AsyncTestHelpers.swift, AppStateBiometricColdStartTests.swift/SessionLifecycleCoordinatorTests.swift/StartupCoordinatorTests.swift (seam-injection grep) |
| Unchecked     | none                                              |
| Unplanned     | none                                              |
