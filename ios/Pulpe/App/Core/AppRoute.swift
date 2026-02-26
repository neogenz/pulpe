import Foundation

// MARK: - App Route

/// Represents the current navigation destination based on app flow state.
/// Used by RootView to determine which screen to display.
enum AppRoute: Equatable, Sendable {
    /// Loading/splash screen during initialization
    case loading

    /// Maintenance mode screen
    case maintenance

    /// Network unavailable screen with retry option
    case networkError

    /// Login/signup screen
    case login

    /// PIN setup screen (first time user)
    case pinSetup

    /// Recovery key consent alert
    case recoveryKeyConsent

    /// Recovery key presentation sheet
    case recoveryKeyPresentation(key: String)

    /// PIN entry screen (returning user)
    case pinEntry(canUseBiometric: Bool)

    /// PIN recovery flow
    case pinRecovery

    /// Main authenticated app content
    case main
}

// MARK: - Route Derivation

extension AppRoute {
    /// Derives the navigation route from the current flow state.
    /// This is a pure function that maps state to view.
    static func from(
        flowState: AppFlowState,
        biometricEnabled: Bool = false
    ) -> AppRoute {
        switch flowState {
        case .initializing:
            return .loading

        case .maintenance:
            return .maintenance

        case .networkUnavailable:
            return .networkError

        case .unauthenticated:
            return .login

        case .securitySetup(let phase):
            return securitySetupRoute(for: phase)

        case .locked:
            return .pinEntry(canUseBiometric: biometricEnabled)

        case .recovering:
            return .pinRecovery

        case .authenticated:
            return .main
        }
    }

    private static func securitySetupRoute(for phase: AppFlowState.SecuritySetupPhase) -> AppRoute {
        switch phase {
        case .pinSetup:
            return .pinSetup
        case .recoveryKeyConsent:
            return .recoveryKeyConsent
        case .recoveryKeyPresentation(let key):
            return .recoveryKeyPresentation(key: key)
        }
    }
}

// MARK: - Route Properties

extension AppRoute {
    /// Whether this route shows authenticated content
    var isAuthenticated: Bool {
        self == .main
    }

    /// Whether this route requires security UI
    var isSecurityRelated: Bool {
        switch self {
        case .pinSetup, .pinEntry, .pinRecovery,
             .recoveryKeyConsent, .recoveryKeyPresentation:
            return true
        default:
            return false
        }
    }

    /// Whether navigation stack should be preserved during this route
    var preservesNavigation: Bool {
        switch self {
        case .main, .loading:
            return true
        default:
            return false
        }
    }
}
