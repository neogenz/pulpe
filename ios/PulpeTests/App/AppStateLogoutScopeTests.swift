import Foundation
@testable import Pulpe
import Supabase
import Testing

/// PUL-129: account deletion must revoke the Supabase JWT server-side.
///
/// `AuthService.logout()` historically hardcoded `signOut(scope: .local)`, which
/// only wipes client tokens and leaves the access token valid on the server for
/// up to 1 hour. Tests below verify that:
/// - `deleteAccount()` and `abandonInProgressSignup()` propagate `.global`
/// - Regular user-initiated logout keeps the `.local` default
@MainActor
@Suite(.serialized)
struct AppStateLogoutScopeTests {
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
}
