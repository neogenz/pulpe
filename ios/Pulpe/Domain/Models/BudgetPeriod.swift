import Foundation

/// Represents a budget period identified by month and year
struct BudgetPeriod: Equatable, Sendable {
    /// Month number (1-12)
    let month: Int
    /// Calendar year
    let year: Int
}

/// Date range for a budget period
struct BudgetPeriodDates: Equatable, Sendable {
    let startDate: Date
    let endDate: Date
}
