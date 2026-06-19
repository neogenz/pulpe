/// Centralized user-facing auth/session error messages (French).
/// Keeps wording (and accents) consistent across the startup, foreground and biometric paths.
enum AuthErrorMessages {
    /// Shown when a session check fails due to a transient connectivity problem
    /// (cold start, foreground refresh, biometric validation) — the session is not lost.
    static let connectionUnavailable = "Connexion impossible, réessaie"
}
