import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
struct AppFlowReducerTests {
    private let testUser = UserInfo(id: "test-user", email: "test@pulpe.app", firstName: "Test")

    // MARK: - Startup Transitions

    @Test func initializing_maintenanceTrue_transitionsToMaintenance() {
        let result = AppFlowReducer.reduce(
            state: .initializing,
            event: .maintenanceChecked(isInMaintenance: true)
        )
        #expect(result == .maintenance)
    }

    @Test func initializing_maintenanceFalse_staysInitializing() {
        let result = AppFlowReducer.reduce(
            state: .initializing,
            event: .maintenanceChecked(isInMaintenance: false)
        )
        #expect(result == nil) // No transition, stays initializing
    }

    @Test func initializing_networkUnavailable_transitionsToNetworkError() {
        let result = AppFlowReducer.reduce(
            state: .initializing,
            event: .networkBecameUnavailable
        )
        #expect(result == .networkUnavailable(retryable: true))
    }

    @Test func networkUnavailable_retry_transitionsToInitializing() {
        let result = AppFlowReducer.reduce(
            state: .networkUnavailable(retryable: true),
            event: .retryRequested
        )
        #expect(result == .initializing)
    }

    @Test func maintenance_maintenanceCleared_transitionsToInitializing() {
        let result = AppFlowReducer.reduce(
            state: .maintenance,
            event: .maintenanceChecked(isInMaintenance: false)
        )
        #expect(result == .initializing)
    }

    // MARK: - Session Validation Transitions

    @Test func initializing_sessionValidated_authenticated_transitionsToAuthenticated() {
        let result = AppFlowReducer.reduce(
            state: .initializing,
            event: .sessionValidated(.authenticated(
                user: testUser,
                needsSecuritySetup: false,
                needsRecoveryConsent: false
            ))
        )
        #expect(result == .authenticated)
    }

    @Test func initializing_sessionValidated_needsPinSetup_transitionsToSecuritySetup() {
        let result = AppFlowReducer.reduce(
            state: .initializing,
            event: .sessionValidated(.authenticated(
                user: testUser,
                needsSecuritySetup: true,
                needsRecoveryConsent: false
            ))
        )
        #expect(result == .securitySetup(.pinSetup))
    }

    @Test func initializing_sessionValidated_needsRecoveryConsent_transitionsToRecoveryConsent() {
        let result = AppFlowReducer.reduce(
            state: .initializing,
            event: .sessionValidated(.authenticated(
                user: testUser,
                needsSecuritySetup: false,
                needsRecoveryConsent: true
            ))
        )
        #expect(result == .securitySetup(.recoveryKeyConsent))
    }

    @Test func initializing_sessionValidated_unauthenticated_transitionsToUnauthenticated() {
        let result = AppFlowReducer.reduce(
            state: .initializing,
            event: .sessionValidated(.unauthenticated)
        )
        #expect(result == .unauthenticated)
    }

    @Test func initializing_sessionValidated_biometricExpired_transitionsToUnauthenticated() {
        let result = AppFlowReducer.reduce(
            state: .initializing,
            event: .sessionValidated(.biometricSessionExpired)
        )
        #expect(result == .unauthenticated)
    }

    // MARK: - Security Setup Transitions

    @Test func securitySetup_pinSetupCompleted_transitionsToAuthenticated() {
        let result = AppFlowReducer.reduce(
            state: .securitySetup(.pinSetup),
            event: .pinSetupCompleted
        )
        #expect(result == .authenticated)
    }

    @Test func securitySetup_recoveryConsentDeclined_transitionsToAuthenticated() {
        let result = AppFlowReducer.reduce(
            state: .securitySetup(.recoveryKeyConsent),
            event: .recoveryKeyConsentDeclined
        )
        #expect(result == .authenticated)
    }

    @Test func securitySetup_recoveryKeyGenerated_transitionsToPresentation() {
        let result = AppFlowReducer.reduce(
            state: .securitySetup(.recoveryKeyConsent),
            event: .recoveryKeyGenerated(key: "TEST-KEY")
        )
        #expect(result == .securitySetup(.recoveryKeyPresentation(key: "TEST-KEY")))
    }

    @Test func securitySetup_recoveryPresentationDismissed_transitionsToAuthenticated() {
        let result = AppFlowReducer.reduce(
            state: .securitySetup(.recoveryKeyPresentation(key: "KEY")),
            event: .recoveryKeyPresentationDismissed
        )
        #expect(result == .authenticated)
    }

    // MARK: - Authenticated Transitions

    @Test func authenticated_foregroundLockRequired_transitionsToLocked() {
        let result = AppFlowReducer.reduce(
            state: .authenticated,
            event: .foregroundLockRequired
        )
        #expect(result == .locked(.backgroundTimeout))
    }

    @Test func authenticated_foregroundNoLock_staysAuthenticated() {
        let result = AppFlowReducer.reduce(
            state: .authenticated,
            event: .foregroundNoLockNeeded
        )
        #expect(result == nil) // No transition
    }

    @Test func authenticated_sessionExpired_transitionsToUnauthenticated() {
        let result = AppFlowReducer.reduce(
            state: .authenticated,
            event: .sessionExpired
        )
        #expect(result == .unauthenticated)
    }

