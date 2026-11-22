import Foundation

/// What « Comparer avec mes comptes » reads from the server for one budget
/// (`GET /reconciliation/:budgetId`, `reconciliationContextSchema`): the person's starting amount and
/// whether they ever finished a comparison. The server still sends `priorCorrection` and `priorItems`
/// for older builds; the decoder ignores them.
struct ReconciliationContext: Codable, Equatable, Sendable {
    let startingAmount: Decimal
    let hasCompletedComparison: Bool
}

/// What `PUT /reconciliation/state` answers (`reconciliationStateSchema`).
struct ReconciliationState: Decodable, Equatable, Sendable {
    let startingAmount: Decimal
    let hasCompletedComparison: Bool
}

/// `PUT /reconciliation/state`: a field left `nil` is omitted and stays unchanged.
struct ReconciliationStateUpdate: Encodable, Equatable, Sendable {
    var startingAmount: Decimal?
    var completed: Bool?
}
