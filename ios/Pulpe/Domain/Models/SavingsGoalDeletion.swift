import Foundation

/// Exact preview revision returned by the backend. `updatedAt` intentionally
/// stays a String: the POST must preserve the JSON value byte-for-byte instead
/// of normalizing its ISO-8601 precision through Date encoding.
struct SavingsGoalDeletionRevisionEntry: Codable, Hashable, Sendable {
    let id: String
    let updatedAt: String
}

struct SavingsGoalDeletionRevision: Codable, Hashable, Sendable {
    let templateLines: [SavingsGoalDeletionRevisionEntry]
    let budgetLines: [SavingsGoalDeletionRevisionEntry]
    let transactions: [SavingsGoalDeletionRevisionEntry]
}

enum SavingsGoalDeletionMode: String, Codable, CaseIterable, Sendable {
    case goalOnly = "goal_only"
    case goalAndForecasts = "goal_and_forecasts"
    case goalForecastsAndTransactions = "goal_forecasts_and_transactions"
}

struct SavingsGoalDeletionCommand: Codable, Hashable, Sendable {
    let mode: SavingsGoalDeletionMode
    let revision: SavingsGoalDeletionRevision
}

struct SavingsGoalDeletionTemplateLine: Codable, Identifiable, Hashable, Sendable {
    let lineId: String
    let templateId: String
    let templateName: String
    let name: String
    let amount: Decimal
    let recurrence: TransactionRecurrence
    let updatedAt: String

    var id: String { lineId }
}

struct SavingsGoalDeletionBudgetLine: Codable, Identifiable, Hashable, Sendable {
    let lineId: String
    let name: String
    let amount: Decimal
    let recurrence: TransactionRecurrence
    let checkedAt: Date?
    let updatedAt: String
    let transactions: [Transaction]

    var id: String { lineId }
}

struct SavingsGoalDeletionBudget: Codable, Identifiable, Hashable, Sendable {
    let budgetId: String
    let month: Int
    let year: Int
    let lines: [SavingsGoalDeletionBudgetLine]

    var id: String { budgetId }
}

struct SavingsGoalDeletionSummary: Codable, Hashable, Sendable {
    let templateLineCount: Int
    let templateLineTotal: Decimal
    let budgetCount: Int
    let budgetLineCount: Int
    let budgetLineTotal: Decimal
    let transactionCount: Int
    let transactionTotal: Decimal
    /// Incomes drawn from this goal (PUL-329). They are never deleted, whatever
    /// the mode: the money already landed in a budget the user has lived through.
    let withdrawalCount: Int
    let withdrawalTotal: Decimal
}

struct SavingsGoalDeletionImpact: Codable, Hashable, Sendable {
    let goalId: String
    let summary: SavingsGoalDeletionSummary
    let templateLines: [SavingsGoalDeletionTemplateLine]
    let budgets: [SavingsGoalDeletionBudget]
    let withdrawals: [SavingsGoalWithdrawal]
    let revision: SavingsGoalDeletionRevision
}
