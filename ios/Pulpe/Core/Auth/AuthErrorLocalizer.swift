import Foundation

enum AuthErrorKind: Equatable {
    case invalidCredentials
    case rateLimited
    case emailNotConfirmed
    case network
    case userNotFound
    case userAlreadyRegistered
    case weakPassword
    case samePassword
    case sessionExpired
    case reauthenticationNeeded
    case userBanned
    case unknown
}

enum AuthErrorLocalizer {
    // MARK: - Supabase error code translations (from error.code)
    private static let codeTranslations: [String: (AuthErrorKind, String)] = [
        "same_password": (.samePassword, "Le nouveau mot de passe doit être différent de l'ancien"),
        "weak_password": (.weakPassword, "Choisis un mot de passe plus sécurisé — 8 caractères avec lettres et chiffres"),
        "invalid_credentials": (.invalidCredentials, "Email ou mot de passe incorrect — réessaie"),
        "user_already_exists": (.userAlreadyRegistered, "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"),
        "email_exists": (.userAlreadyRegistered, "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"),
        "email_not_confirmed": (.emailNotConfirmed, "Confirme ton email pour continuer — vérifie ta boîte mail"),
        "session_expired": (.sessionExpired, "Ta session a expiré — reconnecte-toi"),
        "session_not_found": (.sessionExpired, "Ta session a expiré — reconnecte-toi"),
        "user_not_found": (.userNotFound, "Compte introuvable — vérifie ton email"),
        "over_email_send_rate_limit": (.rateLimited, "Trop d'emails envoyés — patiente quelques minutes"),
        "over_request_rate_limit": (.rateLimited, "Trop de tentatives — patiente quelques minutes"),
        "reauthentication_needed": (.reauthenticationNeeded, "Tu dois te reconnecter avant de modifier ton mot de passe"),
        "user_banned": (.userBanned, "Ton compte est en cours de suppression."),
        "validation_failed": (.unknown, "Les informations fournies ne sont pas valides"),
    ]

    // MARK: - Message-based translations (exact match)
    private static let messageTranslations: [String: (AuthErrorKind, String)] = [
        "Invalid login credentials": (.invalidCredentials, "Email ou mot de passe incorrect — réessaie"),
        "Email not confirmed": (.emailNotConfirmed, "Confirme ton email pour continuer — vérifie ta boîte mail"),
        "Too many requests": (.rateLimited, "Trop de tentatives — patiente quelques minutes"),
        "User already registered": (.userAlreadyRegistered, "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"),
        "Password should be at least 8 characters": (.weakPassword, "8 caractères minimum pour sécuriser ton compte"),
        "User not found": (.userNotFound, "Compte introuvable — vérifie ton email"),
        "Email link is invalid or has expired": (.sessionExpired, "Ce lien a expiré — demande-en un nouveau"),
        "Token has expired or is invalid": (.sessionExpired, "Ce lien a expiré — demande-en un nouveau"),
        "Session not found": (.sessionExpired, "Ta session a expiré — reconnecte-toi"),
        "Session expired": (.sessionExpired, "Ta session a expiré — reconnecte-toi"),
        "Network request failed": (.network, "Problème de connexion — vérifie ton réseau"),
        "A user with this email address has already been registered": (.userAlreadyRegistered, "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"),
    ]

    static func classify(_ error: Error) -> AuthErrorKind {
        // Check APIError first
        if let apiError = error as? APIError {
            switch apiError {
            case .invalidCredentials:
                return .invalidCredentials
            case .rateLimited:
                return .rateLimited
            case .networkError:
                return .network
            case .userAlreadyExists:
                return .userAlreadyRegistered
            case .weakPassword:
                return .weakPassword
            default:
                break
            }
        }

        // Try to extract Supabase error code from error description
        let description = error.localizedDescription
        
        // Check for error codes in the message (Supabase often includes them)
        for (code, (kind, _)) in codeTranslations {
            if description.contains(code) {
                return kind
            }
        }
        
        // Check exact message matches
        for (message, (kind, _)) in messageTranslations {
            if description.contains(message) {
                return kind
            }
        }

        // Fallback to keyword-based classification
        let message = description.lowercased()

        if message.contains("invalid login credentials") ||
            message.contains("invalid_credentials") ||
            message.contains("email ou mot de passe incorrect")
        {
            return .invalidCredentials
        }
        if message.contains("same_password") || message.contains("same password") {
            return .samePassword
        }
        if message.contains("too many requests") || message.contains("rate limit") || message.contains("throttle") {
            return .rateLimited
        }
        if message.contains("email not confirmed") {
            return .emailNotConfirmed
        }
        if message.contains("network") || message.contains("connection") || message.contains("timeout") {
            return .network
        }
        if message.contains("user not found") {
            return .userNotFound
        }
        if message.contains("user already registered") || message.contains("already been registered") || message.contains("email_exists") {
            return .userAlreadyRegistered
        }
        if message.contains("weak") && message.contains("password") {
            return .weakPassword
        }
        if message.contains("session") && (message.contains("expired") || message.contains("not found")) {
            return .sessionExpired
        }
        if message.contains("banned") || message.contains("blocked") {
            return .userBanned
        }

        return .unknown
    }

    static func isInvalidCredentials(_ error: Error) -> Bool {
        classify(error) == .invalidCredentials
    }

    static func localize(_ error: Error) -> String {
        let description = error.localizedDescription
        
        // Try code-based translation first
        for (code, (_, message)) in codeTranslations {
            if description.contains(code) {
                return message
            }
        }
        
        // Try exact message match
        for (errorMessage, (_, localizedMessage)) in messageTranslations {
            if description.contains(errorMessage) {
                return localizedMessage
            }
        }
        
        // Fall back to kind-based message
        switch classify(error) {
        case .invalidCredentials:
            return "Email ou mot de passe incorrect — réessaie"
        case .rateLimited:
            return "Trop de tentatives — patiente quelques minutes"
        case .emailNotConfirmed:
            return "Confirme ton email pour continuer — vérifie ta boîte mail"
        case .network:
            return "Connexion impossible — vérifie ta connexion internet"
        case .userNotFound:
            return "Compte introuvable — vérifie ton email"
        case .userAlreadyRegistered:
            return "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"
        case .weakPassword:
            return "Choisis un mot de passe plus sécurisé — 8 caractères avec lettres et chiffres"
        case .samePassword:
            return "Le nouveau mot de passe doit être différent de l'ancien"
        case .sessionExpired:
            return "Ta session a expiré — reconnecte-toi"
        case .reauthenticationNeeded:
            return "Tu dois te reconnecter avant de modifier ton mot de passe"
        case .userBanned:
            return "Ton compte est en cours de suppression."
        case .unknown:
            return "Quelque chose n'a pas fonctionné — réessaie"
        }
    }
}
