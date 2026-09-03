# Review: PUL-337 — Afficher la maintenance au lieu d'invalider le PIN sur iOS

- **Verdict**: approve
- **Diff**: `main...maximedesogus/pul-337-afficher-la-maintenance-au-lieu-dinvalider-le-pin-sur-ios` (`e0e352427`, second pass)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_01
- **Findings**: 0 critical, 0 warning, 5 minor

## Phases

### Phase 1 — Prioriser la maintenance sur le déverrouillage iOS

Plan tasks:

- [x] T1 `.maintenanceChecked(true)` promoted globally from `.initializing`, `.unauthenticated`, `.securitySetup`, `.locked`, `.recovering` — `ios/Pulpe/App/Core/AppFlowReducer.swift:41-58`; `.maintenanceChecked(false)` still routed to `reduceMaintenance` — `AppFlowReducer.swift:78-81`
- [x] T2 `.maintenance` no longer falls into the wrong-code `default` — `ios/Pulpe/Features/Auth/Pin/PinCryptoProtocols.swift:92`
- [x] T3 probe before any unlock, gated by `backgroundLockApplies`, bounded and cancellable — `ios/Pulpe/App/AppState+Maintenance.swift:31-43`, `ios/Pulpe/App/AppState+SessionReset.swift:28-42`, `ios/Pulpe/Core/Config/AppConfiguration.swift:136`
- [x] T4 (rewritten) a maintenance 503 is no longer read as a verdict on the biometric key — `ios/Pulpe/App/BiometricManager.swift:289-293`. Single fix point: both `handleStaleKey` callers (`BiometricManager.swift:181`, `SessionLifecycleCoordinator.swift:105`) route through the same `_validateKey`, so no per-caller guard was needed. The original T4 (`MaintenanceView` → `retryStartup()`) was correctly dropped: `RootViewModifiers.swift:146-149` already fires `retryStartup()` on the `isInMaintenance` true→false edge

Ticket acceptance criteria:

