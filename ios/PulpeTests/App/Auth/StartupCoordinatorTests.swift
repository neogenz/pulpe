// swiftlint:disable file_length
import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
struct StartupCoordinatorTests {
    private let testUser = UserInfo(id: "startup-user", email: "startup@pulpe.app", firstName: "Startup")

    // MARK: - Factory

    private func makeCoordinator(
        checkMaintenance: (@Sendable () async throws -> Bool)? = nil,
        validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)? = nil,
        validateRegularSession: (@Sendable () async throws -> UserInfo?)? = nil,
        resolvePostAuth: (@Sendable () async -> PostAuthDestination)? = nil,
        validateBiometricKey: (@Sendable (String) async -> Bool)? = nil,
        storeSessionClientKey: (@Sendable (String) async -> Void)? = nil,
        clearStaleBiometricState: (@Sendable () async -> Void)? = nil,
        clearExpiredBiometricState: (@Sendable () async -> Void)? = nil,
        timeout: Duration = StartupCoordinator.defaultTimeout
    ) -> StartupCoordinator {
        StartupCoordinator(
            checkMaintenance: checkMaintenance ?? { false },
            validateBiometricSession: validateBiometricSession ?? { nil },
            validateRegularSession: validateRegularSession ?? { nil },
            resolvePostAuth: resolvePostAuth ?? { .authenticated(needsRecoveryKeyConsent: false) },
            validateBiometricKey: validateBiometricKey ?? { _ in true },
            storeSessionClientKey: storeSessionClientKey ?? { _ in },
            clearStaleBiometricState: clearStaleBiometricState ?? {},
            clearExpiredBiometricState: clearExpiredBiometricState ?? {},
            timeout: timeout
        )
    }

    private func makeContext(
        biometricEnabled: Bool = false,
        didExplicitLogout: Bool = false,
        manualBiometricRetryRequired: Bool = false
    ) -> StartupCoordinator.StartupContext {
        StartupCoordinator.StartupContext(
            biometricEnabled: biometricEnabled,
            didExplicitLogout: didExplicitLogout,
            manualBiometricRetryRequired: manualBiometricRetryRequired
        )
    }

    // MARK: - Basic Flow Tests

    @Test func start_noSession_returnsUnauthenticated() async {
        let sut = makeCoordinator()

        let result = await sut.start(context: makeContext())

        #expect(result == .unauthenticated)
    }

    @Test func start_withValidRegularSession_returnsAuthenticated() async {
        let sut = makeCoordinator(
            validateRegularSession: { [testUser] in testUser },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) }
        )

        let result = await sut.start(context: makeContext())

        if case .authenticated(let user, let destination) = result {
            #expect(user.id == testUser.id)
            #expect(destination == .authenticated(needsRecoveryKeyConsent: false))
        } else {
            Issue.record("Expected authenticated result")
        }
    }

    @Test func start_withValidBiometricSession_returnsAuthenticated() async {
        let biometricResult = BiometricSessionResult(user: testUser, clientKeyHex: "key123")
        let sut = makeCoordinator(
            validateBiometricSession: { biometricResult },
            resolvePostAuth: { .needsPinEntry(needsRecoveryKeyConsent: false) }
        )

        let result = await sut.start(context: makeContext(biometricEnabled: true))

        if case .authenticated(let user, let destination) = result {
            #expect(user.id == testUser.id)
            #expect(destination == .needsPinEntry(needsRecoveryKeyConsent: false))
        } else {
            Issue.record("Expected authenticated result")
        }
    }

    @Test func start_biometricDisabled_skipsbiometricValidation() async {
        let biometricCalled = AtomicFlag()
        let sut = makeCoordinator(
            validateBiometricSession: {
                biometricCalled.set()
                return nil
            },
            validateRegularSession: { [testUser] in testUser }
        )

        _ = await sut.start(context: makeContext(biometricEnabled: false))

        #expect(biometricCalled.value == false)
    }

    @Test func start_explicitLogout_skipsbiometricValidation() async {
        let biometricCalled = AtomicFlag()
        let sut = makeCoordinator(
            validateBiometricSession: {
                biometricCalled.set()
                return nil
            },
            resolvePostAuth: { .unauthenticatedSessionExpired }
        )

        _ = await sut.start(context: makeContext(biometricEnabled: true, didExplicitLogout: true))

        #expect(biometricCalled.value == false)
    }

    @Test func start_maintenance_returnsMaintenance() async {
        let sut = makeCoordinator(
            checkMaintenance: { true }
        )

        let result = await sut.start(context: makeContext())

        #expect(result == .maintenance)
    }

    @Test func start_maintenanceNetworkError_returnsNetworkError() async {
        let sut = makeCoordinator(
            checkMaintenance: { throw URLError(.notConnectedToInternet) }
        )

        let result = await sut.start(context: makeContext())

        if case .networkError = result {
            // Success
        } else {
            Issue.record("Expected network error from maintenance check, got \(result)")
        }
    }

    @Test func start_maintenanceServerError_returnsMaintenance() async {
        struct MaintenanceBackendError: Error {}

        let sut = makeCoordinator(
            checkMaintenance: { throw MaintenanceBackendError() }
        )

        let result = await sut.start(context: makeContext())

        #expect(result == .maintenance)
    }

    @Test func start_networkError_returnsNetworkError() async {
        let sut = makeCoordinator(
            validateBiometricSession: { throw URLError(.notConnectedToInternet) }
        )

        let result = await sut.start(context: makeContext(biometricEnabled: true))

        if case .networkError = result {
            // Success
        } else {
            Issue.record("Expected network error result, got \(result)")
        }
    }

    @Test func start_biometricSessionExpired_returnsExpiredResult() async {
        let expiredHandled = AtomicFlag()
        let sut = makeCoordinator(
            validateBiometricSession: { throw AuthServiceError.biometricSessionExpired },
            clearExpiredBiometricState: {
                expiredHandled.set()
            }
        )

        let result = await sut.start(context: makeContext(biometricEnabled: true))

        #expect(result == .biometricSessionExpired)
        #expect(expiredHandled.value == true)
    }

    @Test func start_unknownBiometricError_returnsExpiredResult() async {
        struct UnknownStartupError: Error {}

        let expiredHandled = AtomicFlag()
        let sut = makeCoordinator(
            validateBiometricSession: { throw UnknownStartupError() },
            clearExpiredBiometricState: {
                expiredHandled.set()
            }
        )

        let result = await sut.start(context: makeContext(biometricEnabled: true))

        #expect(result == .biometricSessionExpired)
        #expect(expiredHandled.value == true)
    }

    @Test func start_staleBiometricKey_clearsStaleState_andAuthenticates() async {
        let staleHandled = AtomicFlag()
        let storedKey = AtomicProperty<String?>(nil)
        let biometricResult = BiometricSessionResult(user: testUser, clientKeyHex: "stale-key")
        let sut = makeCoordinator(
            validateBiometricSession: { biometricResult },
            validateBiometricKey: { _ in false },
            storeSessionClientKey: { key in
                storedKey.set(key)
            },
            clearStaleBiometricState: {
                staleHandled.set()
            }
        )

        let result = await sut.start(context: makeContext(biometricEnabled: true))

        if case .authenticated(let user, _) = result {
            #expect(user.id == testUser.id)
        } else {
            Issue.record("Expected authenticated result when biometric session is valid")
        }
        #expect(staleHandled.value == true)
        #expect(storedKey.value == nil, "Stale biometric key must not be persisted in session keychain")
    }

    @Test func start_validBiometricKey_persistsSessionKey() async {
        let storedKey = AtomicProperty<String?>(nil)
        let biometricResult = BiometricSessionResult(user: testUser, clientKeyHex: "valid-key")
        let sut = makeCoordinator(
            validateBiometricSession: { biometricResult },
            validateBiometricKey: { _ in true },
            storeSessionClientKey: { key in
                storedKey.set(key)
            }
        )

        _ = await sut.start(context: makeContext(biometricEnabled: true))

        #expect(storedKey.value == "valid-key")
    }

    @Test func start_manualBiometricRetryRequired_returnsUnauthenticated() async {
        let sut = makeCoordinator(
            validateRegularSession: { [testUser] in testUser }
        )

        let result = await sut.start(context: makeContext(manualBiometricRetryRequired: true))

        #expect(result == .unauthenticated)
    }

    // MARK: - Re-entrancy Tests

    @Test func start_whileRunning_cancelsPreviousRun() async {
        let startedFirst = AtomicFlag()
        let continueFirst = AtomicFlag()
        let firstCallCompleted = AtomicFlag()

        let sut = makeCoordinator(
            validateRegularSession: {
                if !startedFirst.value {
                    startedFirst.set()
                    // Wait to be cancelled
                    while !continueFirst.value {
                        try await Task.sleep(for: .milliseconds(10))
                        if Task.isCancelled { throw CancellationError() }
                    }
                    firstCallCompleted.set()
                }
                return nil
            }
        )

        // Start first run
        let firstTask = Task {
            await sut.start(context: makeContext())
        }

        // Wait for first run to start
        await waitForCondition(timeout: .milliseconds(500), "first run must start") {
            startedFirst.value
        }

        // Start second run (should cancel first)
        let secondResult = await sut.start(context: makeContext())

        // Allow first to continue (it should be cancelled)
        continueFirst.set()
        let firstResult = await firstTask.value

        #expect(firstResult == .cancelled)
        #expect(secondResult == .unauthenticated)
        #expect(firstCallCompleted.value == false)
    }

    @Test func retry_afterFailure_runsAgain() async {
        let callCount = AtomicProperty<Int>(0)
        let sut = makeCoordinator(
            validateRegularSession: { [testUser] in
                callCount.increment()
                if callCount.value == 1 {
                    throw URLError(.networkConnectionLost)
                }
                return testUser
            }
        )

        // First attempt fails
        let firstResult = await sut.start(context: makeContext())
        #expect(firstResult == .unauthenticated)

        // Retry succeeds
        let retryResult = await sut.retry(context: makeContext())
        if case .authenticated = retryResult {
            #expect(callCount.value == 2)
        } else {
            Issue.record("Expected authenticated on retry")
        }
    }

    @Test func cancel_whileRunning_returnsCancelled() async {
        let started = AtomicFlag()

        let sut = makeCoordinator(
            validateRegularSession: {
                started.set()
                // Long-running operation
                try await Task.sleep(for: .seconds(10))
                return nil
            }
        )

        let task = Task {
            await sut.start(context: makeContext())
        }

        // Wait for validation to start
        await waitForCondition(timeout: .milliseconds(500), "validation must start") {
            started.value
        }

        // Cancel
        await sut.cancel()

        let result = await task.value
        #expect(result == .cancelled)
    }

    // MARK: - State Tests

    @Test func state_idle_beforeStart() async {
        let sut = makeCoordinator()

        let state = await sut.state
        #expect(state == .idle)
    }

    @Test func state_completed_afterStart() async {
        let sut = makeCoordinator()

        _ = await sut.start(context: makeContext())

        let state = await sut.state
        if case .completed(.unauthenticated) = state {
            // Success
        } else {
            Issue.record("Expected completed state")
        }
    }

    @Test func reset_clearsState() async {
        let sut = makeCoordinator()

        _ = await sut.start(context: makeContext())
        await sut.reset()

        let state = await sut.state
        #expect(state == .idle)
    }
}

