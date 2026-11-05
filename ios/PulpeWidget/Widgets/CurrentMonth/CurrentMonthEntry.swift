import Foundation
import WidgetKit

struct CurrentMonthEntry: TimelineEntry, Sendable {
    let date: Date
    let available: Decimal
    let monthName: String
    /// 1...12, `nil` when the entry has no month (empty, or built before the cache carried it).
    let month: Int?
    let budgetId: String?
    let hasData: Bool
    let currency: SupportedCurrency

    init(
        date: Date,
        available: Decimal,
        monthName: String,
        month: Int? = nil,
        budgetId: String?,
        hasData: Bool,
        currency: SupportedCurrency = .chf
    ) {
        self.date = date
        self.available = available
        self.monthName = monthName
        self.month = month
        self.budgetId = budgetId
        self.hasData = hasData
        self.currency = currency
    }

    /// « novembre » for a caption or a sentence, capitalized where the caption stands alone.
    var monthInText: String {
        month.map { Formatters.monthNameInText(for: $0) } ?? monthName
    }

    static var preview: CurrentMonthEntry {
        CurrentMonthEntry(
            date: Date(),
            available: 1500,
            monthName: currentMonthName,
            month: Calendar.current.component(.month, from: Date()),
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
