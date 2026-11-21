import Foundation

/// What « Comparer avec mes comptes » reads from the server for one budget
/// (`GET /reconciliation/:budgetId`, `reconciliationContextSchema`): the person's starting amount,
/// whether they ever finished a comparison, and the unchecked items of the two previous months.
struct ReconciliationContext: Codable, Equatable, Sendable {
    let startingAmount: Decimal
    let hasCompletedComparison: Bool
    /// Added to the checked balance: what the rollover counted as spent but nobody checked.
    let priorCorrection: Decimal
    let priorItems: [PriorItem]

    /// An unchecked item of one of the two previous budgets.
    struct PriorItem: Codable, Equatable, Sendable, Identifiable {
        enum Source: String, Codable, Sendable {
            case transaction
            case budgetLine
        }

        let id: String
        let source: Source
        let budgetId: String
        let name: String
        let amount: Decimal
        let kind: TransactionKind
        /// 1 or 2.
        let monthsAgo: Int
        /// What checking it moves in the compared figure, measured by the server.
        let effect: Decimal
    }
}

/// `PUT /reconciliation/state`: a field left `nil` is omitted and stays unchanged.
struct ReconciliationStateUpdate: Encodable, Sendable {
    var startingAmount: Decimal?
    var completed: Bool?
}