// MARK: - StartupResult Mapping Tests

@Suite(.serialized)
struct StartupResultMappingTests {
    private let testUser = UserInfo(id: "map-user", email: "map@pulpe.app", firstName: "Map")

    @Test func authState_authenticated_needsPinSetup() {
        let result = StartupCoordinator.StartupResult.authenticated(
            user: testUser,
            destination: .needsPinSetup
        )
        #expect(result.authState == .needsPinSetup)
    }

    @Test func authState_authenticated_needsPinEntry() {
        let result = StartupCoordinator.StartupResult.authenticated(
            user: testUser,
            destination: .needsPinEntry(needsRecoveryKeyConsent: false)
        )
        #expect(result.authState == .needsPinEntry)
    }

    @Test func authState_authenticated_fullyAuthenticated() {
        let result = StartupCoordinator.StartupResult.authenticated(
            user: testUser,
            destination: .authenticated(needsRecoveryKeyConsent: false)
        )
        #expect(result.authState == .authenticated)
    }

    @Test func authState_unauthenticated() {
        let result = StartupCoordinator.StartupResult.unauthenticated
        #expect(result.authState == .unauthenticated)
    }

    @Test func authState_networkError() {
        let result = StartupCoordinator.StartupResult.networkError("error")
        #expect(result.authState == .unauthenticated)
    }

