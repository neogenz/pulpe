import Foundation

// MARK: - App Flow Event

/// Events that can trigger state transitions in the app flow.
/// Each event represents a user action, system event, or async operation result.
enum AppFlowEvent: Equatable, Sendable {
    // MARK: - Startup Events

    /// App launched, begin initialization
    case startupInitiated

    /// Maintenance check completed
    case maintenanceChecked(isInMaintenance: Bool)

    /// Network became unavailable during startup
    case networkBecameUnavailable

    /// User tapped retry after network error
    case retryRequested

    // MARK: - Session Events

    /// Session validation completed
    case sessionValidated(SessionValidationResult)

    /// Session expired (401 from API)
    case sessionExpired

    /// Session refresh failed
    case sessionRefreshFailed

    // MARK: - Authentication Events

    /// User successfully logged in or signed up
    case authenticationSucceeded(user: UserInfo)

    /// User initiated logout
    case logoutRequested(source: LogoutSource)

    /// Logout completed (cleanup done)
    case logoutCompleted

    // MARK: - Security Setup Events

    /// PIN setup completed successfully
    case pinSetupCompleted

    /// Recovery key consent accepted
    case recoveryKeyConsentAccepted

    /// Recovery key consent declined
    case recoveryKeyConsentDeclined

    /// Recovery key generated and ready to present
    case recoveryKeyGenerated(key: String)

    /// Recovery key presentation dismissed
    case recoveryKeyPresentationDismissed

    // MARK: - Lock/Unlock Events

    /// App entered background
    case enteredBackground

    /// App entered foreground after grace period expired
    case foregroundLockRequired

    /// App entered foreground within grace period
    case foregroundNoLockNeeded

    /// PIN entry succeeded
    case pinEntrySucceeded

    /// Biometric unlock succeeded
    case biometricUnlockSucceeded

    /// Biometric unlock failed, fallback to PIN
    case biometricUnlockFailed

    // MARK: - Recovery Events

    /// User initiated PIN recovery (forgot PIN)
    case recoveryInitiated

    /// Recovery completed successfully
    case recoveryCompleted

    /// Recovery cancelled by user
    case recoveryCancelled

    /// Session expired during recovery
    case recoverySessionExpired

    // MARK: - Nested Types

    enum SessionValidationResult: Equatable, Sendable {
        case authenticated(user: UserInfo, needsSecuritySetup: Bool, needsRecoveryConsent: Bool)
        case unauthenticated
        case biometricSessionExpired
    }

    enum LogoutSource: Equatable, Sendable {
        case userInitiated
        case system
    }
}
