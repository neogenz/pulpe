import Foundation
@testable import Pulpe
import Supabase
import Testing

@Suite("AuthService biometric storage")
struct AuthServiceBiometricRefactorTests {
    private static let testService = "app.pulpe.ios.tests.AuthServiceBiometricRefactor"

    private func makeStorage() -> PulpeAuthStorage {
        PulpeAuthStorage(service: Self.testService)
    }

    private func testUser() -> UserInfo {
        UserInfo(id: "test-user", email: "test@pulpe.app", firstName: "Test")
    }

    @Test("Session storage key matches the SupabaseClient default")
    func sessionStorageKey_matchesSupabaseClientDefault() throws {
        let host = try #require(AppConfiguration.supabaseURL.host)
        let projectRef = try #require(host.split(separator: ".").first)

        #expect(PulpeAuthStorage.sessionStorageKey == "sb-\(projectRef)-auth-token")
    }

    @Test("Supabase sessionMissing is terminal only after persisted state is gone")
    func sessionRefreshPolicy_requiresMissingPersistedSession() {
        #expect(AuthService.isTerminalSessionFailure(AuthError.sessionMissing))
        #expect(
            !AuthService.isConfirmedTerminalSessionFailure(
                AuthError.sessionMissing,
                persistedSessionExists: true
            )
        )
        #expect(
            AuthService.isConfirmedTerminalSessionFailure(
                AuthError.sessionMissing,
                persistedSessionExists: false
            )
        )
    }

    @Test("Transport and server refresh failures preserve the session")
    func sessionRefreshPolicy_transientFailures_areNotTerminal() throws {
        let url = try #require(URL(string: "https://example.com/auth/v1/token"))
        let response = makeHTTPResponse(for: URLRequest(url: url), statusCode: 503)
        let serverError = AuthError.api(
            message: "Service unavailable",
            errorCode: .unexpectedFailure,
            underlyingData: Data(),
            underlyingResponse: response
        )

        #expect(!AuthService.isTerminalSessionFailure(URLError(.timedOut)))
        #expect(!AuthService.isTerminalSessionFailure(serverError))
    }

    @Test(
        "Token rotation via PulpeAuthStorage does not touch biometric slot bytes",
        .enabled(if: KeychainManager.checkAvailability())
    )
    func tokenRotation_doesNotTouchBiometricSlot() throws {
        let storage = makeStorage()
        let sessionKey = "session-\(UUID().uuidString)"
        defer { try? storage.remove(key: sessionKey) }

        let biometricSnapshot = Data("biometric-refresh-token-r0".utf8)
        let snapshotStorage = PulpeAuthStorage(service: "\(Self.testService).biometric")
        let snapshotKey = "snapshot-\(UUID().uuidString)"
        defer { try? snapshotStorage.remove(key: snapshotKey) }
        try snapshotStorage.store(key: snapshotKey, value: biometricSnapshot)

        for index in 0..<3 {
            try storage.store(key: sessionKey, value: Data("session-r\(index)".utf8))
        }

        #expect(try snapshotStorage.retrieve(key: snapshotKey) == biometricSnapshot)
    }

    @Test("Cold-start with biometric enabled uses the regular persisted session")
    func coldStart_biometricEnabled_usesRegularValidation() async {
        let user = testUser()
        let regularCalls = AtomicProperty(0)
        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateRegularSession: {
                regularCalls.increment()
                return user
            },
            resolvePostAuth: { .authenticated(needsRecoveryKeyConsent: false) }
        )

        let result = await coordinator.start(
            context: .init(
                biometricEnabled: true,
                manualBiometricRetryRequired: false
            )
        )

        #expect(regularCalls.value == 1)
        if case .authenticated = result { } else {
            Issue.record("Expected authenticated result, got \(result)")
        }
    }

    @Test("Missing persisted session clears stale biometric credentials")
    func coldStart_missingSession_clearsBiometricState() async {
        let cleanedExpired = AtomicFlag()
        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateRegularSession: { nil },
            resolvePostAuth: { .needsPinEntry(needsRecoveryKeyConsent: false) },
            clearExpiredBiometricState: { cleanedExpired.set() }
        )

        let result = await coordinator.start(
            context: .init(
                biometricEnabled: true,
                manualBiometricRetryRequired: false
            )
        )

        #expect(result == .biometricSessionExpired)
        #expect(cleanedExpired.value)
    }

    @Test("Manual biometric retry requirement short-circuits startup")
    func manualBiometricRetryRequired_returnsUnauthenticatedImmediately() async {
        let regularCalls = AtomicProperty(0)
        let coordinator = StartupCoordinator(
            checkMaintenance: { false },
            validateRegularSession: {
                regularCalls.increment()
                return nil
            },
            resolvePostAuth: { .needsPinEntry(needsRecoveryKeyConsent: false) }
        )

        let result = await coordinator.start(
            context: .init(
                biometricEnabled: true,
                manualBiometricRetryRequired: true
            )
        )

        #expect(result == .unauthenticated)
        #expect(regularCalls.value == 0)
    }
}
