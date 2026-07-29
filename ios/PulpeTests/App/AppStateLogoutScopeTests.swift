import Foundation
@testable import Pulpe
import Supabase
import Testing

/// PUL-129 / PUL-130: account deletion + password reset must revoke the Supabase JWT server-side.
///
/// `AuthService.logout()` historically hardcoded `signOut(scope: .local)`, which
/// only wipes client tokens and leaves the access token valid on the server for
/// up to 1 hour. Tests below verify that:
/// - `deleteAccount()` and `abandonInProgressSignup()` propagate `.global`
/// - `completePasswordResetFlow()` and `cancelPasswordResetFlow()` propagate `.global`
/// - Regular user-initiated logout keeps the `.local` default
@MainActor
@Suite(.serialized)
struct AppStateLogoutScopeTests {
    @Test("Every terminal reset has a unique reason and explicit classification")
    func terminalResetScopes_haveStableDiagnosticTaxonomy() {
        let cases: [(AppState.SessionResetScope, (String, Bool))] = [
            (.userLogout, ("user_logout", true)),
            (.accountDeleted, ("account_deleted", true)),
            (.signupAbandoned, ("signup_abandoned", true)),
            (.startupRetryAbandoned, ("startup_retry_abandoned", true)),
            (.passwordReset, ("password_reset", true)),
            (.sessionExpiry, ("api_session_expired", false)),
            (.recoverySessionExpiry, ("recovery_session_expired", false)),
            (.backgroundSessionMissing, ("background_session_missing", false)),
            (.sessionRefreshFailed, ("session_refresh_failed", false)),
            (.systemLogout, ("system_unspecified", false))
        ]
        #expect(Set(cases.map(\.0)) == Set(AppState.SessionResetScope.allCases))
        var outcomes = Set<String>()

        for (scope, expected) in cases {
            #expect(scope.diagnosticOutcome == expected.0)
            #expect(scope.isExpectedUserAction == expected.1)
            #expect(outcomes.insert(scope.diagnosticOutcome).inserted)
        }
    }

    @Test("deleteAccount() triggers performSignOut with .global scope")
    func deleteAccount_triggersGlobalSignOutScope() async {
        let receivedScope = AtomicProperty<SignOutScope?>(nil)
        let user = UserInfo(id: "user-del-scope", email: "delscope@pulpe.app", firstName: "Del")
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            deleteAccountRequest: {
                DeleteAccountResponse(
                    success: true,
                    message: "scheduled",
                    scheduledDeletionAt: "2026-03-01T00:00:00Z"
                )
            },
            performSignOut: { scope in receivedScope.set(scope) }
        )

        await sut.bootstrap()
        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .authenticated, "Setup: should be authenticated")

        await sut.deleteAccount()

        #expect(
            receivedScope.value == .global,
            "Account deletion must sign out with .global so Supabase revokes the JWT server-side"
        )
        #expect(sut.authState == .unauthenticated)
    }

    @Test("logout(source: .userInitiated) defaults to .local scope")
    func logout_userInitiated_defaultsToLocalScope() async throws {
        let receivedScope = AtomicProperty<SignOutScope?>(nil)
        let user = UserInfo(id: "user-local-scope", email: "local@pulpe.app", firstName: "Local")
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            performSignOut: { scope in receivedScope.set(scope) }
        )

        await sut.resolvePostAuth(user: user)
        try #require(sut.authState == .authenticated)

        await sut.logout()

        #expect(
            receivedScope.value == .local,
            "Regular user logout keeps default .local scope — no server revocation needed"
        )
    }

    @Test("abandonInProgressSignup() triggers performSignOut with .global scope")
    func abandonInProgressSignup_triggersGlobalSignOutScope() async {
        let receivedScope = AtomicProperty<SignOutScope?>(nil)
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            performSignOut: { scope in receivedScope.set(scope) }
        )

        await sut.abandonInProgressSignup()

        #expect(
            receivedScope.value == .global,
            "Signup abandon must revoke server-side session — backend may have provisioned one"
        )
    }

    @Test("completePasswordResetFlow() triggers performSignOut with .global scope")
    func completePasswordResetFlow_triggersGlobalSignOutScope() async {
        let receivedScope = AtomicProperty<SignOutScope?>(nil)
        let user = UserInfo(id: "user-pwd-reset", email: "pwdreset@pulpe.app", firstName: "Reset")
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            performSignOut: { scope in receivedScope.set(scope) }
        )

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .authenticated, "Setup: should be authenticated")

        await sut.completePasswordResetFlow()

        #expect(
            receivedScope.value == .global,
            "Password reset must sign out with .global so Supabase revokes the JWT server-side"
        )
        #expect(sut.authState == .unauthenticated)
    }

    @Test("cancelPasswordResetFlow() triggers performSignOut with .global scope")
    func cancelPasswordResetFlow_triggersGlobalSignOutScope() async {
        let receivedScope = AtomicProperty<SignOutScope?>(nil)
        let user = UserInfo(id: "user-pwd-cancel", email: "pwdcancel@pulpe.app", firstName: "Cancel")
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            performSignOut: { scope in receivedScope.set(scope) }
        )

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .authenticated, "Setup: should be authenticated")

        await sut.cancelPasswordResetFlow()

        #expect(
            receivedScope.value == .global,
            "Cancel password reset must sign out with .global — recovery JWT is write-capable"
        )
        #expect(sut.authState == .unauthenticated)
    }
}
