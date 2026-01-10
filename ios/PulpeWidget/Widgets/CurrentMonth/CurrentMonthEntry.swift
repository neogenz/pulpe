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
            monthName: "Janvier 2025",
            budgetId: nil,
            hasData: true
        )
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