    @Test func authState_biometricSessionExpired() {
        let result = StartupCoordinator.StartupResult.biometricSessionExpired
        #expect(result.authState == .unauthenticated)
    }

    @Test func authState_maintenance() {
        let result = StartupCoordinator.StartupResult.maintenance
        #expect(result.authState == .loading)
    }

    @Test func authState_timeout() {
        let result = StartupCoordinator.StartupResult.timeout
        #expect(result.authState == .loading)
    }
}

// MARK: - Timeout Tests

@Suite(.serialized)
struct StartupCoordinatorTimeoutTests {
    private let testUser = UserInfo(id: "timeout-user", email: "timeout@pulpe.app", firstName: "Timeout")

    private func makeCoordinator(
        checkMaintenance: (@Sendable () async throws -> Bool)? = nil,
        validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)? = nil,
        validateRegularSession: (@Sendable () async throws -> UserInfo?)? = nil,
        resolvePostAuth: (@Sendable () async -> PostAuthDestination)? = nil,
        timeout: Duration
    ) -> StartupCoordinator {
        StartupCoordinator(
            checkMaintenance: checkMaintenance ?? { false },
            validateBiometricSession: validateBiometricSession ?? { nil },
            validateRegularSession: validateRegularSession ?? { nil },
            resolvePostAuth: resolvePostAuth ?? { .authenticated(needsRecoveryKeyConsent: false) },
            timeout: timeout
        )
    }

    private func makeContext(
        biometricEnabled: Bool = false,
        didExplicitLogout: Bool = false,
        manualBiometricRetryRequired: Bool = false
    ) -> StartupCoordinator.StartupContext {
        StartupCoordinator.StartupContext(
            biometricEnabled: biometricEnabled,
            didExplicitLogout: didExplicitLogout,
            manualBiometricRetryRequired: manualBiometricRetryRequired
        )
    }

    @Test func start_exceedsTimeout_returnsTimeout() async {
        let sut = makeCoordinator(
            validateRegularSession: {
                // Hang longer than the timeout
                try await Task.sleep(for: .seconds(10))
                return nil
            },
            timeout: .milliseconds(100)
        )

        let result = await sut.start(context: makeContext())

        #expect(result == .timeout)
    }

    @Test func start_completesBeforeTimeout_returnsNormalResult() async {
        let sut = makeCoordinator(
            validateRegularSession: { [testUser] in
                // Complete quickly
                try await Task.sleep(for: .milliseconds(10))
                return testUser
            },
            timeout: .seconds(5)
        )

        let result = await sut.start(context: makeContext())

        if case .authenticated(let user, _) = result {
            #expect(user.id == testUser.id)
        } else {
            Issue.record("Expected authenticated result, got \(result)")
        }
    }

    @Test func start_timeout_cancelsHangingOperation() async {
        let operationCancelled = AtomicFlag()

        let sut = makeCoordinator(
            validateRegularSession: {
                do {
                    try await Task.sleep(for: .seconds(10))
                    return nil
                } catch is CancellationError {
                    operationCancelled.set()
                    throw CancellationError()
                }
            },
            timeout: .milliseconds(100)
        )

        let result = await sut.start(context: makeContext())

        #expect(result == .timeout)
        // Give the cancellation a moment to propagate
        await waitForCondition(timeout: .milliseconds(200), "operation should be cancelled") {
            operationCancelled.value
        }
    }

    @Test func retry_afterTimeout_runsCleanStartup() async {
        let callCount = AtomicProperty<Int>(0)

        let sut = makeCoordinator(
            validateRegularSession: { [testUser] in
                callCount.increment()
                if callCount.value == 1 {
                    // First call hangs
                    try await Task.sleep(for: .seconds(10))
                    return nil
                }
                // Second call succeeds quickly
                return testUser
            },
            timeout: .milliseconds(100)
        )

        // First attempt times out
        let firstResult = await sut.start(context: makeContext())
        #expect(firstResult == .timeout)

        // Retry with longer timeout succeeds
        let retryCoordinator = makeCoordinator(
            validateRegularSession: { [testUser] in testUser },
            timeout: .seconds(5)
        )
        let retryResult = await retryCoordinator.start(context: makeContext())
        if case .authenticated = retryResult {
            // Success
        } else {
            Issue.record("Expected authenticated on retry, got \(retryResult)")
        }
    }

    @Test func state_completedTimeout_afterTimeout() async {
        let sut = makeCoordinator(
            validateRegularSession: {
                try await Task.sleep(for: .seconds(10))
                return nil
            },
            timeout: .milliseconds(100)
        )

        _ = await sut.start(context: makeContext())

        let state = await sut.state
        if case .completed(.timeout) = state {
            // Success
        } else {
            Issue.record("Expected completed timeout state, got \(state)")
        }
    }

    @Test func start_biometricEnabled_doesNotTimeout() async {
        let testUser = UserInfo(id: "bio-timeout", email: "bio@pulpe.app", firstName: "Bio")
        let biometricResult = BiometricSessionResult(user: testUser, clientKeyHex: "key123")

        let sut = makeCoordinator(
            validateBiometricSession: {
                // Simulate slow FaceID (user not holding phone)
                try await Task.sleep(for: .milliseconds(300))
                return biometricResult
            },
            timeout: .milliseconds(100) // Timeout shorter than biometric
        )

        let result = await sut.start(
            context: makeContext(biometricEnabled: true)
        )

        // Should NOT timeout — biometric path skips the startup timeout
        if case .authenticated(let user, _) = result {
            #expect(user.id == testUser.id)
        } else {
            Issue.record("Expected authenticated (biometric should bypass timeout), got \(result)")
        }
    }

    @Test func start_biometricEnabled_explicitLogout_stillTimesOut() async {
        let sut = makeCoordinator(
            validateRegularSession: {
                // Hang longer than the timeout
                try await Task.sleep(for: .seconds(10))
                return nil
            },
            timeout: .milliseconds(100)
        )

        // biometricEnabled but didExplicitLogout → FaceID won't run → timeout applies
        let result = await sut.start(
            context: makeContext(biometricEnabled: true, didExplicitLogout: true)
        )

        #expect(result == .timeout)
    }
}

