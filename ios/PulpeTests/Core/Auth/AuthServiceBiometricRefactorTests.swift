import Foundation
@testable import Pulpe
import Supabase
import Testing

@Suite("AuthService biometric storage")
struct AuthServiceBiometricRefactorTests {
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
        "Supabase cleanup response preserves every terminal server error code",
        arguments: [
            "session_not_found",
            "session_expired",
            "refresh_token_not_found",
            "refresh_token_already_used"
        ]
    )
    func supabaseLogger_extractsExactCleanupCode(code: String) throws {
        let message = """
        Response: Status code: 400 Content-Length: 91
        Body: {
          "error_code" : "\(code)",
          "msg" : "Invalid Refresh Token"
        }
        """

        let result = try #require(PulpeSupabaseLogger.cleanupError(from: message))
        #expect(result.code == code)
        #expect(result.status == 400)
    }

    @Test("Supabase logger ignores request bodies containing refresh tokens")
    func supabaseLogger_doesNotParseSensitiveRequestBody() {
        let message = """
        Request: POST https://example.supabase.co/auth/v1/token?grant_type=refresh_token
        Body: {
          "refresh_token" : "secret-token"
        }
        """

        #expect(PulpeSupabaseLogger.cleanupError(from: message) == nil)
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
