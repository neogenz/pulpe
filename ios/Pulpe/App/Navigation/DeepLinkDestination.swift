import Foundation

/// Represents all possible deep link destinations in the app.
enum DeepLinkDestination: Hashable, Sendable {
    /// Deep link to add an expense, optionally to a specific budget.
    case addExpense(budgetId: String?)

    /// Deep link to view a specific budget.
    case viewBudget(budgetId: String)

    /// Deep link to reset password flow.
    case resetPassword(url: URL)
}
