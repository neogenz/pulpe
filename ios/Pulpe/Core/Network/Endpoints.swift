import Foundation

/// API endpoints enumeration
/// Note: Auth (login/signup) is handled directly by Supabase SDK, not backend
enum Endpoint {
    // MARK: - Auth (validation only - tokens managed by Supabase)

    case validateSession

    // MARK: - User

    case userProfile
    case updateProfile

    // MARK: - Budgets

    case budgets
    case budget(id: String)
    case budgetDetails(id: String)
    case budgetsExport

    // MARK: - Budget Lines

    case budgetLines(budgetId: String)
    case budgetLine(id: String)
    case budgetLineToggle(id: String)
    case budgetLineResetFromTemplate(id: String)

    // MARK: - Transactions

    case transactions(budgetId: String)
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

    // MARK: - Path

    var path: String {
        switch self {
        // Auth
        case .validateSession: return "/auth/validate"

        // User
        case .userProfile: return "/users/me"
        case .updateProfile: return "/users/me"

        // Budgets
        case .budgets: return "/budgets"
        case .budget(let id): return "/budgets/\(id)"
        case .budgetDetails(let id): return "/budgets/\(id)/details"
        case .budgetsExport: return "/budgets/export"

        // Budget Lines
        case .budgetLines(let budgetId): return "/budgets/\(budgetId)/lines"
        case .budgetLine(let id): return "/budget-lines/\(id)"
        case .budgetLineToggle(let id): return "/budget-lines/\(id)/toggle"
        case .budgetLineResetFromTemplate(let id): return "/budget-lines/\(id)/reset-from-template"

        // Transactions
        case .transactions(let budgetId): return "/budgets/\(budgetId)/transactions"
        case .transaction(let id): return "/transactions/\(id)"
        case .transactionToggle(let id): return "/transactions/\(id)/toggle"

        // Templates
        case .templates: return "/budget-templates"
        case .template(let id): return "/budget-templates/\(id)"
        case .templateUsage(let id): return "/budget-templates/\(id)/usage"
        case .templateFromOnboarding: return "/budget-templates/from-onboarding"

        // Template Lines
        case .templateLines(let templateId): return "/budget-templates/\(templateId)/lines"
        case .templateLine(let id): return "/template-lines/\(id)"
        case .templateLinesBulk(let templateId): return "/budget-templates/\(templateId)/lines/bulk"
        }
    }

    // MARK: - Method

    var method: HTTPMethod {
        switch self {
        case .budgets, .budgetLines, .transactions, .templates,
             .templateLines, .templateFromOnboarding, .templateLinesBulk:
            return .post

        case .validateSession, .userProfile, .budget, .budgetDetails, .budgetsExport,
             .budgetLine, .transaction, .template, .templateUsage, .templateLine:
            return .get

        case .updateProfile:
            return .patch

        case .budgetLineToggle, .budgetLineResetFromTemplate, .transactionToggle:
            return .post
        }
    }

    // MARK: - URL Request

    func urlRequest(baseURL: URL) -> URLRequest {
        let url = baseURL.appendingPathComponent(path)
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
