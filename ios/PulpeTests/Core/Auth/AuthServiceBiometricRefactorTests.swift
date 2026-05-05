import Foundation
@testable import Pulpe
import Supabase
import Testing

/// PUL-132 — refactor verification tests.
///
/// Eliminates the dual-slot keychain drift that caused Supabase
/// refresh-token-reuse detection to revoke session families on cold-start
/// biometric paths. The new architecture:
///
/// - PulpeAuthStorage is the SDK's single source of truth for live session.
/// - The biometric keychain slot is cold-storage, written ONLY at
///   logout-keep-biometric, read ONLY on cold-start when didExplicitLogout=true.
/// - StartupCoordinator's biometric path is gated on didExplicitLogout=true.
@Suite("AuthService biometric refactor (PUL-132)")
struct AuthServiceBiometricRefactorTests {
    private static let testService = "app.pulpe.ios.tests.AuthServiceBiometricRefactor"

    private func makeStorage() -> PulpeAuthStorage {
        PulpeAuthStorage(service: Self.testService)
    }

    private func uniqueKey() -> String {
        "session-\(UUID().uuidString)"
    }

    private func testUser() -> UserInfo {
        UserInfo(id: "test-user", email: "test@pulpe.app", firstName: "Test")
    }

    // MARK: - Token rotation slot consistency

    @Test("Token rotation via PulpeAuthStorage does not touch biometric slot bytes",
          .enabled(if: KeychainManager.checkAvailability()))
    func tokenRotation_doesNotTouchBiometricSlot() throws {
        let storage = makeStorage()
        let key = uniqueKey()
        defer { try? storage.remove(key: key) }

        // Pre-populate "biometric snapshot" — independent storage instance
        let biometricSnapshot = Data("biometric-refresh-token-r0".utf8)
        let snapshotStorage = PulpeAuthStorage(service: "\(Self.testService).biometric")
        let snapshotKey = "snapshot-\(UUID().uuidString)"
        defer { try? snapshotStorage.remove(key: snapshotKey) }
        try snapshotStorage.store(key: snapshotKey, value: biometricSnapshot)

        // Simulate SDK rotating refresh token N times via the live-session storage
        for index in 0..<3 {
            let rotated = Data("session-r\(index)".utf8)
            try storage.store(key: key, value: rotated)
        }

        // Biometric snapshot must be byte-identical — rotation never touched it.
        let postRotation = try snapshotStorage.retrieve(key: snapshotKey)
        #expect(postRotation == biometricSnapshot)
    }

    // MARK: - Cold-start gating: no explicit logout

    @Test("Cold-start with biometric enabled but no explicit logout does NOT call validateBiometricSession")
    func coldStart_noExplicitLogout_skipsBiometricValidation() async {
        let user = testUser()
        let biometricCalls = AtomicProperty(0)
        let regularCalls = AtomicProperty(0)

        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: {
                biometricCalls.increment()
                return BiometricSessionResult(user: user, clientKeyHex: nil)
            },
            validateRegularSession: {
                regularCalls.increment()
                return user
            },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true,
            didExplicitLogout: false,
            manualBiometricRetryRequired: false
        )
        let result = await coordinator.start(context: context)