// MARK: - Biometric Dismiss Tests

@Suite(.serialized)
struct StartupCoordinatorBiometricDismissTests {
    private func makeCoordinator(
        validateBiometricSession: @escaping @Sendable () async throws -> BiometricSessionResult?,
        clearExpiredBiometricState: @escaping @Sendable () async -> Void
    ) -> StartupCoordinator {
        StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: validateBiometricSession,
            validateRegularSession: { nil },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) },
            clearExpiredBiometricState: clearExpiredBiometricState
        )
    }

    @Test func start_biometricUserCanceled_returnsUnauthenticated_preservesBiometricState() async {
        let expiredHandled = AtomicFlag()
        let sut = makeCoordinator(
            validateBiometricSession: { throw KeychainError.userCanceled },
            clearExpiredBiometricState: { expiredHandled.set() }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true, didExplicitLogout: false, manualBiometricRetryRequired: false
        )
        let result = await sut.start(context: context)

        #expect(result == .unauthenticated)
        #expect(expiredHandled.value == false, "Biometric state must NOT be cleared on user cancel")
    }

    @Test func start_biometricAuthFailed_returnsUnauthenticated_preservesBiometricState() async {
        let expiredHandled = AtomicFlag()
        let sut = makeCoordinator(
            validateBiometricSession: { throw KeychainError.authFailed },
            clearExpiredBiometricState: { expiredHandled.set() }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true, didExplicitLogout: false, manualBiometricRetryRequired: false
        )
        let result = await sut.start(context: context)

        #expect(result == .unauthenticated)
        #expect(expiredHandled.value == false, "Biometric state must NOT be cleared on auth failure")
    }
}
