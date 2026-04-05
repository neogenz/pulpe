import Foundation
@testable import Pulpe
import Testing

/// Tests for the AppState+FlowState bridge layer.
/// Verifies that events are correctly mapped to state transitions
/// and that the derived flowState/currentRoute are consistent.
@Suite(.serialized)
@MainActor
struct AppStateFlowBridgeTests {
    private let testUser = UserInfo(id: "bridge-user", email: "bridge@pulpe.app", firstName: "Bridge")

    // MARK: - flowState Derivation Tests

    @Test func flowState_loading_mapsToInitializing() {
        let sut = AppState()
        sut.authState = .loading
        sut.isInMaintenance = false
        sut.isNetworkUnavailable = false

        #expect(sut.flowState == .initializing)
    }

    @Test func flowState_maintenance_takesPriority() {
        let sut = AppState()
        sut.authState = .loading
        sut.isInMaintenance = true

        #expect(sut.flowState == .maintenance)
    }

    @Test func flowState_networkUnavailable_takesPriority() {
        let sut = AppState()
        sut.authState = .loading
        sut.isNetworkUnavailable = true

        #expect(sut.flowState == .networkUnavailable(retryable: true))
    }

    @Test func flowState_maintenanceOverNetwork_maintenanceWins() {
        let sut = AppState()
        sut.authState = .loading
        sut.isInMaintenance = true
        sut.isNetworkUnavailable = true

        // Maintenance check comes first in flowState derivation
        #expect(sut.flowState == .maintenance)
    }

    @Test func flowState_unauthenticated_mapsCorrectly() {
        let sut = AppState()
        sut.authState = .unauthenticated

        #expect(sut.flowState == .unauthenticated)
    }

    @Test func flowState_needsPinSetup_mapsToSecuritySetup() {
        let sut = AppState()
        sut.authState = .needsPinSetup

        #expect(sut.flowState == .securitySetup(.pinSetup))
    }

    @Test func flowState_needsPinEntry_coldStart_mapsToLocked() {
        let sut = AppState()
        sut.authState = .needsPinEntry
        // isRestoringSession is false by default (cold start scenario)

        #expect(sut.flowState == .locked(.coldStart))
    }

    @Test func flowState_needsPinEntry_afterBackgroundTimeout_mapsToBackgroundTimeout() async {
        // To test background timeout, we need to simulate the foreground flow
        // which sets isRestoringSession via SessionLifecycleCoordinator
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            syncBiometricCredentials: { false },
            resolveBiometricKey: { nil },
            nowProvider: { now }
        )
        sut.biometricEnabled = false

        // Get to authenticated state first
        await sut.resolvePostAuth(user: testUser)
        await sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        // Go to background and exceed grace period
        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // Exceeds 30s grace period
        sut.prepareForForeground()

        // At this point, isRestoringSession should be true
        #expect(sut.isRestoringSession == true)

        // But flowState is still .authenticated because authState hasn't changed yet
        // The actual lock happens when handleEnterForeground() runs
        // After handleEnterForeground(), with biometric disabled and no biometric key,
        // it should transition to needsPinEntry
        await sut.handleEnterForeground()

