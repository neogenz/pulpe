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
    case maintenance
    case clientKeyInvalid
    case recoveryKeyInvalid
    case recoveryKeyNotConfigured

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "L'adresse n'est pas valide — vérifie le lien"
        case .invalidResponse:
            return "Le serveur a répondu de façon inattendue — réessaie"
        case .unauthorized:
            return "Session expirée — reconnecte-toi pour continuer"
        case .forbidden:
            return "Tu n'as pas accès à cette ressource"
        case .notFound:
            return "Cette page n'existe plus ou a été déplacée"
        case .conflict(let message):
            return message
        case .validationError(let details):
            return details.joined(separator: "\n")
        case .serverError(let message):
            return message
        case .networkError:
            return "Connexion impossible — vérifie ta connexion internet"
        case .decodingError:
            return "Les données reçues sont illisibles — réessaie"
        case .unknown(let code):
            return "Quelque chose n'a pas fonctionné (code: \(code))"

        // Known error codes
        case .budgetAlreadyExists:
            return "Un budget existe déjà pour cette période — choisis un autre mois"
        case .templateNotFound:
            return "Ce modèle n'existe plus — choisis-en un autre"
        case .templateLimitReached:
            return "Tu as atteint la limite de 5 modèles — supprime-en un pour en créer un nouveau"
        case .invalidCredentials:
            return "Email ou mot de passe incorrect — on réessaie ?"
        case .userAlreadyExists:
            return "Cet email est déjà utilisé — connecte-toi ou utilise un autre"
        case .weakPassword:
            return "8 caractères minimum pour sécuriser ton compte"
        case .rateLimited:
            return "Trop de tentatives — patiente quelques minutes"
        case .maintenance:
            return "Application en maintenance — réessaie dans quelques instants"
        case .clientKeyInvalid:
            return "Ton code d'accès a été modifié — saisis ton nouveau code"
        case .recoveryKeyInvalid:
            return "Clé de récupération invalide — vérifie que tu as bien copié la clé"
        case .recoveryKeyNotConfigured:
            return "Aucune clé de secours n'est enregistrée — génère-en une depuis « Clé de secours »."
        }
    }

    private static let codeMapping: [String: APIError] = [
        "ERR_BUDGET_ALREADY_EXISTS": .budgetAlreadyExists,
        "ERR_TEMPLATE_NOT_FOUND": .templateNotFound,
        "ERR_TEMPLATE_LIMIT_REACHED": .templateLimitReached,
        "invalid_credentials": .invalidCredentials,
        "Invalid login credentials": .invalidCredentials,
        "user_already_exists": .userAlreadyExists,
        "User already registered": .userAlreadyExists,
        "weak_password": .weakPassword,
        "over_request_rate_limit": .rateLimited,
        "MAINTENANCE": .maintenance,
        "ERR_ENCRYPTION_KEY_CHECK_FAILED": .clientKeyInvalid,
        "ERR_RECOVERY_KEY_INVALID": .recoveryKeyInvalid,
        "ERR_RECOVERY_KEY_NOT_CONFIGURED": .recoveryKeyNotConfigured,
    ]

    /// Create APIError from server error code
    static func from(code: String?, message: String?) -> APIError {
        guard let code else {
            return .serverError(message: message ?? "Quelque chose n'a pas fonctionné")
        }

        if let error = codeMapping[code] {
            return error
        }

        return .serverError(message: message ?? code)
    }
}
