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
}
