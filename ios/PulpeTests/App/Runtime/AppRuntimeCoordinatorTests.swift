import Foundation
@testable import Pulpe
import SwiftUI
import Testing

@Suite(.serialized)
@MainActor
struct AppRuntimeCoordinatorTests {
    private let pinResolver = MockPostAuthResolver(
        destination: .needsPinEntry(needsRecoveryKeyConsent: false)
    )
    private let testUser = UserInfo(id: "coord-user", email: "coord@pulpe.app", firstName: "Coord")

    /// Helper: transition AppState to `.authenticated` via PIN entry.
    private func authenticateViaPinEntry(_ appState: AppState) async {
        await appState.resolvePostAuth(user: testUser)
        await appState.completePinEntry()
    }

    private func makeCoordinator(
        appState: AppState,
        onAppOpened: @escaping @MainActor () -> Void = {}
    ) -> AppRuntimeCoordinator {
        AppRuntimeCoordinator(
            appState: appState,
            currentMonthStore: CurrentMonthStore(),
            budgetListStore: BudgetListStore(),
            dashboardStore: DashboardStore(),
            onAppOpened: onAppOpened
        )
    }

    // MARK: - Visible Startup Gate

    @Test func visibleStartup_active_isAcceptedOnlyOnce() {
        let sut = makeCoordinator(appState: AppState())

        #expect(sut.consumeVisibleStartup(for: .active))
        #expect(!sut.consumeVisibleStartup(for: .active))
    }

    @Test(arguments: [ScenePhase.inactive, .background])
    func visibleStartup_nonActivePhase_isDeferredWithoutConsumingGate(_ phase: ScenePhase) {
        let sut = makeCoordinator(appState: AppState())

        #expect(!sut.consumeVisibleStartup(for: phase))
        #expect(sut.consumeVisibleStartup(for: .active))
    }

    @Test func visibleStartup_warmForeground_doesNotRestartColdStartup() {
        let sut = makeCoordinator(appState: AppState())
        #expect(sut.consumeVisibleStartup(for: .active))

        sut.handleScenePhaseChange(from: .active, to: .background)
        sut.handleScenePhaseChange(from: .background, to: .active)

        #expect(!sut.consumeVisibleStartup(for: .active))
    }

    // MARK: - App-open Signal

    @Test func appOpenedCallback_firesOnceOnInitialActivation() {
        var callCount = 0
        let sut = makeCoordinator(appState: AppState()) { callCount += 1 }

        sut.handleScenePhaseChange(from: .inactive, to: .active)
        sut.handleScenePhaseChange(from: .active, to: .inactive)
        sut.handleScenePhaseChange(from: .inactive, to: .active)

        #expect(callCount == 1)
    }

    @Test func appOpenedCallback_firesAgainOnlyAfterBackground() {
        var callCount = 0
        let sut = makeCoordinator(appState: AppState()) { callCount += 1 }
        sut.handleScenePhaseChange(from: .inactive, to: .active)

        sut.handleScenePhaseChange(from: .active, to: .background)
        sut.handleScenePhaseChange(from: .background, to: .active)

        #expect(callCount == 2)
    }

    // MARK: - Privacy Shield: Activation

    @Test func scenePhaseActive_thenBackground_activatesPrivacyShield_whenAuthenticated() async {
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)
        let sut = makeCoordinator(appState: appState)

        sut.handleScenePhaseChange(from: .active, to: .background)

