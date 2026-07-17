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

    // MARK: - User Settings

    case userSettings
    case updateUserSettings

    // MARK: - Tags

    case tags

    // MARK: - Budgets

    case budgets
    case budget(id: String)
    case budgetDetails(id: String)
    case budgetsExport
    case budgetsSparse(fields: String, limit: Int?, year: Int?)

    // MARK: - Budget Lines

    case budgetLines(budgetId: String)
    case budgetLinesCreate
    case budgetLinesSpread
    case budgetLinesSavingsWithdrawal
    case budgetLinesSavingsWithdrawalDelete(groupId: String, scope: String)
    case budgetLinesSpreadOccurrences(spreadGroupId: String)
    case budgetLineSpreadFromLine(id: String)
    case budgetLine(id: String)
    case budgetLineToggle(id: String)
    case budgetLinePostpone(id: String)
    case budgetLineResetFromTemplate(id: String)

    // MARK: - Transactions

    case transactionsByBudget(budgetId: String)
    case transactionsCreate
    case transaction(id: String)
    case transactionToggle(id: String)
    case transactionPostpone(id: String)
    case transactionSpreadFromTxn(id: String)

    // MARK: - Templates

    case templates
    case template(id: String)
    case templateUsage(id: String)
    case templateFromOnboarding

    // MARK: - Template Lines

    case templateLines(templateId: String)
    case templateLine(templateId: String, lineId: String)
    case templateLinesBulk(templateId: String)

    // MARK: - Savings Goals

    case savingsGoals
    case savingsGoal(id: String)
    case savingsGoalProgress(id: String)
    case savingsGoalContributions(id: String)
    case savingsGoalPlanApply(id: String)

    // MARK: - Currency

    case currencyRate(base: SupportedCurrency, target: SupportedCurrency)

    // MARK: - What's New

    case whatsNewIos(currentVersion: String, lastSeenVersion: String)

    // MARK: - Encryption

    case encryptionVaultStatus
    case encryptionSalt
    case encryptionValidateKey
    case encryptionSetupRecovery
    case encryptionRegenerateRecovery
    case encryptionRecover
    case encryptionVerifyRecoveryKey
    case encryptionChangePin

    // MARK: - Path

    var path: String {
        switch self {
        // Auth
        case .validateSession: return "/auth/validate"

        // User
        case .userProfile: return "/users/me"
        case .updateProfile: return "/users/me"
        case .deleteAccount: return "/users/account"

        // User Settings
        case .userSettings: return "/users/settings"
        case .updateUserSettings: return "/users/settings"

        // Tags
        case .tags: return "/tags"

        // Budgets
        case .budgets: return "/budgets"
        case .budget(let id): return "/budgets/\(id)"
        case .budgetDetails(let id): return "/budgets/\(id)/details"
        case .budgetsExport: return "/budgets/export"
        case .budgetsSparse: return "/budgets"

        // Budget Lines
        case .budgetLines(let budgetId): return "/budgets/\(budgetId)/lines"
        case .budgetLinesCreate: return "/budget-lines"
        case .budgetLinesSpread: return "/budget-lines/spread"
        case .budgetLinesSavingsWithdrawal: return "/budget-lines/savings-withdrawal"
        case .budgetLinesSavingsWithdrawalDelete(let groupId, _): return "/budget-lines/savings-withdrawal/\(groupId)"
        case .budgetLinesSpreadOccurrences(let id): return "/budget-lines/spread/\(id)"
        case .budgetLineSpreadFromLine(let id): return "/budget-lines/\(id)/spread"
        case .budgetLine(let id): return "/budget-lines/\(id)"
        case .budgetLineToggle(let id): return "/budget-lines/\(id)/toggle-check"
        case .budgetLinePostpone(let id): return "/budget-lines/\(id)/postpone"
        case .budgetLineResetFromTemplate(let id): return "/budget-lines/\(id)/reset-from-template"

        // Transactions
        case .transactionsByBudget(let budgetId): return "/transactions/budget/\(budgetId)"
        case .transactionsCreate: return "/transactions"
        case .transaction(let id): return "/transactions/\(id)"
        case .transactionToggle(let id): return "/transactions/\(id)/toggle-check"
        case .transactionPostpone(let id): return "/transactions/\(id)/postpone"
        case .transactionSpreadFromTxn(let id): return "/transactions/\(id)/spread"

        // Templates
        case .templates: return "/budget-templates"
        case .template(let id): return "/budget-templates/\(id)"
        case .templateUsage(let id): return "/budget-templates/\(id)/usage"
        case .templateFromOnboarding: return "/budget-templates/from-onboarding"

        // Template Lines
        case .templateLines(let templateId): return "/budget-templates/\(templateId)/lines"
        case .templateLine(let templateId, let lineId): return "/budget-templates/\(templateId)/lines/\(lineId)"
        case .templateLinesBulk(let templateId): return "/budget-templates/\(templateId)/lines/bulk-operations"

        // Savings Goals
        case .savingsGoals: return "/savings-goals"
        case .savingsGoal(let id): return "/savings-goals/\(id)"
        case .savingsGoalProgress(let id): return "/savings-goals/\(id)/progress"
        case .savingsGoalContributions(let id): return "/savings-goals/\(id)/contributions"
        case .savingsGoalPlanApply(let id): return "/savings-goals/\(id)/plan"

        // Currency
        case .currencyRate: return "/currency/rate"

        // What's New
        case .whatsNewIos: return "/whats-new/ios"

        // Encryption
        case .encryptionVaultStatus: return "/encryption/vault-status"
        case .encryptionSalt: return "/encryption/salt"
        case .encryptionValidateKey: return "/encryption/validate-key"
        case .encryptionSetupRecovery: return "/encryption/setup-recovery"
        case .encryptionRegenerateRecovery: return "/encryption/regenerate-recovery"
        case .encryptionRecover: return "/encryption/recover"
        case .encryptionVerifyRecoveryKey: return "/encryption/verify-recovery-key"
        case .encryptionChangePin: return "/encryption/change-pin"
        }
    }

    // MARK: - Method

    var method: HTTPMethod {
        switch self {
        case .budgets, .budgetLines, .budgetLinesCreate, .budgetLinesSpread, .budgetLinesSavingsWithdrawal,
             .budgetLineSpreadFromLine, .transactionSpreadFromTxn, .transactionsCreate, .templates,
             .templateLines, .templateFromOnboarding, .templateLinesBulk,
             .budgetLineToggle, .budgetLinePostpone, .budgetLineResetFromTemplate,
             .transactionToggle, .transactionPostpone,
             .encryptionValidateKey, .encryptionSetupRecovery, .encryptionRegenerateRecovery, .encryptionRecover,
             .encryptionVerifyRecoveryKey, .encryptionChangePin,
             .savingsGoalPlanApply:
            return .post

        case .validateSession, .userProfile, .budget, .budgetDetails, .budgetsExport,
             .budgetLine, .budgetLinesSpreadOccurrences, .transaction, .template, .templateUsage, .templateLine,
             .transactionsByBudget, .budgetsSparse,
             .savingsGoals, .savingsGoal, .savingsGoalProgress, .savingsGoalContributions,
             .encryptionVaultStatus, .encryptionSalt,
             .userSettings, .tags, .currencyRate, .whatsNewIos:
            return .get

        case .updateUserSettings:
            return .put

        case .updateProfile:
            return .patch

        case .deleteAccount, .budgetLinesSavingsWithdrawalDelete:
            return .delete
        }
    }

    // MARK: - URL Request

    func urlRequest(baseURL: URL) -> URLRequest {
        var url = baseURL.appendingPathComponent(path)

        // Add query parameters
        switch self {
        case let .budgetsSparse(fields, limit, year):
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            var queryItems: [URLQueryItem] = [URLQueryItem(name: "fields", value: fields)]
            if let limit { queryItems.append(URLQueryItem(name: "limit", value: String(limit))) }
            if let year { queryItems.append(URLQueryItem(name: "year", value: String(year))) }
            components?.queryItems = queryItems
            url = components?.url ?? url
        case let .currencyRate(base, target):
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.queryItems = [
                URLQueryItem(name: "base", value: base.rawValue),
                URLQueryItem(name: "target", value: target.rawValue),
            ]
            url = components?.url ?? url
        case let .budgetLinesSavingsWithdrawalDelete(_, scope):
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "scope", value: scope)]
            url = components?.url ?? url
        case let .whatsNewIos(currentVersion, lastSeenVersion):
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.queryItems = [
                URLQueryItem(name: "currentVersion", value: currentVersion),
                URLQueryItem(name: "lastSeenVersion", value: lastSeenVersion),
            ]
            url = components?.url ?? url
        default:
            break
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