- [x] CA1 locked resume under maintenance shows maintenance without asking for the PIN — now held for **both** cohorts: the gate is `backgroundLockApplies(authState:)` (`AppState+SessionReset.swift:31`), not the unlock result, so the probe runs before `sessionLifecycleCoordinator.handleEnterForeground` for Face ID users too. Pinned by `AppStateMaintenanceForegroundTests.swift:59-74` (`resolveCalls == 0`)
- [x] CA2 `APIError.maintenance` during PIN validation switches to maintenance, never a wrong-code message — `APIClient.swift:287-292` → `RootViewModifiers.swift:130-132` → `.locked` promotes to `.maintenance`; the message at `PinCryptoProtocols.swift:92` remains load-bearing on the `ChangePinView.swift:328` path, where the reducer deliberately does not transition
- [x] CA3 leaving maintenance relaunches startup resolution — `MaintenanceView.swift:59-60` → `RootViewModifiers.swift:146-149` → `AppState+Bootstrap.swift:23-25`
- [x] CA4 a genuinely wrong PIN keeps the existing message — `PinCryptoProtocols.swift:95` `default` untouched; `PinMaintenanceMessageTests.swift:13-15`. Reinforced by `BiometricDefaultValidateKeyTests.swift:51-63`: a `clientKeyInvalid` (HTTP 400) verdict is still rejected, so widening `isTransportFailure` did not weaken the bad-key path
- [x] CA5 iOS tests cover foreground resume under maintenance and `APIError.maintenance` during PIN validation — `AppStateMaintenanceForegroundTests.swift`, `PinMaintenanceMessageTests.swift`, `AppFlowReducerTests.swift:51-77`, plus `BiometricDefaultValidateKeyTests.swift:65-105` driving the real closure through `APIClient` + `InterceptingURLProtocol`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 1 | `ios/Pulpe/Features/Maintenance/MaintenanceView.swift:58` | Reported as reverted, it is not: `git diff main...HEAD` still carries `MaintenanceService.shared.checkStatus()` → `appState.maintenanceChecking()`, untouched by `e0e352427`. Only the plan's file tree dropped the line, so `phase-1.md` now *misdescribes* the diff instead of documenting an unplanned change. Behaviourally identical in production (`AppStateDependencies.swift:82-84`), still untested | Either revert the line for real, or put it back in the plan tree and the PR body |
| 🟢 | code | 1 | `ios/Pulpe/App/AppState+SessionReset.swift:38` | The maintenance early return skips the coordinator, so `backgroundDate` is never cleared (only `SessionLifecycleCoordinator.swift:88` clears it, inside the branch now bypassed). Sequence: resume under maintenance → maintenance ends → `retryStartup` → user unlocks → `authState == .authenticated` with the original, now-stale `backgroundDate` → any `.inactive` → `.active` bounce (control centre, notification banner) re-enters `handleBecomeActive` (`AppRuntimeCoordinator.swift:91-93`) → `backgroundLockApplies` sees a huge elapsed and locks. Immediate PIN prompt without a real backgrounding. The predicate hole itself is pre-existing (the `.noLockNeeded` path also leaves the date set) but there it needs 30 s of dwell first; here it is armed on return | Clear the date on the early return too — expose `clearBackgroundDate()` on the coordinator, or move the probe inside `handleEnterForeground` after the date is nil'd |
| 🟢 | code | 1 | `ios/Pulpe/App/BiometricManager.swift:292` | Residual of tolerating `.maintenance`: if maintenance starts between the probe and `validateKey`, the unlock now succeeds and the user reaches `.authenticated` on empty screens, since `maintenanceTransition` never promotes `.authenticated` (`AppFlowReducer.swift:55`) and the swallowed event is dropped by `handleForegroundLifecycleEvent`. Same residual on the manual Face ID button (`PulpeApp.swift:420-425` → `AppState.swift:396-398` → `attemptUnlock`) when maintenance starts after the route resolved to `.pinEntry`. Not self-healing: nothing re-routes until the next background past 30 s. Strictly better than the previous behaviour (certain Face ID unenrollment), and no new security surface — the key still passed local Face ID, every subsequent call 503s, and a real revocation resurfaces as `clientKeyInvalid` once maintenance ends | Accept as the residual, or promote `.authenticated` on `.maintenanceChecked(true)` — a deliberate scope decision recorded in `plan.md`, so Maxime's call |
| 🟢 | code | 1 | `ios/Pulpe/App/AppState+Maintenance.swift:33-37` | `maintenanceProbeTimeout` is a *cooperative* bound: the deadline task requests `probe.cancel()`, it does not resume the caller. `URLSession.data(for:)` honours cancellation so the 3 s holds in production, but an injected `maintenanceChecking` that ignores cancellation would still block for `requestTimeout`, making the "13 s worst case" comment at `AppConfiguration.swift:133` optimistic. `attemptBiometricUnlockWithinTimeout` (`SessionLifecycleCoordinator.swift:140-151`) uses a `CheckedContinuation` for a *hard* bound because the Face ID prompt may ignore cancellation | Nothing to change: the weaker pattern is the right size for a URLSession call. Worth one word in the comment |
| 🟢 | code | 1 | `ios/Pulpe/App/AppState+SessionReset.swift:33` | The `guard !Task.isCancelled` inside the maintenance branch is uncovered: cancellation makes the probe answer `false`, so no test can reach it. It only fires when the run is cancelled in the window between a `true` probe and the resumption. Correct as a defensive guard; just not asserted anywhere | Leave it. Do not chase a test for a sub-millisecond window |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (9/9) |
| Files checked | `ios/Pulpe/App/AppState+Maintenance.swift`, `ios/Pulpe/App/AppState+SessionReset.swift`, `ios/Pulpe/App/BiometricManager.swift`, `ios/Pulpe/App/Auth/SessionLifecycleCoordinator.swift`, `ios/Pulpe/App/Core/AppFlowReducer.swift`, `ios/Pulpe/App/AppState+FlowState.swift`, `ios/Pulpe/App/AppState+Bootstrap.swift`, `ios/Pulpe/App/AppState+Auth.swift`, `ios/Pulpe/App/AppState+Recovery.swift`, `ios/Pulpe/App/AppState.swift`, `ios/Pulpe/App/RootViewModifiers.swift`, `ios/Pulpe/App/PulpeApp.swift`, `ios/Pulpe/App/Runtime/AppRuntimeCoordinator.swift`, `ios/Pulpe/App/PostAuthResolver.swift`, `ios/Pulpe/App/AppStateDependencies.swift`, `ios/Pulpe/Core/Config/AppConfiguration.swift`, `ios/Pulpe/Core/Maintenance/MaintenanceService.swift`, `ios/Pulpe/Core/Network/APIClient.swift`, `ios/Pulpe/Core/Network/APIError.swift`, `ios/Pulpe/Features/Auth/Pin/PinCryptoProtocols.swift`, `ios/Pulpe/Features/Maintenance/MaintenanceView.swift`, `ios/PulpeTests/App/AppStateMaintenanceForegroundTests.swift`, `ios/PulpeTests/App/BiometricDefaultValidateKeyTests.swift`, `ios/PulpeTests/App/Core/AppFlowReducerTests.swift`, `ios/PulpeTests/App/Core/AppFlowEventRoutingTests.swift`, `ios/PulpeTests/Features/Auth/PinMaintenanceMessageTests.swift` |
| Unchecked     | none |
| Unplanned     | `ios/Pulpe/Features/Maintenance/MaintenanceView.swift:58` (reported as reverted, still present) |
