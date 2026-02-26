import Foundation

/// Disposition result for reset password deep link processing.
enum ResetPasswordDeepLinkDisposition: Equatable, Sendable {
    /// Defer processing until auth state changes (e.g., during loading).
    case `defer`

    /// Present the reset password flow immediately.
    case present

    /// Drop the deep link (user is already authenticated).
    case drop
}

/// Policy for handling reset password deep links based on auth state.
///
/// **Rationale:**
/// - `loading`: We don't know if the user is authenticated yet. Defer until state resolves.
/// - `unauthenticated`: User needs to reset password, present the flow.
/// - Other states: User is in an auth flow or authenticated, drop the link.
enum ResetPasswordDeepLinkPolicy {
    /// Determines the disposition for a reset password deep link.
    ///
    /// - Parameter authState: The current authentication state.
    /// - Returns: The disposition for the deep link.
    static func disposition(for authState: AppState.AuthStatus) -> ResetPasswordDeepLinkDisposition {
        switch authState {
        case .loading:
            return .defer
        case .unauthenticated:
            return .present
        case .needsPinSetup, .needsPinEntry, .needsPinRecovery, .authenticated:
            return .drop
        }
    }
}

/// Result of processing a reset password deep link.
enum ResetPasswordProcessResult: Equatable, Sendable {
    /// The link was deferred for later processing.
    case deferred

    /// The link should be presented with the given URL.
    case present(URL)

    /// The link was dropped (not applicable in current state).
    case dropped

    /// No pending reset password link to process.
    case noPending
}
