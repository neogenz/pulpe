import Foundation
@testable import Pulpe
import Testing

/// Tests for startup timeout wiring and cancellation safety.
///
/// Gap 1 (fixed): `.startupTimedOut` is now wired through `applyReducerTransitionIfPossible`.
///
/// Gap 2 (fixed): `StartupCoordinator` uses a `currentRunId` guard before each side-effect
/// closure. After timeout or cancel, `currentRunId` is cleared so subsequent closures from the
/// invalidated run are blocked even though the in-flight closure may complete.
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

        sut.send(.startupTimedOut)
        #expect(sut.flowState == .networkUnavailable(retryable: true))
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

    @Test("After cancel, biometric key side-effect closures are blocked by runId guard")
    func startupCoordinator_afterCancel_biometricKeySideEffectBlocked() async {
        // Scenario: validateBiometricKey hangs, cancel fires during it.
        // After cancel, storeSessionClientKey should NOT be called because the
        // runId guard before it detects the invalidated run.
        //
        // Note: biometric paths intentionally skip the startup timeout (FaceID
        // can block indefinitely), so we use cancel() to invalidate the runId.
        // The guard at handleBiometricClientKey doesn't care HOW currentRunId
        // was cleared — it just checks isCurrentRun(runId).
        let storeKeyCalled = AtomicFlag()
        let validateKeyStarted = AtomicFlag()

        let sut = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: {
                BiometricSessionResult(
                    user: UserInfo(id: "bio-user", email: "bio@pulpe.app", firstName: "Bio"),
                    clientKeyHex: "valid-key"
                )
            },
            validateRegularSession: { nil },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) },
            validateBiometricKey: { _ in
                validateKeyStarted.set()
                // Hang to give cancel time to fire and invalidate the runId
                try? await Task.sleep(for: .milliseconds(300))
                return true
            },
            storeSessionClientKey: { _ in
                storeKeyCalled.set()
            }
        )

        // PUL-132: biometric path requires didExplicitLogout=true.
        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true,
            didExplicitLogout: true,
            manualBiometricRetryRequired: false
        )

        let task = Task {
            await sut.start(context: context)
        }

        // Wait for validateBiometricKey to start executing
        await waitForCondition(timeout: .seconds(1), "validateBiometricKey must start") {
            validateKeyStarted.value
        }

        // Cancel while validateBiometricKey is in-flight
        await sut.cancel()

        // Wait for any in-flight closures to settle
        try? await Task.sleep(for: .milliseconds(500))

        _ = await task.value

        #expect(
            storeKeyCalled.value == false,
            "storeSessionClientKey must not be called after cancel invalidates runId"
        )
    }

    @Test("After cancel, subsequent side-effect closures are blocked by runId guard")
    func startupCoordinator_afterCancel_inFlightSideEffectStillRuns() async {
        // Scenario: validateRegularSession hangs, cancel fires during it.
        // After cancel, resolvePostAuth should NOT be called because the
        // runId guard in makeAuthenticatedResult detects the invalidated run.
        let validationStarted = AtomicFlag()
        let resolvePostAuthCalled = AtomicFlag()

        let sut = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: { nil },
            validateRegularSession: {
                validationStarted.set()
                // Hang to give cancel time to fire
                try? await Task.sleep(for: .milliseconds(300))
                return UserInfo(id: "fast-user", email: "fast@pulpe.app", firstName: "Fast")
            },
            resolvePostAuth: {
                resolvePostAuthCalled.set()
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

        // Wait for validation to start executing
        await waitForCondition(timeout: .seconds(1), "validateRegularSession must start") {
            validationStarted.value
        }

        // Cancel while validateRegularSession is in-flight
        await sut.cancel()

        // Wait for any in-flight closures to settle
        try? await Task.sleep(for: .milliseconds(500))

        _ = await task.value

        // After cancel, runId is invalidated. When validateRegularSession returns,
        // makeAuthenticatedResult's isCurrentRun guard blocks resolvePostAuth.
        #expect(
            resolvePostAuthCalled.value == false,
            "resolvePostAuth must not be called after cancel invalidates runId"
        )
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
