import Foundation
import WidgetKit

struct CurrentMonthEntry: TimelineEntry, Sendable {
    let date: Date
    let available: Decimal
    let monthName: String
    let budgetId: String?
    let hasData: Bool

    static var placeholder: CurrentMonthEntry {
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
