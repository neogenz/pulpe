import Foundation

/// Budget period calculation - Port of shared/src/calculators/budget-period.ts
///
/// Determines which budget month a date belongs to, accounting for a custom pay day
/// and the "quinzaine" rule:
/// - payDay <= 15 (1ere quinzaine): budget named after the START month
/// - payDay > 15 (2eme quinzaine): budget named after the END month
enum BudgetPeriodCalculator {
    static let payDayMin = 1
    static let payDayMax = 31

    // MARK: - Period for Date

    static func periodForDate(_ date: Date, payDayOfMonth: Int? = nil) -> BudgetPeriod {
        let calendar = Calendar.current
        let calendarMonth = calendar.component(.month, from: date)
        let calendarYear = calendar.component(.year, from: date)
        let dayOfMonth = calendar.component(.day, from: date)

        guard let payDay = payDayOfMonth, payDay != 0, payDay != 1 else {
            return BudgetPeriod(month: calendarMonth, year: calendarYear)
        }

        let validPayDay = clampPayDay(payDay)

        var resultMonth: Int
        var resultYear: Int

        if dayOfMonth >= validPayDay {
            resultMonth = calendarMonth
            resultYear = calendarYear
        } else {
            if calendarMonth == 1 {
                resultMonth = 12
                resultYear = calendarYear - 1
            } else {
                resultMonth = calendarMonth - 1
                resultYear = calendarYear
            }
        }

        // Quinzaine rule: payDay > 15 means budget is named after the END month
        if validPayDay > 15 {
            if resultMonth == 12 {
                resultMonth = 1
                resultYear += 1
            } else {
                resultMonth += 1
            }
        }

        return BudgetPeriod(month: resultMonth, year: resultYear)
    }

    // MARK: - Period Dates

    static func periodDates(month: Int, year: Int, payDayOfMonth: Int? = nil) -> BudgetPeriodDates {
        let payDay: Int
        if let raw = payDayOfMonth, raw > 1 {
            payDay = clampPayDay(raw)
        } else {
            payDay = 1
        }

        let calendar = Calendar.current
        let startMonth: Int
        let startYear: Int

        if payDay <= 15 {
            startMonth = month
            startYear = year
        } else if month == 1 {
            startMonth = 12
            startYear = year - 1
        } else {
            startMonth = month - 1
            startYear = year
        }

        let lastDayOfStartMonth = lastDay(of: startMonth, year: startYear, calendar: calendar)
        let actualStartDay = min(payDay, lastDayOfStartMonth)

        guard let startDate = calendar.date(
            from: DateComponents(year: startYear, month: startMonth, day: actualStartDay)
        ) else {
            let msg = "BudgetPeriodCalculator: invalid date component"
            assertionFailure(msg)
            return BudgetPeriodDates(startDate: Date(), endDate: Date())
        }

        let endDate: Date
        if payDay == 1 {
            let dayCount = lastDay(of: month, year: year, calendar: calendar)
            endDate = calendar.date(from: DateComponents(year: year, month: month, day: dayCount)) ?? startDate
        } else {
            let endMonth = startMonth == 12 ? 1 : startMonth + 1
            let endYear = startMonth == 12 ? startYear + 1 : startYear
            let lastDayOfEndMonth = lastDay(of: endMonth, year: endYear, calendar: calendar)
            let actualEndDay = min(payDay - 1, lastDayOfEndMonth)
            if actualEndDay <= 0 {
                endDate = calendar.date(
                    from: DateComponents(year: startYear, month: startMonth, day: lastDayOfStartMonth)
                ) ?? startDate
            } else {
                endDate = calendar.date(
                    from: DateComponents(year: endYear, month: endMonth, day: actualEndDay)
                ) ?? startDate
            }
        }

        return BudgetPeriodDates(startDate: startDate, endDate: endDate)
    }

    // MARK: - Format Period

    private static let periodFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_CH")
        formatter.dateFormat = "d MMM"
        return formatter
    }()

    static func formatPeriod(month: Int, year: Int, payDayOfMonth: Int? = nil) -> String? {
        guard let payDay = payDayOfMonth, payDay != 0, payDay != 1 else {
            return nil
        }

        let dates = periodDates(month: month, year: year, payDayOfMonth: payDay)

        let startStr = periodFormatter.string(from: dates.startDate)
        let endStr = periodFormatter.string(from: dates.endDate)

        return "\(startStr) - \(endStr)"
    }

    // MARK: - Compare Periods

    static func comparePeriods(_ lhs: BudgetPeriod, _ rhs: BudgetPeriod) -> Int {
        if lhs.year != rhs.year {
            return lhs.year < rhs.year ? -1 : 1
        }
        if lhs.month != rhs.month {
            return lhs.month < rhs.month ? -1 : 1
        }
        return 0
    }

    // MARK: - Private Helpers

    private static func clampPayDay(_ payDay: Int) -> Int {
        max(payDayMin, min(payDayMax, payDay))
    }

    private static func lastDay(of month: Int, year: Int, calendar: Calendar) -> Int {
        let components = DateComponents(year: year, month: month)
        guard let date = calendar.date(from: components),
              let range = calendar.range(of: .day, in: .month, for: date) else {
            return 30
        }
        return range.count
    }
}
