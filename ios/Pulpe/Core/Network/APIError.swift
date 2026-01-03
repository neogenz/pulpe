import Foundation

/// API error types with French localized messages
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case conflict(message: String)
    case validationError(details: [String])
    case serverError(message: String)
    case networkError(Error)
    case decodingError(Error)
    case unknown(statusCode: Int)

    // MARK: - Known Error Codes

    case budgetAlreadyExists
    case templateNotFound
    case templateLimitReached
    case invalidCredentials
    case userAlreadyExists
    case weakPassword
    case rateLimited

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL invalide"
        case .invalidResponse:
            return "Réponse invalide du serveur"
        case .unauthorized:
            return "Session expirée. Veuillez vous reconnecter."
        case .forbidden:
            return "Accès non autorisé"
        case .notFound:
            return "Ressource introuvable"
        case .conflict(let message):
            return message
        case .validationError(let details):
            return details.joined(separator: "\n")
        case .serverError(let message):
            return message
        case .networkError:
            return "Erreur de connexion. Vérifiez votre connexion internet."
        case .decodingError:
            return "Erreur lors du traitement des données"
        case .unknown(let code):
            return "Erreur inattendue (code: \(code))"

        // Known error codes
        case .budgetAlreadyExists:
            return "Un budget existe déjà pour cette période. Veuillez sélectionner un autre mois."
        case .templateNotFound:
            return "Le modèle sélectionné n'existe plus. Veuillez en choisir un autre."
        case .templateLimitReached:
            return "Vous avez atteint la limite de 5 modèles. Supprimez-en un pour en créer un nouveau."
        case .invalidCredentials:
            return "Email ou mot de passe incorrect"
        case .userAlreadyExists:
            return "Cet email est déjà utilisé"
        case .weakPassword:
            return "Le mot de passe doit contenir au moins 8 caractères"
        case .rateLimited:
            return "Trop de tentatives. Veuillez réessayer dans quelques minutes."
        }
    }

    /// Create APIError from server error code
    static func from(code: String?, message: String?) -> APIError {
        guard let code else {
            return .serverError(message: message ?? "Erreur inconnue")
        }

        switch code {
        case "ERR_BUDGET_ALREADY_EXISTS":
            return .budgetAlreadyExists
        case "ERR_TEMPLATE_NOT_FOUND":
            return .templateNotFound
        case "ERR_TEMPLATE_LIMIT_REACHED":
            return .templateLimitReached
        case "invalid_credentials", "Invalid login credentials":
            return .invalidCredentials
        case "user_already_exists", "User already registered":
            return .userAlreadyExists
        case "weak_password":
            return .weakPassword
        case "over_request_rate_limit":
            return .rateLimited
        default:
            return .serverError(message: message ?? code)
        }
    }
}
