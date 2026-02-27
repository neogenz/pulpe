import Foundation

// MARK: - App Flow Reducer

/// Pure reducer that computes state transitions.
/// No side effects - only determines the next state given current state and event.
enum AppFlowReducer {
    /// Computes the next state given the current state and an event.
    /// Returns `nil` if the event is not valid for the current state (no-op).
    static func reduce(state: AppFlowState, event: AppFlowEvent) -> AppFlowState? {
        if let globalTransition = reduceGlobal(event: event) {
            return globalTransition
        }

        switch state {
        case .initializing:
            return reduceInitializing(event: event)
        case .networkUnavailable:
            return reduceNetworkUnavailable(event: event)
        case .maintenance:
            return reduceMaintenance(event: event)
        case .unauthenticated:
            return reduceUnauthenticated(event: event)
        case .securitySetup(let phase):
            return reduceSecuritySetup(phase: phase, event: event)
        case .authenticated:
            return reduceAuthenticated(event: event)
        case .locked:
            return reduceLocked(event: event)
        case .recovering:
            return reduceRecovering(event: event)
        }
    }

    // MARK: - Helpers

    private static func reduceGlobal(event: AppFlowEvent) -> AppFlowState? {
        switch event {
        case .sessionExpired, .logoutCompleted:
            return .unauthenticated
        default:
            return nil
        }
    }

    private static func reduceInitializing(event: AppFlowEvent) -> AppFlowState? {
        switch event {
        case .maintenanceChecked(let isInMaintenance):
            return isInMaintenance ? .maintenance : nil
        case .networkBecameUnavailable:
            return .networkUnavailable(retryable: true)
        case .startupTimedOut:
            return .networkUnavailable(retryable: true)
        case .sessionValidated(let result):
            return handleSessionValidation(result)
        default:
            return nil
        }
    }

    private static func reduceNetworkUnavailable(event: AppFlowEvent) -> AppFlowState? {
        if case .retryRequested = event { return .initializing }
        return nil
    }

    private static func reduceMaintenance(event: AppFlowEvent) -> AppFlowState? {
        if case .maintenanceChecked(false) = event { return .initializing }
        return nil
    }

    private static func reduceUnauthenticated(event: AppFlowEvent) -> AppFlowState? {
        guard case .authenticationSucceeded = event else { return nil }
        // Authentication success must still run post-auth resolution.
        return .initializing
    }

    private static func reduceSecuritySetup(
        phase: AppFlowState.SecuritySetupPhase,
        event: AppFlowEvent
    ) -> AppFlowState? {
        switch (phase, event) {
        case (.pinSetup, .pinSetupCompleted):
            return .authenticated
        case (.recoveryKeyConsent, .recoveryKeyConsentAccepted):
            return nil // Wait for key generation
        case (.recoveryKeyConsent, .recoveryKeyConsentDeclined):
            return .authenticated
        case (.recoveryKeyConsent, .recoveryKeyGenerated(let key)):
            return .securitySetup(.recoveryKeyPresentation(key: key))
        case (.recoveryKeyPresentation, .recoveryKeyPresentationDismissed):
            return .authenticated
        default:
            return nil
        }
    }

    private static func reduceAuthenticated(event: AppFlowEvent) -> AppFlowState? {
        switch event {
        case .foregroundLockRequired:
            return .locked(.backgroundTimeout)
        case .enteredBackground, .foregroundNoLockNeeded, .logoutRequested:
            return nil
        default:
            return nil
        }
    }

    private static func reduceLocked(event: AppFlowEvent) -> AppFlowState? {
        switch event {
        case .pinEntrySucceeded, .biometricUnlockSucceeded:
            return .authenticated
        case .biometricUnlockFailed:
            return nil
        case .recoveryInitiated:
            return .recovering
        default:
            return nil
        }
    }

    private static func reduceRecovering(event: AppFlowEvent) -> AppFlowState? {
        switch event {
        case .recoveryCompleted:
            return .authenticated
        case .recoveryCancelled:
            return .locked(.coldStart)
        case .recoverySessionExpired:
            return .unauthenticated
        default:
            return nil
        }
    }

    private static func handleSessionValidation(
        _ result: AppFlowEvent.SessionValidationResult
    ) -> AppFlowState {
        switch result {
        case .authenticated(_, let needsSecuritySetup, let needsRecoveryConsent):
            if needsSecuritySetup {
                return .securitySetup(.pinSetup)
            }
            if needsRecoveryConsent {
                return .securitySetup(.recoveryKeyConsent)
            }
            return .authenticated

        case .unauthenticated:
            return .unauthenticated

        case .biometricSessionExpired:
            return .unauthenticated
        }
    }
}

// MARK: - Transition Validation

extension AppFlowReducer {
    /// Checks if an event is valid for the current state.
    static func isValidTransition(from state: AppFlowState, event: AppFlowEvent) -> Bool {
        reduce(state: state, event: event) != nil
    }
}
