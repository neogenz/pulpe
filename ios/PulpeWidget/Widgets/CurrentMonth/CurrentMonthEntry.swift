import Foundation
import WidgetKit

struct CurrentMonthEntry: TimelineEntry, Sendable {
    let date: Date
    let available: Decimal
    let monthName: String
    let budgetId: String?
    let hasData: Bool
    let currency: SupportedCurrency

    init(
        date: Date,
        available: Decimal,
        monthName: String,
        budgetId: String?,
        hasData: Bool,
        currency: SupportedCurrency = .chf
    ) {
        self.date = date
        self.available = available
        self.monthName = monthName
        self.budgetId = budgetId
        self.hasData = hasData
        self.currency = currency
    }

    static var preview: CurrentMonthEntry {
        CurrentMonthEntry(
            date: Date(),
            available: 1500,
            monthName: currentMonthName,
            budgetId: nil,
            hasData: true
        )
    }

    private static var currentMonthName: String {
        Formatters.monthYear.string(from: Date()).capitalized
    }

    static var empty: CurrentMonthEntry {
        CurrentMonthEntry(
            date: Date(),
            available: 0,
            monthName: "",
            budgetId: nil,
            hasData: false
        )
    }
}
