import Foundation

/// API endpoints enumeration
/// Note: Auth (login/signup) is handled directly by Supabase SDK, not backend
enum Endpoint {
    // MARK: - Auth (validation only - tokens managed by Supabase)

    case validateSession

    // MARK: - User

    case userProfile
    case updateProfile
    case deleteAccount

    // MARK: - Budgets

    case budgets
    case budget(id: String)
    case budgetDetails(id: String)
    case budgetsExport
    case budgetsSparse(fields: String, limit: Int?, year: Int?)

    // MARK: - Budget Lines

    case budgetLines(budgetId: String)
    case budgetLinesCreate
    case budgetLine(id: String)
    case budgetLineToggle(id: String)
    case budgetLineResetFromTemplate(id: String)

    // MARK: - Transactions

    case transactionsByBudget(budgetId: String)
    case transactionsCreate
    case transaction(id: String)
    case transactionToggle(id: String)

    // MARK: - Templates

    case templates
    case template(id: String)
    case templateUsage(id: String)
    case templateFromOnboarding

    // MARK: - Template Lines

    case templateLines(templateId: String)
    case templateLine(id: String)
    case templateLinesBulk(templateId: String)

    // MARK: - Encryption

    case encryptionVaultStatus
    case encryptionSalt
    case encryptionValidateKey
    case encryptionSetupRecovery
    case encryptionRegenerateRecovery
    case encryptionRecover

    // MARK: - Path

    var path: String {
        switch self {
        // Auth
        case .validateSession: return "/auth/validate"

        // User
        case .userProfile: return "/users/me"
        case .updateProfile: return "/users/me"
        case .deleteAccount: return "/users/account"

        // Budgets
        case .budgets: return "/budgets"
        case .budget(let id): return "/budgets/\(id)"
        case .budgetDetails(let id): return "/budgets/\(id)/details"
        case .budgetsExport: return "/budgets/export"
        case .budgetsSparse: return "/budgets"

        // Budget Lines
        case .budgetLines(let budgetId): return "/budgets/\(budgetId)/lines"
        case .budgetLinesCreate: return "/budget-lines"
        case .budgetLine(let id): return "/budget-lines/\(id)"
        case .budgetLineToggle(let id): return "/budget-lines/\(id)/toggle-check"
        case .budgetLineResetFromTemplate(let id): return "/budget-lines/\(id)/reset-from-template"

        // Transactions
        case .transactionsByBudget(let budgetId): return "/transactions/budget/\(budgetId)"
        case .transactionsCreate: return "/transactions"
        case .transaction(let id): return "/transactions/\(id)"
        case .transactionToggle(let id): return "/transactions/\(id)/toggle-check"

        // Templates
        case .templates: return "/budget-templates"
        case .template(let id): return "/budget-templates/\(id)"
        case .templateUsage(let id): return "/budget-templates/\(id)/usage"
        case .templateFromOnboarding: return "/budget-templates/from-onboarding"

        // Template Lines
        case .templateLines(let templateId): return "/budget-templates/\(templateId)/lines"
        case .templateLine(let id): return "/template-lines/\(id)"
        case .templateLinesBulk(let templateId): return "/budget-templates/\(templateId)/lines/bulk"

        // Encryption
        case .encryptionVaultStatus: return "/encryption/vault-status"
        case .encryptionSalt: return "/encryption/salt"
        case .encryptionValidateKey: return "/encryption/validate-key"
        case .encryptionSetupRecovery: return "/encryption/setup-recovery"
        case .encryptionRegenerateRecovery: return "/encryption/regenerate-recovery"
        case .encryptionRecover: return "/encryption/recover"
        }
    }

    // MARK: - Method

    var method: HTTPMethod {
        switch self {
        case .budgets, .budgetLines, .budgetLinesCreate, .transactionsCreate, .templates,
             .templateLines, .templateFromOnboarding, .templateLinesBulk:
            return .post

        case .validateSession, .userProfile, .budget, .budgetDetails, .budgetsExport,
             .budgetLine, .transaction, .template, .templateUsage, .templateLine,
             .transactionsByBudget, .budgetsSparse,
             .encryptionVaultStatus, .encryptionSalt:
            return .get

        case .updateProfile:
            return .patch

        case .deleteAccount:
            return .delete

        case .budgetLineToggle, .budgetLineResetFromTemplate, .transactionToggle,
             .encryptionValidateKey, .encryptionSetupRecovery, .encryptionRegenerateRecovery, .encryptionRecover:
            return .post
        }
    }

    // MARK: - URL Request

    func urlRequest(baseURL: URL) -> URLRequest {
        var url = baseURL.appendingPathComponent(path)

        // Add query parameters for sparse budgets
        if case let .budgetsSparse(fields, limit, year) = self {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            var queryItems: [URLQueryItem] = [URLQueryItem(name: "fields", value: fields)]
            if let limit { queryItems.append(URLQueryItem(name: "limit", value: String(limit))) }
            if let year { queryItems.append(URLQueryItem(name: "year", value: String(year))) }
            components?.queryItems = queryItems
            url = components?.url ?? url
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = AppConfiguration.requestTimeout
        return request
    }
}

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}
