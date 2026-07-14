@testable import Pulpe
import Testing

@Suite("What's New lifecycle")
struct WhatsNewLifecycleTests {
    @Test @MainActor
    func authenticatedStateChecksWhatsNew() {
        #expect(
            RootViewLifecycle.shouldCheckWhatsNew(for: .authenticated)
        )
    }

    @Test(
        "Unauthenticated states do not check What's New",
        arguments: [
            AppState.AuthStatus.loading,
            .unauthenticated,
            .needsPinSetup,
            .needsPinEntry,
            .needsPinRecovery,
        ]
    )
    @MainActor
    func unauthenticatedStatesDoNotCheckWhatsNew(_ authState: AppState.AuthStatus) {
        #expect(
            !RootViewLifecycle.shouldCheckWhatsNew(for: authState)
        )
    }
}
