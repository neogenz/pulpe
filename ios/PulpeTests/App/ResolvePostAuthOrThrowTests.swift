import Foundation
@testable import Pulpe
import Testing

/// Regression tests for `AppState.resolvePostAuthOrThrow(user:)`.
///
/// Pins the contract introduced to fix the iOS post-PUL-132 bug where
/// `vault-status` 401 → `.unauthenticatedSessionExpired` left the LoginView
/// mounted with the primary button stuck in a loading state — because
/// `appState.login()` returned successfully even when post-auth determined
/// the user was unauthenticated.
///
/// New contract: any active login flow must use the throwing variant so
/// the caller's catch block resets its loading state and surfaces a message.
@MainActor
struct ResolvePostAuthOrThrowTests {
    private let user = UserInfo(id: "user-1", email: "test@pulpe.app", firstName: "Max")

    @Test("unauthenticatedSessionExpired throws sessionExpired AND leaves authState unauthenticated")
    func unauthenticatedSessionExpired_throwsAndUnauthenticatesUser() async throws {
        let resolver = StubResolver(destination: .unauthenticatedSessionExpired)
        let sut = AppState(postAuthResolver: resolver)

        await #expect(throws: AuthServiceError.sessionExpired) {
            try await sut.resolvePostAuthOrThrow(user: user)
        }

        #expect(sut.authState == .unauthenticated)
        #expect(sut.biometricError == "Ta session a expiré, connecte-toi avec ton mot de passe")
    }

    @Test("needsPinEntry routes to PIN entry without throwing")
    func needsPinEntry_doesNotThrow() async throws {
        let resolver = StubResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        let sut = AppState(postAuthResolver: resolver)

        try await sut.resolvePostAuthOrThrow(user: user)

        #expect(sut.authState == .needsPinEntry)
    }

    @Test("needsPinSetup with pendingOnboardingData routes to PIN setup without throwing")
    func needsPinSetup_withPendingOnboarding_doesNotThrow() async throws {
        let resolver = StubResolver(destination: .needsPinSetup)
        let sut = AppState(postAuthResolver: resolver)
        sut.pendingOnboardingData = BudgetTemplateCreateFromOnboarding()

        try await sut.resolvePostAuthOrThrow(user: user)

        #expect(sut.authState == .needsPinSetup)
    }

    @Test("vaultCheckFailed routes to PIN entry without throwing (transient failure → safe fallback)")
    func vaultCheckFailed_doesNotThrow() async throws {
        let resolver = StubResolver(destination: .vaultCheckFailed)
        let sut = AppState(postAuthResolver: resolver)

        try await sut.resolvePostAuthOrThrow(user: user)

        #expect(sut.authState == .needsPinEntry)
    }
}

private struct StubResolver: PostAuthResolving {
    let destination: PostAuthDestination

    func resolve() async -> PostAuthDestination {
        destination
    }
}
