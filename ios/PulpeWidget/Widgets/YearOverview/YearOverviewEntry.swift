import Foundation
import WidgetKit

struct MonthData: Identifiable, Sendable {
    let id: String
    let month: Int
    let shortName: String
    let available: Decimal?
    let isCurrentMonth: Bool
}

struct YearOverviewEntry: TimelineEntry, Sendable {
    let date: Date
    let year: Int
    let months: [MonthData]
    let hasData: Bool

    static var placeholder: YearOverviewEntry {
        let currentYear = Calendar.current.component(.year, from: Date())
        let currentMonth = Calendar.current.component(.month, from: Date())

        let months = (1...12).map { month in
            MonthData(
                id: "placeholder-\(month)",
                month: month,
                shortName: shortMonthName(for: month),
                available: Decimal(Int.random(in: 500...3000)),
                isCurrentMonth: month == currentMonth
            )
        }

        return YearOverviewEntry(
            date: Date(),
            year: currentYear,
            months: months,
            hasData: true
        )
    }

    static var empty: YearOverviewEntry {
        let currentYear = Calendar.current.component(.year, from: Date())

        let months = (1...12).map { month in
            MonthData(
                id: "empty-\(month)",
                month: month,
                shortName: shortMonthName(for: month),
                available: nil,
                isCurrentMonth: false
            )
        }

        return YearOverviewEntry(
            date: Date(),
            year: currentYear,
            months: months,
            hasData: false
        )
    }

    private static func shortMonthName(for month: Int) -> String {
        var components = DateComponents()
        components.month = month
        components.year = Calendar.current.component(.year, from: Date())
        components.day = 1

        if let date = Calendar.current.date(from: components) {
            return Formatters.shortMonth.string(from: date).capitalized
        }
        return "\(month)"
    }
}
