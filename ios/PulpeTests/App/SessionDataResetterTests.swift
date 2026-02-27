import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
@MainActor
struct SessionDataResetterTests {
    private let pinResolver = MockPostAuthResolver(
        destination: .needsPinEntry(needsRecoveryKeyConsent: false)
    )
    private let testUser = UserInfo(
        id: "resetter-user",
        email: "resetter@pulpe.app",
        firstName: "Resetter"
    )

    private func authenticateViaPinEntry(_ appState: AppState) async {
        await appState.resolvePostAuth(user: testUser)
        await appState.completePinEntry()
    }

    // MARK: - resetSession Calls sessionDataResetter

    @Test("resetSession with userLogout scope calls sessionDataResetter")
    func resetSession_userLogout_callsResetter() async {
        let resetCalled = AtomicFlag()
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)

        appState.sessionDataResetter = MockSessionDataResetter(onReset: { resetCalled.set() })
        appState.resetSession(.userLogout)

        #expect(resetCalled.value, "sessionDataResetter.resetStores() should be called on userLogout")
    }

    @Test("resetSession with systemLogout scope calls sessionDataResetter")
    func resetSession_systemLogout_callsResetter() async {
        let resetCalled = AtomicFlag()
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)

        appState.sessionDataResetter = MockSessionDataResetter(onReset: { resetCalled.set() })
        appState.resetSession(.systemLogout)

        #expect(resetCalled.value, "sessionDataResetter.resetStores() should be called on systemLogout")
    }

    @Test("resetSession with sessionExpiry scope calls sessionDataResetter")
    func resetSession_sessionExpiry_callsResetter() async {
        let resetCalled = AtomicFlag()
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)

        appState.sessionDataResetter = MockSessionDataResetter(onReset: { resetCalled.set() })
        appState.resetSession(.sessionExpiry)

        #expect(resetCalled.value, "sessionDataResetter.resetStores() should be called on sessionExpiry")
    }

    @Test("resetSession without sessionDataResetter does not crash")
    func resetSession_noResetter_doesNotCrash() async {
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)

        // sessionDataResetter is nil by default
        appState.resetSession(.userLogout)

        #expect(appState.authState == .unauthenticated)
    }

    // MARK: - LiveSessionDataResetter

    @Test("LiveSessionDataResetter resets all stores")
    func liveResetter_resetsAllStores() {
        let currentMonthStore = CurrentMonthStore()
        let budgetListStore = BudgetListStore()
        let dashboardStore = DashboardStore()
        let userSettingsStore = UserSettingsStore()

        let sut = LiveSessionDataResetter(
            currentMonthStore: currentMonthStore,
            budgetListStore: budgetListStore,
            dashboardStore: dashboardStore,
            userSettingsStore: userSettingsStore
        )

        sut.resetStores()

        // Verify stores are in their initial/reset state
        #expect(currentMonthStore.budget == nil)
        #expect(currentMonthStore.budgetLines.isEmpty)
        #expect(currentMonthStore.transactions.isEmpty)
        #expect(budgetListStore.budgets.isEmpty)
        #expect(budgetListStore.hasLoadedOnce == false)
        #expect(dashboardStore.sparseBudgets.isEmpty)
        #expect(userSettingsStore.payDayOfMonth == nil)
    }
}

// MARK: - Test Double

@MainActor
private final class MockSessionDataResetter: SessionDataResetting {
    private let onReset: () -> Void

    init(onReset: @escaping () -> Void) {
        self.onReset = onReset
    }

    func resetStores() {
        onReset()
    }
}
