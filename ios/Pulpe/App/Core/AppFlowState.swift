import Foundation

// MARK: - App Flow State

/// Represents the high-level application flow state.
/// This is a pure value type that captures where the user is in the app lifecycle.
enum AppFlowState: Equatable, Sendable {
    /// Initial state - determining auth status
    case initializing

    /// App is in maintenance mode
    case maintenance

    /// Network unavailable during startup
    case networkUnavailable(retryable: Bool)

    /// User is not authenticated
    case unauthenticated

    /// User authenticated but needs PIN setup (first time)
    case securitySetup(SecuritySetupPhase)

    /// User authenticated but needs to unlock (PIN entry or biometric)
    case locked(LockReason)

    /// User is in PIN recovery flow
    case recovering

    /// User is fully authenticated and can access the app
    case authenticated

    // MARK: - Nested Types

    enum SecuritySetupPhase: Equatable, Sendable {
        case pinSetup
        case recoveryKeyConsent
        case recoveryKeyPresentation(key: String)
    }

    enum LockReason: Equatable, Sendable {
        case coldStart
        case backgroundTimeout
        case manualLock
    }
}

// MARK: - Convenience Properties

extension AppFlowState {
    /// Whether the user can access authenticated content
    var isAuthenticated: Bool {
        if case .authenticated = self { return true }
        return false
    }

    /// Whether a modal flow is active (security setup, recovery)
    var hasActiveModal: Bool {
        switch self {
        case .securitySetup: return true
        case .recovering: return true
        default: return false
        }
    }

    /// Whether the app is in a loading/transitional state
    var isTransitional: Bool {
        if case .initializing = self { return true }
        return false
    }

    /// Whether user interaction with auth UI is expected
    var requiresUserAction: Bool {
        switch self {
        case .unauthenticated, .securitySetup, .locked, .recovering:
            return true
        case .initializing, .maintenance, .networkUnavailable, .authenticated:
            return false
        }
    }
}