    @Test func authenticated_logoutCompleted_transitionsToUnauthenticated() {
        let result = AppFlowReducer.reduce(
            state: .authenticated,
            event: .logoutCompleted
        )
        #expect(result == .unauthenticated)
    }

    // MARK: - Locked Transitions

    @Test func locked_pinEntrySucceeded_transitionsToAuthenticated() {
        let result = AppFlowReducer.reduce(
            state: .locked(.backgroundTimeout),
            event: .pinEntrySucceeded
        )
        #expect(result == .authenticated)
    }

    @Test func locked_biometricSucceeded_transitionsToAuthenticated() {
        let result = AppFlowReducer.reduce(
            state: .locked(.coldStart),
            event: .biometricUnlockSucceeded
        )
        #expect(result == .authenticated)
    }

    @Test func locked_biometricFailed_staysLocked() {
        let result = AppFlowReducer.reduce(
            state: .locked(.coldStart),
            event: .biometricUnlockFailed
        )
        #expect(result == nil) // Stay locked, show PIN
    }

    @Test func locked_recoveryInitiated_transitionsToRecovering() {
        let result = AppFlowReducer.reduce(
            state: .locked(.coldStart),
            event: .recoveryInitiated
        )
        #expect(result == .recovering)
    }

    @Test func locked_sessionExpired_transitionsToUnauthenticated() {
        let result = AppFlowReducer.reduce(
            state: .locked(.backgroundTimeout),
            event: .sessionExpired
        )
        #expect(result == .unauthenticated)
    }

    // MARK: - Recovery Transitions

    @Test func recovering_recoveryCompleted_transitionsToAuthenticated() {
        let result = AppFlowReducer.reduce(
            state: .recovering,
            event: .recoveryCompleted
        )
        #expect(result == .authenticated)
    }

    @Test func recovering_recoveryCancelled_transitionsToLocked() {
        let result = AppFlowReducer.reduce(
            state: .recovering,
            event: .recoveryCancelled
        )
        #expect(result == .locked(.coldStart))
    }

    @Test func recovering_sessionExpired_transitionsToUnauthenticated() {
        let result = AppFlowReducer.reduce(
            state: .recovering,
            event: .recoverySessionExpired
        )
        #expect(result == .unauthenticated)
    }

    // MARK: - Global Events

    @Test func anyState_sessionExpired_transitionsToUnauthenticated() {
        // Test session expiry from multiple states
        let states: [AppFlowState] = [
            .authenticated,
            .locked(.coldStart),
            .recovering,
            .securitySetup(.pinSetup)
        ]

        for state in states {
            let result = AppFlowReducer.reduce(state: state, event: .sessionExpired)
            #expect(result == .unauthenticated, "From \(state), sessionExpired should go to unauthenticated")
        }
    }

    // MARK: - Invalid Transitions (No-op)

    @Test func unauthenticated_authenticationSucceeded_transitionsToInitializing() {
        let result = AppFlowReducer.reduce(
            state: .unauthenticated,
            event: .authenticationSucceeded(user: testUser)
        )
        #expect(result == .initializing)
    }

    @Test func unauthenticated_pinEntrySucceeded_isNoOp() {
        let result = AppFlowReducer.reduce(
            state: .unauthenticated,
            event: .pinEntrySucceeded
        )
        #expect(result == nil) // Invalid transition
    }

    @Test func authenticated_pinSetupCompleted_isNoOp() {
        let result = AppFlowReducer.reduce(
            state: .authenticated,
            event: .pinSetupCompleted
        )
        #expect(result == nil) // Invalid transition
    }
}

// MARK: - AppRoute Tests

@Suite(.serialized)
struct AppRouteTests {
    @Test func fromFlowState_initializing_returnsLoading() {
        let route = AppRoute.from(flowState: .initializing)
        #expect(route == .loading)
    }

    @Test func fromFlowState_maintenance_returnsMaintenance() {
        let route = AppRoute.from(flowState: .maintenance)
        #expect(route == .maintenance)
    }

    @Test func fromFlowState_networkUnavailable_returnsNetworkError() {
        let route = AppRoute.from(flowState: .networkUnavailable(retryable: true))
        #expect(route == .networkError)
    }

    @Test func fromFlowState_unauthenticated_returnsLogin() {
        let route = AppRoute.from(flowState: .unauthenticated)
        #expect(route == .login)
    }

    @Test func fromFlowState_securitySetupPinSetup_returnsPinSetup() {
        let route = AppRoute.from(flowState: .securitySetup(.pinSetup))
        #expect(route == .pinSetup)
    }

    @Test func fromFlowState_locked_returnsPinEntry() {
        let route = AppRoute.from(flowState: .locked(.coldStart), biometricEnabled: false)
        #expect(route == .pinEntry(canUseBiometric: false))
    }

    @Test func fromFlowState_locked_withBiometric_returnsPinEntryWithBiometric() {
        let route = AppRoute.from(flowState: .locked(.backgroundTimeout), biometricEnabled: true)
        #expect(route == .pinEntry(canUseBiometric: true))
    }

    @Test func fromFlowState_recovering_returnsPinRecovery() {
        let route = AppRoute.from(flowState: .recovering)
        #expect(route == .pinRecovery)
    }

    @Test func fromFlowState_authenticated_returnsMain() {
        let route = AppRoute.from(flowState: .authenticated)
        #expect(route == .main)
    }
}
