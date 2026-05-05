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
    /// User's active currency. Defaults to `.chf` when an older cache (pre-multi-currency)
    /// is decoded — prevents a force-upgrade flash for existing users.
    let currency: SupportedCurrency

    init(
        currentMonth: BudgetWidgetData?,
        yearBudgets: [BudgetWidgetData],
        lastUpdated: Date,
        currency: SupportedCurrency = .chf
    ) {
        self.currentMonth = currentMonth
        self.yearBudgets = yearBudgets
        self.lastUpdated = lastUpdated
        self.currency = currency
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.currentMonth = try container.decodeIfPresent(BudgetWidgetData.self, forKey: .currentMonth)
        self.yearBudgets = try container.decode([BudgetWidgetData].self, forKey: .yearBudgets)
        self.lastUpdated = try container.decode(Date.self, forKey: .lastUpdated)
        // Older caches (v1) pre-date multi-currency; default to CHF instead of failing decode.
        self.currency = try container.decodeIfPresent(SupportedCurrency.self, forKey: .currency) ?? .chf
    }

    static var empty: WidgetDataCache {
        WidgetDataCache(currentMonth: nil, yearBudgets: [], lastUpdated: Date())
    }

    var isStale: Bool {
        Date().timeIntervalSince(lastUpdated) > 3600
    }
}
