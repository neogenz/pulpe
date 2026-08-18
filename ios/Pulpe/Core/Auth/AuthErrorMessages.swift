import Foundation

/// Centralized user-facing auth/session error messages.
/// Keeps wording consistent across the startup, foreground and biometric paths.
enum AuthErrorMessages {
    /// Shown when a session check fails due to a transient connectivity problem
    /// (cold start, foreground refresh, biometric validation) — the session is not lost.
    ///
    /// Computed, not `static let`: a stored constant would resolve once and keep the
    /// language the app happened to be in when the type was first touched.
    static var connectionUnavailable: String {
        AppLocale.string("Connexion impossible, réessaie")
    }
}