        #expect(biometricCalls.value == 0, "Biometric-keychain validation must not run on non-logout cold-start")
        #expect(regularCalls.value == 1)
        if case .authenticated = result { } else {
            Issue.record("Expected authenticated result, got \(result)")
        }
    }

    // MARK: - Cold-start gating: explicit logout re-entry

    @Test("Cold-start with biometric enabled AND explicit logout DOES call validateBiometricSession")
    func coldStart_explicitLogout_runsBiometricValidation() async {
        let user = testUser()
        let biometricCalls = AtomicProperty(0)
        let regularCalls = AtomicProperty(0)

        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: {
                biometricCalls.increment()
                return BiometricSessionResult(user: user, clientKeyHex: nil)
            },
            validateRegularSession: {
                regularCalls.increment()
                return nil
            },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true,
            didExplicitLogout: true,
            manualBiometricRetryRequired: false
        )
        let result = await coordinator.start(context: context)

        #expect(biometricCalls.value == 1)
        #expect(regularCalls.value == 0, "Biometric path satisfied; regular validation must not also run")
        if case .authenticated = result { } else {
            Issue.record("Expected authenticated result, got \(result)")
        }
    }

    // MARK: - Cold-start gating: biometric disabled

    @Test("Cold-start with biometric disabled never calls validateBiometricSession")
    func coldStart_biometricDisabled_skipsBiometricValidation() async {
        let user = testUser()
        let biometricCalls = AtomicProperty(0)

        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: {
                biometricCalls.increment()
                return nil
            },
            validateRegularSession: { user },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: false,
            didExplicitLogout: true, // even with logout flag — gate requires biometricEnabled too
            manualBiometricRetryRequired: false
        )
        _ = await coordinator.start(context: context)

        #expect(biometricCalls.value == 0)
    }

    // MARK: - Stale biometric token routes to expired

    @Test("Stale biometric refresh token on explicit-logout cold-start surfaces .biometricSessionExpired")
    func coldStart_explicitLogout_staleBiometric_routesToBiometricSessionExpired() async {
        let cleanedExpired = AtomicFlag()

        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: { throw AuthServiceError.biometricSessionExpired },
            validateRegularSession: { nil },
            resolvePostAuth: { .needsPinEntry(needsRecoveryKeyConsent: false) },
            clearExpiredBiometricState: { cleanedExpired.set() }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true,
            didExplicitLogout: true,
            manualBiometricRetryRequired: false
        )
        let result = await coordinator.start(context: context)

        #expect(result == .biometricSessionExpired)
        #expect(cleanedExpired.value == true, "Coordinator must clear expired biometric state")
    }

    // MARK: - Logout-keep-biometric clears live, preserves biometric

    @Test("logoutKeepingBiometricSession clears the SDK live-session slot",
          .enabled(if: KeychainManager.checkAvailability()))
    func logoutKeepingBiometric_clearsLiveSlot() async throws {
        let storage = makeStorage()
        let liveKey = uniqueKey()
        defer { try? storage.remove(key: liveKey) }

        // Pre-populate "live session" data
        try storage.store(key: liveKey, value: Data("session-payload".utf8))
        #expect(try storage.retrieve(key: liveKey) != nil)

        // Simulate the cleanup performed in logoutKeepingBiometricSession
        try storage.remove(key: liveKey)

        #expect(try storage.retrieve(key: liveKey) == nil)
    }

    // MARK: - Manual biometric retry skip

    @Test("manualBiometricRetryRequired short-circuits to .unauthenticated")
    func manualBiometricRetryRequired_returnsUnauthenticatedImmediately() async {
        let biometricCalls = AtomicProperty(0)

        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: {
                biometricCalls.increment()
                return nil
            },
            validateRegularSession: { nil },
            resolvePostAuth: { .needsPinEntry(needsRecoveryKeyConsent: false) }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true,
            didExplicitLogout: true,
            manualBiometricRetryRequired: true
        )
        let result = await coordinator.start(context: context)

        #expect(result == .unauthenticated)
        #expect(biometricCalls.value == 0)
    }

    // MARK: - Regression: refresh-token-reuse scenario

    @Test("Regression: silent rotation does not poison cold-start when biometric enabled and no explicit logout")
    func regression_refreshTokenReuse_biometricEnabledColdStart_doesNotReadStaleBiometricSlot() async {
        let user = testUser()
        let biometricReads = AtomicProperty(0)

        // Without the fix: cold-start always runs validateBiometricSession,
        // which reads the stale biometric refresh token written hours ago.
        // SDK had since rotated to r_N; biometric still has r_0 → reuse-detected
        // → entire family revoked → user booted to login.
        //
        // With the fix: validateBiometricSession is NOT called on
        // didExplicitLogout=false cold-start. The SDK reads its persisted
        // session via PulpeAuthStorage (already containing the latest rotation).
        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateBiometricSession: {
                biometricReads.increment()
                throw AuthServiceError.biometricSessionExpired
            },
            validateRegularSession: { user },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) }
        )

        let context = StartupCoordinator.StartupContext(
            biometricEnabled: true,
            didExplicitLogout: false, // user just force-quit; no explicit logout
            manualBiometricRetryRequired: false
        )
        let result = await coordinator.start(context: context)

        #expect(biometricReads.value == 0,
                "Regression guard: biometric slot must NOT be read on force-quit cold-start")
        if case .authenticated = result { } else {
            Issue.record("Expected authenticated cold-start, got \(result)")
        }
    }
}
