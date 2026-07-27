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
    case rekeyPartialFailure
    case savingsWithdrawalMonthUnprovisionable
    case savingsWithdrawalGroupNotFound
    case savingsWithdrawalConflict
    case savingsWithdrawalRecalculationFailed
    case savingsGoalBaselineRecalculationFailed
    case savingsGoalGenerationStopRecalculationFailed
    case savingsGoalReconciliationRequired
    case savingsGoalReconciliationConflict
    case savingsGoalReconciliationFailed
    case savingsGoalReconciliationRecalculationFailed
    case tagAlreadyExists

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
            return "Ressource introuvable — réessaie ou mets l'app à jour"
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
        case .rekeyPartialFailure:
            return "Le changement de PIN a réussi mais la clé de secours n'a pas pu être mise à jour"

        // Savings withdrawal (PUL-292) — copy aligned with the webapp fr.json.
        case .savingsWithdrawalMonthUnprovisionable:
            return "Le mois suivant n'a pas de modèle par défaut — impossible d'y placer le remboursement"
        case .savingsWithdrawalGroupNotFound:
            return "Cette pioche est introuvable — elle a peut-être déjà été supprimée"
        case .savingsWithdrawalConflict:
            return "Une pioche est déjà en place pour ce mois"
        case .savingsWithdrawalRecalculationFailed:
            return "La pioche a bien été créée, mais les soldes n'ont pas pu être actualisés — "
                + "recharge la page sans relancer la pioche"
        case .savingsGoalBaselineRecalculationFailed:
            return "L'objectif et sa prévision mensuelle ont bien été créés, mais les soldes "
                + "n'ont pas pu être actualisés — recharge la page sans recréer l'objectif"
        case .savingsGoalGenerationStopRecalculationFailed:
            return "La décision a bien été enregistrée, mais les soldes n'ont pas pu être actualisés — "
                + "recharge la page sans réessayer"
        case .savingsGoalReconciliationRequired:
            return "Les prévisions liées ont changé — choisis à nouveau comment les traiter"
        case .savingsGoalReconciliationConflict:
            return "Les prévisions liées ont changé depuis l'aperçu — vérifie la nouvelle liste"
        case .savingsGoalReconciliationFailed:
            return "Impossible de modifier l'échéance et ses prévisions — réessaie"
        case .savingsGoalReconciliationRecalculationFailed:
            return "L'échéance a bien été modifiée, mais les soldes n'ont pas pu être actualisés — "
                + "recharge sans réessayer"
        case .tagAlreadyExists:
            return "Un tag porte déjà ce nom — choisis-en un autre"
        }
    }

    /// URLSession cancellation (Code=-999) is thrown as NSError, not Swift CancellationError.
    var isCancellation: Bool {
        if case .networkError(let inner) = self {
            let nsError = inner as NSError
            return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
        }
        return false
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
        "ERR_ENCRYPTION_REKEY_PARTIAL_FAILURE": .rekeyPartialFailure,
        "ERR_SAVINGS_WITHDRAWAL_MONTH_UNPROVISIONABLE": .savingsWithdrawalMonthUnprovisionable,
        "ERR_SAVINGS_WITHDRAWAL_GROUP_NOT_FOUND": .savingsWithdrawalGroupNotFound,
        "ERR_SAVINGS_WITHDRAWAL_CONFLICT": .savingsWithdrawalConflict,
        "ERR_SAVINGS_WITHDRAWAL_RECALCULATION_FAILED": .savingsWithdrawalRecalculationFailed,
        "ERR_SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED": .savingsGoalBaselineRecalculationFailed,
        "ERR_SAVINGS_GOAL_GENERATION_STOP_RECALCULATION_FAILED": .savingsGoalGenerationStopRecalculationFailed,
        "ERR_SAVINGS_GOAL_RECONCILIATION_REQUIRED": .savingsGoalReconciliationRequired,
        "ERR_SAVINGS_GOAL_RECONCILIATION_CONFLICT": .savingsGoalReconciliationConflict,
        "ERR_SAVINGS_GOAL_RECONCILIATION_FAILED": .savingsGoalReconciliationFailed,
        "ERR_SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED": .savingsGoalReconciliationRecalculationFailed,
        "ERR_TAG_ALREADY_EXISTS": .tagAlreadyExists,
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

extension APIError {
    var requiresSavingsGoalReconciliationRefresh: Bool {
        switch self {
        case .savingsGoalReconciliationRequired, .savingsGoalReconciliationConflict:
            true
        default:
            false
        }
    }
}

extension NSError {
    var isURLCancellation: Bool {
        domain == NSURLErrorDomain && code == NSURLErrorCancelled
    }
}

extension Error {
    /// Returns true for Swift CancellationError OR URLSession cancellation (Code=-999).
    var isCancellationOrURLCancellation: Bool {
        self is CancellationError || (self as? APIError)?.isCancellation == true ||
            (self as NSError).isURLCancellation
    }
}
