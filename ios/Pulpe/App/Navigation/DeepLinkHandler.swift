import Foundation
import OSLog

/// Handles deep link processing with state-aware disposition.
///
/// This class manages pending deep links and processes them according to
/// the current auth state. Reset password links are deferred when loading,
/// presented when unauthenticated, and dropped when authenticated.
@MainActor
final class DeepLinkHandler {
    // MARK: - State

    private var pending: DeepLinkDestination?

    // MARK: - Public API

    /// Whether there's a pending reset password deep link.
    var hasPendingResetPassword: Bool {
        if case .resetPassword = pending { return true }
        return false
    }

    /// Sets a pending deep link destination.
    ///
    /// - Parameter destination: The deep link destination to queue.
    func setPending(_ destination: DeepLinkDestination) {
        pending = destination
        Logger.app.debug("[DEEPLINK] Queued destination: \(String(describing: destination))")
    }

    /// Clears all pending deep links.
    func clearPending() {
        pending = nil
    }

    /// Processes a pending reset password deep link.
    ///
    /// - Parameter authState: The current authentication state.
    /// - Returns: The processing result.
    func processResetPassword(authState: AppState.AuthStatus) -> ResetPasswordProcessResult {
        guard case .resetPassword(let url) = pending else {
            return .noPending
        }

        let disposition = ResetPasswordDeepLinkPolicy.disposition(for: authState)

        switch disposition {
        case .defer:
            Logger.app.debug("[DEEPLINK] Reset password deferred (auth state: \(String(describing: authState)))")
            return .deferred

        case .present:
            pending = nil
            Logger.app.info("[DEEPLINK] Presenting reset password flow")
            return .present(url)

        case .drop:
            pending = nil
            Logger.app.info("[DEEPLINK] Dropped reset password link (auth state: \(String(describing: authState)))")
            return .dropped
        }
    }
}