        // Now authState should be needsPinEntry, but isRestoringSession is cleared
        #expect(sut.authState == .needsPinEntry)
        // isRestoringSession is cleared after handleEnterForeground completes
        #expect(sut.isRestoringSession == false)
        // lastLockReason persists .backgroundTimeout even after isRestoringSession is cleared
        #expect(sut.flowState == .locked(.backgroundTimeout))
    }

    @Test func flowState_needsPinRecovery_mapsToRecovering() {
        let sut = AppState()
        sut.authState = .needsPinRecovery

        #expect(sut.flowState == .recovering)
    }

    @Test func flowState_authenticated_mapsCorrectly() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)

        #expect(sut.flowState == .authenticated)
    }

    // MARK: - currentRoute Derivation Tests

    @Test func currentRoute_loading_returnsLoading() {
        let sut = AppState()
        sut.authState = .loading

        #expect(sut.currentRoute == .loading)
    }

    @Test func currentRoute_maintenance_returnsMaintenance() {
        let sut = AppState()
        sut.isInMaintenance = true

        #expect(sut.currentRoute == .maintenance)
    }

    @Test func currentRoute_networkUnavailable_returnsNetworkError() {
        let sut = AppState()
        sut.isNetworkUnavailable = true

        #expect(sut.currentRoute == .networkError)
    }

    @Test func currentRoute_unauthenticated_returnsLogin() {
        let sut = AppState()
        sut.authState = .unauthenticated

        #expect(sut.currentRoute == .login)
    }

    @Test func currentRoute_needsPinSetup_returnsPinSetup() {
        let sut = AppState()
        sut.authState = .needsPinSetup

        #expect(sut.currentRoute == .pinSetup)
    }

    @Test func currentRoute_needsPinEntry_biometricEnabled_returnsPinEntryWithBiometric() {
        let sut = AppState()
        sut.authState = .needsPinEntry
        sut.biometricEnabled = true

        #expect(sut.currentRoute == .pinEntry(canUseBiometric: true))
    }

    @Test func currentRoute_needsPinEntry_biometricDisabled_returnsPinEntryWithoutBiometric() {
        let sut = AppState()
        sut.authState = .needsPinEntry
        sut.biometricEnabled = false

        #expect(sut.currentRoute == .pinEntry(canUseBiometric: false))
    }

    @Test func currentRoute_authenticated_returnsMain() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)

        #expect(sut.currentRoute == .main)
    }

    // MARK: - Event Dispatch Tests

    @Test func send_logoutRequested_transitionsToUnauthenticated() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .authenticated)

        sut.send(.logoutRequested(source: .userInitiated))

        // Allow async logout to complete
        await waitForCondition(timeout: .milliseconds(500), "logout must complete") {
            sut.authState == .unauthenticated
        }
    }

    @Test func send_sessionExpired_transitionsToUnauthenticated() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .authenticated)

        sut.send(.sessionExpired)

        await waitForCondition(timeout: .milliseconds(500), "session expiry must complete") {
            sut.authState == .unauthenticated
        }
    }

    @Test func send_pinEntrySucceeded_transitionsToAuthenticated() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .needsPinEntry)

        sut.send(.pinEntrySucceeded)

        await waitForCondition(timeout: .milliseconds(500), "pin entry must complete") {
            sut.authState == .authenticated
        }
    }

    @Test func send_pinSetupCompleted_transitionsToAuthenticated() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup)
        )
        sut.pendingOnboardingData = BudgetTemplateCreateFromOnboarding()
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .needsPinSetup)

        sut.send(.pinSetupCompleted)

        await waitForCondition("pin setup must complete") {
            sut.authState == .authenticated
        }
    }

    @Test func send_recoveryInitiated_transitionsToRecovering() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .needsPinEntry)

        sut.send(.recoveryInitiated)

        #expect(sut.authState == .needsPinRecovery)
    }

    @Test func send_recoveryCancelled_transitionsToPinEntry() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)
        sut.send(.recoveryInitiated)
        #expect(sut.authState == .needsPinRecovery)

        sut.send(.recoveryCancelled)

        #expect(sut.authState == .needsPinEntry)
    }

    // MARK: - Concurrent Event Tests

    @Test func concurrentEvents_logoutDuringRecovery_endsUnauthenticated() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)
        sut.send(.recoveryInitiated)
        #expect(sut.authState == .needsPinRecovery)

        // Fire logout during recovery
        sut.send(.logoutRequested(source: .system))

        await waitForCondition(timeout: .milliseconds(500), "logout must complete") {
            sut.authState == .unauthenticated
        }
        #expect(sut.currentUser == nil)
    }

    @Test func concurrentEvents_sessionExpiredDuringPinSetup_endsUnauthenticated() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup)
        )
        sut.pendingOnboardingData = BudgetTemplateCreateFromOnboarding()
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .needsPinSetup)

        // Session expires during PIN setup
        sut.send(.sessionExpired)

        await waitForCondition(timeout: .milliseconds(500), "session expiry must complete") {
            sut.authState == .unauthenticated
        }
    }

    // MARK: - Invalid Transition Tests (No-op)

    @Test func send_pinEntrySucceeded_whenUnauthenticated_isNoop() async {
        let sut = AppState()
        sut.authState = .unauthenticated

        sut.send(.pinEntrySucceeded)

        // Allow any async processing
        try? await Task.sleep(for: .milliseconds(100))

        // Should remain unauthenticated (no user to authenticate)
        #expect(sut.authState == .unauthenticated)
    }

    @Test func send_recoveryInitiated_whenAuthenticated_transitionsToRecovery() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .authenticated)

        // Recovery can be initiated from authenticated state (forgot PIN scenario)
        sut.send(.recoveryInitiated)

        #expect(sut.authState == .needsPinRecovery)
    }

    // MARK: - State Consistency After Transitions

    @Test func stateConsistency_afterLogout_allUserDataCleared() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.currentUser != nil)

        sut.send(.logoutRequested(source: .userInitiated))

        await waitForCondition(timeout: .milliseconds(500), "logout must complete") {
            sut.authState == .unauthenticated
        }

        #expect(sut.currentUser == nil)
        #expect(sut.flowState == .unauthenticated)
        #expect(sut.currentRoute == .login)
    }

    @Test func stateConsistency_afterSessionExpiry_userCleared() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        )
        await sut.resolvePostAuth(user: testUser)

        sut.send(.sessionExpired)

        await waitForCondition(timeout: .milliseconds(500), "session expiry must complete") {
            sut.authState == .unauthenticated
        }

        #expect(sut.currentUser == nil)
    }
}

