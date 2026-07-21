import Foundation

/// A goal-linked saving prévision on a current-or-future month (PUL-285 CA5) —
/// advisory candidate to freeze or remove when the goal stops generating.
/// Decoded from `GET /savings-goals/:id/future-lines`. Foundation-only:
/// `Domain/Models` is globbed into the widget target.
struct SavingsGoalFutureLine: Codable, Identifiable, Hashable, Sendable {
    let budgetLineId: String
    let amount: Decimal
    let month: Int
    let year: Int

    var id: String { budgetLineId }
}

/// Explicit advisory decision (PUL-285 CA8):
/// - `freeze` keeps the prévision, unlinked from the goal and shielded from
///   RG-001 (`is_manually_adjusted` server-side);
/// - `remove` deletes it from the future months (transactions become free).
enum SavingsGoalGenerationStopMode: String, Codable, Sendable {
    case freeze
    case remove
}

struct SavingsGoalGenerationStop: Encodable {
    let mode: SavingsGoalGenerationStopMode
    let budgetLineIds: [String]
}

struct SavingsGoalGenerationStopResult: Decodable, Sendable {
    let affectedCount: Int
}
