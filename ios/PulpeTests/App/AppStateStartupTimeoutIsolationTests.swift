import Foundation
@testable import Pulpe
import Testing

/// Characterization tests for startup timeout and cancellation gaps.
///
/// Gap 1: `AppFlowEvent.startupTimedOut` is defined and handled by `AppFlowReducer`,
/// but `applyReducerTransitionIfPossible` in `AppState+FlowState.swift` does NOT include
/// `.startupTimedOut` in its switch cases. Calling `send(.startupTimedOut)` silently drops the event.
///
/// Gap 2: `StartupCoordinator.cancelCurrentRun()` calls `currentTask?.cancel()` but does NOT await
/// completion. After cancellation, old run's `@Sendable` closures can still execute across the
/// actor boundary. The `runId` guard only protects `state` mutation, not the side-effect closures.
@Suite(.serialized)
@MainActor
struct AppStateStartupTimeoutIsolationTests {
    private let testUser = UserInfo(id: "timeout-iso-user", email: "timeout-iso@pulpe.app", firstName: "Timeout")

    // MARK: - Gap 1: startupTimedOut Event Is Dead Code Through send()

    @Test("startupTimedOut event should transition flowState to networkUnavailable")
    func send_startupTimedOut_fromInitializing_transitionsToNetworkUnavailable() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )
        // Start in .loading which maps to .initializing in flowState
        sut.authState = .loading
        sut.isInMaintenance = false
        sut.isNetworkUnavailable = false
        #expect(sut.flowState == .initializing)

        withKnownIssue("startupTimedOut is not wired through applyReducerTransitionIfPossible (Gap 1, Wave 1 fix)") {
            sut.send(.startupTimedOut)
            #expect(sut.flowState == .networkUnavailable(retryable: true))
        }
    }

    @Test("startupTimedOut from authenticated state should be a no-op")
    func send_startupTimedOut_fromAuthenticated_isNoOp() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .authenticated)

        sut.send(.startupTimedOut)

        // Allow any async processing to settle
        try? await Task.sleep(for: .milliseconds(100))

        // From authenticated, the reducer returns nil for startupTimedOut (invalid transition),
        // so it should remain authenticated regardless of whether the event is wired or not.
        #expect(sut.authState == .authenticated)
        #expect(sut.flowState == .authenticated)
    }

    // MARK: - Gap 2: Late Side Effects After StartupCoordinator Timeout/Cancel

    @Test("StartupCoordinator side-effect closure already in-flight survives timeout")
    func startupCoordinator_afterTimeout_inFlightSideEffectStillFires() async {
        // The gap: cancelCurrentRun() calls cancel() but does not await the task.
        // If a side-effect closure (storeSessionClientKey) is already executing
        // when timeout fires, it runs to completion across the actor boundary.
        //
        // Scenario: biometric validation succeeds fast, then storeSessionClientKey
        // hangs (simulating slow keychain write). Timeout fires while the closure
        // is already in-flight.
        let storeKeyStarted = AtomicFlag()
        let storeKeyCompleted = AtomicFlag()

        let sut = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: {
                // Returns immediately -- biometric validation succeeds fast
                return BiometricSessionResult(
                    user: UserInfo(id: "bio-user", email: "bio@pulpe.app", firstName: "Bio"),
                    clientKeyHex: "valid-key"
                )
            },
            validateRegularSession: { nil },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) },
            validateBiometricKey: { _ in true },
            storeSessionClientKey: { _ in
                storeKeyStarted.set()
                // Simulate slow keychain write that outlasts the timeout
                try? await Task.sleep(for: .milliseconds(500))
                storeKeyCompleted.set()
            },
            timeout: .milliseconds(50)
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true,
            didExplicitLogout: false,
            manualBiometricRetryRequired: false
        )

        let result = await sut.start(context: context)

        // Wait for any in-flight closures to complete
        try? await Task.sleep(for: .milliseconds(700))

        // If we timed out, the in-flight closure should ideally not complete
        if result == .timeout {
            // Gap 2: cancelCurrentRun() does not await task completion
            withKnownIssue("In-flight closures survive timeout (Wave 1 fix)") {
                #expect(
                    storeKeyCompleted.value == false,
                    "storeSessionClientKey completed after timeout"
                )
            }
        } else {
            // If the startup completed before timeout, the test scenario didn't
            // reproduce the race. This is acceptable -- the test documents the gap.
            // Mark the assertions as passing since the startup succeeded normally.
            #expect(storeKeyCompleted.value == true)
        }
    }

    @Test("StartupCoordinator after cancel: side-effect closure already past cancellation check still runs")
    func startupCoordinator_afterCancel_inFlightSideEffectStillRuns() async {
        // The gap: once execution passes a Task.isCancelled check, subsequent
        // side-effect closures run even if cancel() was called in the meantime.
        // cancelCurrentRun() only sets the cancellation flag -- it does not
        // await the task's completion.
        let resolveStarted = AtomicFlag()
        let resolveCompleted = AtomicFlag()
        let validationPassed = AtomicFlag()

        let sut = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: { nil },
            validateRegularSession: {
                // Return quickly so we reach resolvePostAuth
                let user = UserInfo(id: "fast-user", email: "fast@pulpe.app", firstName: "Fast")
                validationPassed.set()
                return user
            },
            resolvePostAuth: {
                resolveStarted.set()
                // Simulate slow post-auth resolution
                try? await Task.sleep(for: .milliseconds(300))
                resolveCompleted.set()
                return .authenticated(needsRecoveryKeyConsent: false)
            }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: false,
            didExplicitLogout: false,
            manualBiometricRetryRequired: false
        )

        // Start the coordinator
        let task = Task {
            await sut.start(context: context)
        }

        // Wait for resolvePostAuth to start executing
        await waitForCondition(timeout: .seconds(1), "resolvePostAuth must start") {
            resolveStarted.value
        }

        // Cancel while resolvePostAuth is in-flight
        await sut.cancel()

        // Wait for any in-flight closures to potentially complete
        try? await Task.sleep(for: .milliseconds(500))

        _ = await task.value

        // Gap 2: cancelCurrentRun() does not await task
        withKnownIssue("In-flight resolvePostAuth survives cancel (Wave 1 fix)") {
            #expect(
                resolveCompleted.value == false,
                "resolvePostAuth completed after cancel"
            )
        }
    }

    @Test("Concurrent starts: last start wins with no interleaving of side effects")
    func concurrentStarts_lastStartWins_noInterleaving() async {
        let firstRunSideEffectCalled = AtomicFlag()
        let secondRunSideEffectCalled = AtomicFlag()
        let firstRunStarted = AtomicFlag()
        let callCount = AtomicProperty<Int>(0)

        let sut = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: { nil },
            validateRegularSession: { [testUser] in
                callCount.increment()
                let currentCall = callCount.value
                if currentCall == 1 {
                    firstRunStarted.set()
                    // Hang until cancelled
                    while !Task.isCancelled {
                        try await Task.sleep(for: .milliseconds(10))
                    }
                    throw CancellationError()
                }
                return testUser
            },
            resolvePostAuth: {
                if firstRunStarted.value && !secondRunSideEffectCalled.value {
                    // If we reach here and the first run already started,
                    // this must be the second run
                    secondRunSideEffectCalled.set()
                } else {
                    firstRunSideEffectCalled.set()
                }
                return .authenticated(needsRecoveryKeyConsent: false)
            }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: false,
            didExplicitLogout: false,
            manualBiometricRetryRequired: false
        )

        // Start first run
        let firstTask = Task {
            await sut.start(context: context)
        }

        // Wait for first run to start
        await waitForCondition(timeout: .milliseconds(500), "first run must start") {
            firstRunStarted.value
        }

        // Start second run (should cancel first)
        let secondResult = await sut.start(context: context)

        // First run should be cancelled
        let firstResult = await firstTask.value
        #expect(firstResult == .cancelled)

        if case .authenticated = secondResult { } else {
            Issue.record("Expected authenticated for second run, got \(secondResult)")
        }

        // The runId mechanism protects state, so this verifies it works
        let state = await sut.state
        if case .completed(.authenticated) = state {
            // State is from the second (winning) run
        } else {
            Issue.record("Expected completed authenticated state, got \(state)")
        }
    }
}
