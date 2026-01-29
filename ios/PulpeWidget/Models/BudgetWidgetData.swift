import Foundation

// MARK: - Deep Link URLs

enum DeepLinks {
    static let addExpense: URL = {
        guard let url = URL(string: "pulpe://add-expense") else {
            fatalError("Invalid hardcoded URL: pulpe://add-expense")
        }
        return url
    }()

    static func budget(id: String) -> URL {
        var components = URLComponents()
        components.scheme = "pulpe"
        components.host = "budget"
        components.queryItems = [URLQueryItem(name: "id", value: id)]
        guard let url = components.url else {
            assertionFailure("DeepLinks: failed to encode budget id: \(id)")
            return addExpense // Safe fallback — opens app without broken navigation
        }
        return url
    }
}

// MARK: - Widget Data Models

struct BudgetWidgetData: Codable, Sendable, Identifiable {
    let id: String
    let month: Int
    let year: Int
    let available: Decimal?
    let monthName: String
    let shortMonthName: String
    let isCurrentMonth: Bool
}

struct WidgetDataCache: Codable, Sendable {
    let currentMonth: BudgetWidgetData?
    let yearBudgets: [BudgetWidgetData]
    let lastUpdated: Date

    static var empty: WidgetDataCache {
        WidgetDataCache(currentMonth: nil, yearBudgets: [], lastUpdated: Date())
    }

    var isStale: Bool {
        Date().timeIntervalSince(lastUpdated) > 3600
    }
}
