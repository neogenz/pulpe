@testable import Pulpe
import Testing

@Suite("What's New lifecycle")
struct WhatsNewLifecycleTests {
    private static let unauthenticatedStates: [AppState.AuthStatus] = [
        .loading,
        .unauthenticated,
        .needsPinSetup,
        .needsPinEntry,
        .needsPinRecovery,
    ]

    @Test @MainActor
    func authenticatedStateChecksWhatsNew() {
        #expect(
            RootViewLifecycle.shouldCheckWhatsNew(for: .authenticated)
        )
    }

    @Test(
        "Unauthenticated states do not check What's New",
        arguments: unauthenticatedStates
    )
    @MainActor
    func unauthenticatedStatesDoNotCheckWhatsNew(_ authState: AppState.AuthStatus) {
        #expect(
            !RootViewLifecycle.shouldCheckWhatsNew(for: authState)
        )
    }

    @Test(
        "Leaving authenticated state invalidates the What's New session",
        arguments: unauthenticatedStates
    )
    @MainActor
    func leavingAuthenticatedStateInvalidatesSession(_ newAuthState: AppState.AuthStatus) {
        #expect(
            RootViewLifecycle.shouldInvalidateWhatsNewSession(
                from: .authenticated,
                to: newAuthState
            )
        )
    }

    @Test(
        "Entering authenticated state does not invalidate the new session",
        arguments: unauthenticatedStates
    )
    @MainActor
    func enteringAuthenticatedStateDoesNotInvalidateSession(_ oldAuthState: AppState.AuthStatus) {
        #expect(
            !RootViewLifecycle.shouldInvalidateWhatsNewSession(
                from: oldAuthState,
                to: .authenticated
            )
        )
    }

    @Test @MainActor
    func stayingAuthenticatedDoesNotInvalidateSession() {
        #expect(
            !RootViewLifecycle.shouldInvalidateWhatsNewSession(
                from: .authenticated,
                to: .authenticated
            )
        )
    }
}
