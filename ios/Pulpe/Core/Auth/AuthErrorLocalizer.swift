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
        "weak_password": (
            .weakPassword, "Ce mot de passe est trop prévisible — essaie une combinaison moins courante"
        ),
        "invalid_credentials": (.invalidCredentials, "Email ou mot de passe incorrect — réessaie"),
        "user_already_exists": (
            .userAlreadyRegistered, "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"
        ),
        "email_exists": (.userAlreadyRegistered, "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"),
        "email_not_confirmed": (.emailNotConfirmed, "Confirme ton email pour continuer — vérifie ta boîte mail"),
        "session_expired": (.sessionExpired, "Ta session a expiré — reconnecte-toi"),
        "session_not_found": (.sessionExpired, "Ta session a expiré — reconnecte-toi"),
        "user_not_found": (.userNotFound, "Compte introuvable — vérifie ton email"),
        "over_email_send_rate_limit": (.rateLimited, "Trop d'emails envoyés — patiente quelques minutes"),
        "over_request_rate_limit": (.rateLimited, "Trop de tentatives — patiente quelques minutes"),
        "reauthentication_needed": (
            .reauthenticationNeeded,
            "Tu dois te reconnecter avant de modifier ton mot de passe"
        ),
        "user_banned": (.userBanned, "Ton compte est en cours de suppression."),
        "validation_failed": (.unknown, "Les informations fournies ne sont pas valides"),
    ]

    // MARK: - Message-based translations (exact match)
    private static let messageTranslations: [String: (AuthErrorKind, String)] = [
        "Invalid login credentials": (.invalidCredentials, "Email ou mot de passe incorrect — réessaie"),
        "Email not confirmed": (.emailNotConfirmed, "Confirme ton email pour continuer — vérifie ta boîte mail"),
        "Too many requests": (.rateLimited, "Trop de tentatives — patiente quelques minutes"),
        "User already registered": (
            .userAlreadyRegistered, "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"
        ),
        "Password should be at least 8 characters": (.weakPassword, "8 caractères minimum pour sécuriser ton compte"),
        "User not found": (.userNotFound, "Compte introuvable — vérifie ton email"),
        "Email link is invalid or has expired": (.sessionExpired, "Ce lien a expiré — demande-en un nouveau"),
        "Token has expired or is invalid": (.sessionExpired, "Ce lien a expiré — demande-en un nouveau"),
        "Session not found": (.sessionExpired, "Ta session a expiré — reconnecte-toi"),
        "Session expired": (.sessionExpired, "Ta session a expiré — reconnecte-toi"),
        "Network request failed": (.network, "Problème de connexion — vérifie ton réseau"),
        "A user with this email address has already been registered": (
            .userAlreadyRegistered, "Cet email est déjà utilisé — tu as peut-être déjà un compte ?"
        ),
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
        for (code, (kind, _)) in codeTranslations where description.contains(code) {
            return kind
        }

        // Check exact message matches
        for (message, (kind, _)) in messageTranslations where description.contains(message) {
            return kind
        }

        // Fallback to keyword-based classification
        return classifyByKeywords(description) ?? .unknown
    }

    private static let keywordPatterns: [(String, AuthErrorKind)] = [
        ("invalid login credentials", .invalidCredentials),
        ("invalid_credentials", .invalidCredentials),
        ("email ou mot de passe incorrect", .invalidCredentials),
        ("same_password", .samePassword),
        ("same password", .samePassword),
        ("too many requests", .rateLimited),
        ("rate limit", .rateLimited),
        ("throttle", .rateLimited),
        ("email not confirmed", .emailNotConfirmed),
        ("network", .network),
        ("connection", .network),
        ("timeout", .network),
        ("user not found", .userNotFound),
        ("user already registered", .userAlreadyRegistered),
        ("already been registered", .userAlreadyRegistered),
        ("email_exists", .userAlreadyRegistered),
        ("banned", .userBanned),
        ("blocked", .userBanned),
    ]

    private static func classifyByKeywords(_ message: String) -> AuthErrorKind? {
        let lowercased = message.lowercased()

        for (keyword, kind) in keywordPatterns where lowercased.contains(keyword) {
            // Special case for weak password (requires both "weak" and "password")
            if kind == .weakPassword && !lowercased.contains("password") {
                continue
            }
            return kind
        }

        // Session check (requires both session and (expired or not found))
        if lowercased.contains("session") && (lowercased.contains("expired") || lowercased.contains("not found")) {
            return .sessionExpired
        }

        // Weak password check (requires both weak and password)
        if lowercased.contains("weak") && lowercased.contains("password") {
            return .weakPassword
        }

        return nil
    }

    static func isInvalidCredentials(_ error: Error) -> Bool {
        classify(error) == .invalidCredentials
    }

    private static let kindMessages: [AuthErrorKind: String] = [
        .invalidCredentials: "Email ou mot de passe incorrect — réessaie",
        .rateLimited: "Trop de tentatives — patiente quelques minutes",
        .emailNotConfirmed: "Confirme ton email pour continuer — vérifie ta boîte mail",
        .network: "Connexion impossible — vérifie ta connexion internet",
        .userNotFound: "Compte introuvable — vérifie ton email",
        .userAlreadyRegistered: "Cet email est déjà utilisé — tu as peut-être déjà un compte ?",
        .weakPassword: "Ce mot de passe est trop prévisible — essaie une combinaison moins courante",
        .samePassword: "Le nouveau mot de passe doit être différent de l'ancien",
        .sessionExpired: "Ta session a expiré — reconnecte-toi",
        .reauthenticationNeeded: "Tu dois te reconnecter avant de modifier ton mot de passe",
        .userBanned: "Ton compte est en cours de suppression.",
        .unknown: "Quelque chose n'a pas fonctionné — réessaie",
    ]

    static func localize(_ error: Error) -> String {
        let description = error.localizedDescription

        // Try code-based translation first
        for (code, (_, message)) in codeTranslations where description.contains(code) {
            return message
        }

        // Try exact message match
        for (errorMessage, (_, localizedMessage)) in messageTranslations where description.contains(errorMessage) {
            return localizedMessage
        }

        // Fall back to kind-based message
        let kind = classify(error)
        return kindMessages[kind] ?? "Quelque chose n'a pas fonctionné — réessaie"
    }
}
