import Foundation

/// Represents all possible deep link destinations in the app.
enum DeepLinkDestination: Hashable, Sendable {
    /// Deep link to add an expense, optionally to a specific budget.
    case addExpense(budgetId: String?)

    /// Deep link to view a specific budget.
    case viewBudget(budgetId: String)

    /// Deep link to reset password flow.
    case resetPassword(url: URL)

    /// Resolves only the URLs owned by the app.
    static func resolve(_ url: URL) -> DeepLinkDestination? {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)

        if url.scheme?.lowercased() == "https",
           url.host?.lowercased() == "app.pulpe.app",
           components?.percentEncodedPath == "/reset-password" {
            return .resetPassword(url: url)
        }

        guard url.scheme?.lowercased() == "pulpe" else { return nil }

        switch url.host?.lowercased() {
        case "add-expense":
            let budgetId = components?.queryItems?.first { $0.name == "budgetId" }?.value
            if let budgetId, UUID(uuidString: budgetId) == nil { return nil }
            return .addExpense(budgetId: budgetId)

        case "budget":
            guard let budgetId = components?.queryItems?.first(where: { $0.name == "id" })?.value,
                  UUID(uuidString: budgetId) != nil else { return nil }
            return .viewBudget(budgetId: budgetId)

        default:
            return nil
        }
    }
}
