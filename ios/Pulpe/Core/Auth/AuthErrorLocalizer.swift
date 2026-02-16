import Foundation

enum AuthErrorKind: Equatable {
    case invalidCredentials
    case rateLimited
    case emailNotConfirmed
    case network
    case userNotFound
    case userAlreadyRegistered
    case weakPassword
    case unknown
}

enum AuthErrorLocalizer {
    static func classify(_ error: Error) -> AuthErrorKind {
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

        let message = error.localizedDescription.lowercased()

        if message.contains("invalid login credentials") ||
            message.contains("invalid_credentials") ||
            message.contains("email ou mot de passe incorrect")
        {
            return .invalidCredentials
        }
        if message.contains("too many requests") || message.contains("rate limit") {
            return .rateLimited
        }
        if message.contains("email not confirmed") {
            return .emailNotConfirmed
        }
        if message.contains("network") || message.contains("connection") {
            return .network
        }
        if message.contains("user not found") {
            return .userNotFound
        }
        if message.contains("user already registered") || message.contains("already been registered") {
            return .userAlreadyRegistered
        }
        if message.contains("weak password") {
            return .weakPassword
        }

        return .unknown
    }

    static func isInvalidCredentials(_ error: Error) -> Bool {
        classify(error) == .invalidCredentials
    }

    static func localize(_ error: Error) -> String {
        switch classify(error) {
        case .invalidCredentials:
            return "Email ou mot de passe incorrect — on réessaie ?"
        case .rateLimited:
            return "Trop de tentatives — patiente quelques minutes"
        case .emailNotConfirmed:
            return "Confirme ton email pour pouvoir te connecter"
        case .network:
            return "Connexion impossible — vérifie ta connexion internet"
        case .userNotFound:
            return "Aucun compte trouvé avec cet email — crée-en un ?"
        case .userAlreadyRegistered:
            return "Cet email est déjà utilisé — connecte-toi ou utilise un autre"
        case .weakPassword:
            return "8 caractères minimum pour sécuriser ton compte"
        case .unknown:
            return "Quelque chose n'a pas fonctionné — réessaye"
        }
    }
}