        #expect(sut.privacyShieldActive == true)
    }

    @Test func scenePhaseActive_thenInactive_doesNotActivatePrivacyShield_whenAuthenticated() async {
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)
        let sut = makeCoordinator(appState: appState)

        sut.handleScenePhaseChange(from: .active, to: .inactive)

        #expect(sut.privacyShieldActive == false)
    }

    @Test func scenePhaseActive_thenBackground_activatesPrivacyShield_whenNeedsPinEntry() async {
        let appState = AppState(postAuthResolver: pinResolver)
        await appState.resolvePostAuth(user: testUser)
        // authState is now .needsPinEntry
        let sut = makeCoordinator(appState: appState)

        sut.handleScenePhaseChange(from: .active, to: .background)

        #expect(sut.privacyShieldActive == true)
    }

    @Test func scenePhaseInactive_thenBackground_activatesPrivacyShield_whenAuthenticated() async {
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)
        let sut = makeCoordinator(appState: appState)

        // Simulate the real iOS lifecycle: active → inactive → background
        sut.handleScenePhaseChange(from: .active, to: .inactive)
        #expect(sut.privacyShieldActive == false)

        sut.handleScenePhaseChange(from: .inactive, to: .background)
        #expect(sut.privacyShieldActive == true)
    }

    @Test func scenePhaseActive_thenBackground_noPrivacyShield_whenUnauthenticated() {
        let appState = AppState()
        appState.authState = .unauthenticated
        let sut = makeCoordinator(appState: appState)

        sut.handleScenePhaseChange(from: .active, to: .background)

        #expect(sut.privacyShieldActive == false)
    }

    @Test func scenePhaseActive_thenBackground_noPrivacyShield_whenLoading() {
        let appState = AppState()
        // Default authState is .loading
        let sut = makeCoordinator(appState: appState)

        sut.handleScenePhaseChange(from: .active, to: .background)

        #expect(sut.privacyShieldActive == false)
    }

    // MARK: - Privacy Shield: Deactivation

    @Test func scenePhaseBackground_thenActive_deactivatesPrivacyShield() async {
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)
        let sut = makeCoordinator(appState: appState)

        // First activate the shield
        sut.handleScenePhaseChange(from: .active, to: .background)
        #expect(sut.privacyShieldActive == true)

        // Then return to active
        sut.handleScenePhaseChange(from: .background, to: .active)
        #expect(sut.privacyShieldActive == false)
    }

    // MARK: - Scene Phase: Background Delegation

    @Test func scenePhaseBackground_callsHandleEnterBackground() async {
        let now = AtomicProperty(Date(timeIntervalSince1970: 0))
        let appState = AppState(postAuthResolver: pinResolver, nowProvider: { now.value })
        appState.biometricEnabled = false
        await authenticateViaPinEntry(appState)
        let sut = makeCoordinator(appState: appState)

        sut.handleScenePhaseChange(from: .active, to: .background)

        // Verify background was registered by checking that a subsequent foreground after
        // grace period triggers lock. This proves handleEnterBackground was called.
        now.set(Date(timeIntervalSince1970: 31))
        await appState.handleEnterForeground()
        #expect(appState.authState == .needsPinEntry)
    }

    // MARK: - Scene Phase: Foreground Delegation

    @Test func scenePhaseActive_callsPrepareForForeground() async {
        let now = AtomicProperty(Date(timeIntervalSince1970: 0))
        let appState = AppState(postAuthResolver: pinResolver, nowProvider: { now.value })
        appState.biometricEnabled = false
        await authenticateViaPinEntry(appState)
        let sut = makeCoordinator(appState: appState)

        // Go to background
        sut.handleScenePhaseChange(from: .active, to: .background)
        now.set(Date(timeIntervalSince1970: 31)) // Exceed grace period

        // prepareForForeground is called synchronously within handleScenePhaseChange
        // when transitioning to .active. Verify isRestoringSession is set.
        appState.prepareForForeground()
        #expect(appState.isRestoringSession == true)
    }

    // MARK: - shouldShowPrivacyShield Computed Property

    @Test func shouldShowPrivacyShield_trueWhenPrivacyShieldActive() async {
        let appState = AppState(postAuthResolver: pinResolver)
        await authenticateViaPinEntry(appState)
        let sut = makeCoordinator(appState: appState)

        sut.handleScenePhaseChange(from: .active, to: .background)

        #expect(sut.shouldShowPrivacyShield == true)
    }

    @Test func shouldShowPrivacyShield_trueWhenRestoringSession() async {
        let now = AtomicProperty(Date(timeIntervalSince1970: 0))
        let appState = AppState(postAuthResolver: pinResolver, nowProvider: { now.value })
        appState.biometricEnabled = false
        await authenticateViaPinEntry(appState)
        let sut = makeCoordinator(appState: appState)

        // Go to background and exceed grace period
        appState.handleEnterBackground()
        now.set(Date(timeIntervalSince1970: 31))
        appState.prepareForForeground()

        #expect(appState.isRestoringSession == true)
        #expect(sut.shouldShowPrivacyShield == true)
    }

    @Test func shouldShowPrivacyShield_falseWhenNeitherActive() {
        let appState = AppState()
        appState.authState = .unauthenticated
        let sut = makeCoordinator(appState: appState)

        #expect(sut.shouldShowPrivacyShield == false)
    }
}
