import SwiftUI

// MARK: - Title menu month navigation

/// Month-jump helpers for the navigation title menu, split out to keep the main
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
