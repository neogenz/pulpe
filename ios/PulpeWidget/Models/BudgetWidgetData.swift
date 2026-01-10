import Foundation

struct BudgetWidgetData: Codable, Sendable, Identifiable {
    let id: String
    let month: Int
    let year: Int
    let available: Decimal
    let monthName: String
    let isCurrentMonth: Bool

    var shortMonthName: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "MMM"

        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1

        if let date = Calendar.current.date(from: components) {
            return formatter.string(from: date).capitalized
        }
        return "\(month)"
    }
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
