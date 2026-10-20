import Foundation

/// What deleting a future month takes with it (`GET /budgets/:id/deletion-impact`).
/// `links` counts the month's forecasts and movements that are tied to other months
/// or to a savings goal; each forecast is counted in one category only.
struct BudgetDeletionImpact: Decodable, Equatable, Sendable {
    let forecastCount: Int
    let movementCount: Int
    let links: Links

    struct Links: Decodable, Equatable, Sendable {
        let spreadForecasts: Int
        let savingsGoalForecasts: Int
        let savingsWithdrawalForecasts: Int
        let savingsWithdrawalMovements: Int
    }

    /// The server refuses a linked month unless the delete carries `confirmLinks=true`.
    var hasLinks: Bool {
        links.spreadForecasts > 0
            || links.savingsGoalForecasts > 0
            || links.savingsWithdrawalForecasts > 0
            || links.savingsWithdrawalMovements > 0
    }
}
