@testable import Pulpe
import Testing

@Suite("What's New lifecycle")
struct WhatsNewLifecycleTests {
    @Test(
        "All successful authentication paths trigger post-authenticated loading",
        arguments: [
            AppState.AuthStatus.loading,
            .unauthenticated,
            .needsPinSetup,
            .needsPinEntry,
            .needsPinRecovery,
        ]
    )
    func enteringAuthenticatedTriggersLoading(from previousState: AppState.AuthStatus) {
        #expect(
            RootViewLifecycle.isEnteringAuthenticated(
                from: previousState,
                to: .authenticated
            )
        )
    }

    @Test func remainingAuthenticatedDoesNotTriggerLoadingAgain() {
        #expect(
            !RootViewLifecycle.isEnteringAuthenticated(
                from: .authenticated,
                to: .authenticated
            )
        )
    }

    @Test func leavingAuthenticatedDoesNotTriggerLoading() {
        #expect(
            !RootViewLifecycle.isEnteringAuthenticated(
                from: .authenticated,
                to: .needsPinEntry
            )
        )
    }
}
