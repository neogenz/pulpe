import Foundation

// MARK: - Deep Link URLs

enum DeepLinks {
    static let addExpense = URL(string: "pulpe://add-expense")!

    static func budget(id: String) -> URL {
        URL(string: "pulpe://budget?id=\(id)")!
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