// MARK: - Reducer Integration Tests

@Suite(.serialized)
struct AppFlowReducerIntegrationTests {
    @Test func reducer_startupTimedOut_transitionsToNetworkUnavailable() {
        let initialState = AppFlowState.initializing

        let nextState = AppFlowReducer.reduce(state: initialState, event: .startupTimedOut)

        #expect(nextState == .networkUnavailable(retryable: true))
    }

    @Test func reducer_retryRequested_fromNetworkUnavailable_transitionsToInitializing() {
        let initialState = AppFlowState.networkUnavailable(retryable: true)

        let nextState = AppFlowReducer.reduce(state: initialState, event: .retryRequested)

        #expect(nextState == .initializing)
    }

    @Test func reducer_sessionExpired_fromAnyState_transitionsToUnauthenticated() {
        let states: [AppFlowState] = [
            .authenticated,
            .locked(.coldStart),
            .locked(.backgroundTimeout),
            .securitySetup(.pinSetup),
            .recovering
        ]

        for state in states {
            let nextState = AppFlowReducer.reduce(state: state, event: .sessionExpired)
            #expect(
                nextState == .unauthenticated,
                "Expected .unauthenticated from \(state), got \(String(describing: nextState))"
            )
        }
    }

    @Test func reducer_logoutCompleted_fromAnyState_transitionsToUnauthenticated() {
        let states: [AppFlowState] = [
            .authenticated,
            .locked(.coldStart),
            .securitySetup(.pinSetup)
        ]

        for state in states {
            let nextState = AppFlowReducer.reduce(state: state, event: .logoutCompleted)
            #expect(
                nextState == .unauthenticated,
                "Expected .unauthenticated from \(state), got \(String(describing: nextState))"
            )
        }
    }

    @Test func reducer_invalidTransition_returnsNil() {
        // PIN entry succeeded from unauthenticated is invalid
        let result = AppFlowReducer.reduce(state: .unauthenticated, event: .pinEntrySucceeded)
        #expect(result == nil)
    }

    @Test func reducer_foregroundLockRequired_fromAuthenticated_transitionsToLocked() {
        let nextState = AppFlowReducer.reduce(state: .authenticated, event: .foregroundLockRequired)
        #expect(nextState == .locked(.backgroundTimeout))
    }

    @Test func reducer_recoveryCompleted_transitionsToAuthenticated() {
        let nextState = AppFlowReducer.reduce(state: .recovering, event: .recoveryCompleted)
        #expect(nextState == .authenticated)
    }

    @Test func reducer_recoveryCancelled_transitionsToLocked() {
        let nextState = AppFlowReducer.reduce(state: .recovering, event: .recoveryCancelled)
        #expect(nextState == .locked(.coldStart))
    }
}
