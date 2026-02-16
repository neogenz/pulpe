import Foundation

extension Date {
    /// Current month number (1-12)
    var month: Int {
        Calendar.current.component(.month, from: self)
    }

    /// Current year
    var year: Int {
        Calendar.current.component(.year, from: self)
    }

    /// Start of the current month
    var startOfMonth: Date {
        Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: self)) ?? self
    }

    /// End of the current month
    var endOfMonth: Date {
        Calendar.current.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth) ?? self
    }

    /// Format as "Janvier 2024"
    var monthYearFormatted: String {
        Formatters.monthYear.string(from: self).capitalized
    }

    /// Format as "Jan 2024"
    var shortMonthYearFormatted: String {
        Formatters.shortMonthYear.string(from: self).capitalized
    }

    /// Format as "15 janvier"
    var dayMonthFormatted: String {
        Formatters.dayMonth.string(from: self)
    }

    /// Create a date from month and year
    static func from(month: Int, year: Int) -> Date? {
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1
        return Calendar.current.date(from: components)
    }

    /// Check if this date is in the current month
    var isCurrentMonth: Bool {
        let now = Date()
        return month == now.month && year == now.year
    }

    /// Check if this date is in the past (before current month)
    var isPastMonth: Bool {
        let now = Date()
        if year < now.year { return true }
        if year == now.year && month < now.month { return true }
        return false
    }

    /// Check if this date is in the future (after current month)
    var isFutureMonth: Bool {
        let now = Date()
        if year > now.year { return true }
        if year == now.year && month > now.month { return true }
        return false
    }

    // MARK: - Static Month/Year Comparisons

    /// Check if a given month/year is in the past relative to now
    static func isPast(month: Int, year: Int) -> Bool {
        let now = Date()
        if year < now.year { return true }
        if year == now.year && month < now.month { return true }
        return false
    }

    /// Check if a given month/year is the current month
    static func isCurrent(month: Int, year: Int) -> Bool {
        let now = Date()
        return year == now.year && month == now.month
    }

    /// Format as relative date (Aujourd'hui, Hier, Lundi, etc.)
    var relativeFormatted: String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(self) {
            return "Aujourd'hui"
        }
        if calendar.isDateInYesterday(self) {
            return "Hier"
        }

        // Check if within this week (show day name)
        guard let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now)) else {
            return dayMonthFormatted
        }
        if self >= startOfWeek {
            return Formatters.weekday.string(from: self).capitalized
        }

        // Otherwise show day month
        return dayMonthFormatted
    }
}

// MARK: - Month/Year Helpers

struct MonthYear: Hashable, Comparable {
    let month: Int
    let year: Int

    init(month: Int, year: Int) {
        self.month = month
        self.year = year
    }

    init(from date: Date = Date()) {
        self.month = date.month
        self.year = date.year
    }

    var date: Date? {
        Date.from(month: month, year: year)
    }

    var formatted: String {
        date?.monthYearFormatted ?? String(format: "%02d.%d", month, year)
    }

    var shortFormatted: String {
        date?.shortMonthYearFormatted ?? String(format: "%02d.%d", month, year)
    }

    static func < (lhs: MonthYear, rhs: MonthYear) -> Bool {
        if lhs.year != rhs.year {
            return lhs.year < rhs.year
        }
        return lhs.month < rhs.month
    }

    func adding(months: Int) -> MonthYear {
        let calendar = Calendar.current
        guard let date = self.date,
              let newDate = calendar.date(byAdding: .month, value: months, to: date) else {
            return self
        }
        return MonthYear(month: newDate.month, year: newDate.year)
    }
}
