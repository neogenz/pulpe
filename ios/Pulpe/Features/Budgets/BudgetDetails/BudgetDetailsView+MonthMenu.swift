import SwiftUI

// MARK: - Title menu month navigation

/// Month-jump helpers for the month menu, split out to keep the main
/// view file under the feature's 350-LOC budget (same precedent as `+Routing`).
extension BudgetDetailsView {
    /// Same routing as the sticky pager's `onSelect` — one navigation semantic,
    /// two affordances.
    var monthSelection: Binding<String> {
        Binding(
            get: { coordinator.dataStore.budgetId },
            set: { id in
                guard id != coordinator.dataStore.budgetId else { return }
                Task { await coordinator.dispatch(.prepareNavigation(to: id)) }
            }
        )
    }

    /// Always the disambiguated "Mai 2025" form: a vertical menu has no space
    /// pressure, and mixed short/long labels would read as inconsistency.
    static func monthMenuLabel(for sparse: BudgetSparse) -> String {
        guard let month = sparse.month, let year = sparse.year else { return "—" }
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1
        guard let date = Calendar.current.date(from: components) else { return "—" }
        return Formatters.monthYear.string(from: date).capitalized
    }
}

// MARK: - Page header

extension BudgetDetailsView {
    /// "Novembre": the month alone, the year sits in the back button.
    var pageTitle: String {
        projector.screenState.hero.month.map { Formatters.monthName(for: $0) } ?? ""
    }

    var periodSubtitle: String? {
        guard let month = projector.screenState.hero.month, let year = projector.screenState.hero.year else {
            return nil
        }
        return Self.periodSubtitle(month: month, year: year, payDayOfMonth: userSettingsStore.payDayOfMonth)
    }

    /// "25 oct. au 24 nov. · jour 10 sur 31". The day count only while the period is running.
    static func periodSubtitle(month: Int, year: Int, payDayOfMonth: Int?, now: Date = .now) -> String {
        let dates = BudgetPeriodCalculator.periodDates(month: month, year: year, payDayOfMonth: payDayOfMonth)
        let formatter = Formatters.dateFormatter("dMMM")
        let range = AppLocale.string(
            "\(formatter.string(from: dates.startDate)) au \(formatter.string(from: dates.endDate))"
        )
        if let days = daysUntilStart(month: month, year: year, payDayOfMonth: payDayOfMonth, now: now) {
            return AppLocale.string("\(range) · commence dans \(days) jours")
        }
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: dates.startDate)
        let end = calendar.startOfDay(for: dates.endDate)
        let today = calendar.startOfDay(for: now)
        guard today >= start, today <= end,
              let day = calendar.dateComponents([.day], from: start, to: today).day,
              let span = calendar.dateComponents([.day], from: start, to: end).day
        else { return range }
        return AppLocale.string("\(range) · jour \(day + 1) sur \(span + 1)")
    }

    /// Days left before the period starts; `nil` once it has started.
    static func daysUntilStart(month: Int, year: Int, payDayOfMonth: Int?, now: Date = .now) -> Int? {
        let start = BudgetPeriodCalculator.periodDates(month: month, year: year, payDayOfMonth: payDayOfMonth).startDate
        let calendar = Calendar.current
        guard let days = calendar.dateComponents(
            [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: start)
        ).day, days > 0 else { return nil }
        return days
    }

    /// The month before this one when this one has not started: the page reads as a projection.
    var upcomingReportMonth: Int? {
        guard let month = projector.screenState.hero.month, let year = projector.screenState.hero.year,
              Self.daysUntilStart(month: month, year: year, payDayOfMonth: userSettingsStore.payDayOfMonth) != nil
        else { return nil }
        return month == 1 ? 12 : month - 1
    }

    /// « Estimé, novembre en cours » under the report row of a month that has not started.
    /// Two months ahead, the previous month has not started either: « Estimé » alone.
    var upcomingReportSubtitle: String? {
        guard let previous = upcomingReportMonth, let month = projector.screenState.hero.month,
              let year = projector.screenState.hero.year
        else { return nil }
        let previousYear = month == 1 ? year - 1 : year
        let previousStarted = Self.daysUntilStart(
            month: previous, year: previousYear, payDayOfMonth: userSettingsStore.payDayOfMonth
        ) == nil
        guard previousStarted else { return AppLocale.string("Estimé") }
        return AppLocale.string("Estimé, \(Formatters.monthNameInText(for: previous)) en cours")
    }
}
