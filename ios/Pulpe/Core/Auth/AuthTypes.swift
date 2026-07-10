import Foundation

// MARK: - Auth Errors

enum AuthServiceError: LocalizedError, Equatable {
    case signupFailed(String)
    case loginFailed(String)
    case biometricSaveFailed
    case biometricSessionExpired
    /// Post-auth resolution determined the user is no longer authenticated
    /// (vault-status returned 401 even after a refresh attempt).
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .signupFailed(let message):
            return "L'inscription n'a pas abouti — \(message)"
        case .loginFailed(let message):
            return "La connexion n'a pas abouti — \(message)"
        case .biometricSaveFailed:
            return "Les identifiants biométriques n'ont pas pu être enregistrés"
        case .biometricSessionExpired:
            return "La session biométrique a expiré — reconnecte-toi"
        case .sessionExpired:
            return "Ta session a expiré — reconnecte-toi"
        }
    }
}

// MARK: - Response Types

struct BiometricSessionResult: Sendable {
    let user: UserInfo
    let clientKeyHex: String?
}

/// Auth provider that created the Supabase user.
/// Used to disambiguate email signup from OAuth during post-auth routing.
enum AuthProvider: String, Codable, Equatable, Sendable {
    case email
    case apple
    case google

    /// Maps a Supabase `app_metadata.provider` value to an `AuthProvider`.
    /// Supabase uses lowercase strings like "email", "apple", "google", but some
    /// deployments may return "apple.com" or "google.com" — accept both.
    static func fromSupabase(_ rawValue: String) -> AuthProvider? {
        switch rawValue.lowercased() {
        case "email": return .email
        case "apple", "apple.com": return .apple
        case "google", "google.com": return .google
        default: return nil
        }
    }
}

struct UserInfo: Codable, Equatable, Sendable {
    let id: String
    let email: String
    var firstName: String?
    let provider: AuthProvider?
    /// Mirrored from Supabase `auth.users.app_metadata.early_adopter` — PostHog feature flag target.
    var isEarlyAdopter: Bool = false

    init(id: String, email: String, firstName: String? = nil,
         provider: AuthProvider? = nil, isEarlyAdopter: Bool = false) {
        self.id = id
        self.email = email
        self.firstName = firstName
        self.provider = provider
        self.isEarlyAdopter = isEarlyAdopter
    }
}

struct DeleteAccountResponse: Codable, Sendable {
    let success: Bool
    let message: String
    let scheduledDeletionAt: String
}

struct PasswordRecoveryContext: Equatable, Sendable {
    let userId: String
    let email: String
    let firstName: String?
    let hasVaultCodeConfigured: Bool
}
