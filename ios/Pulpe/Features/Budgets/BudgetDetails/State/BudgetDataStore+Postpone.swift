import Foundation

/// Postpone (PUL-22) eligibility derivations for `BudgetDataStore`. Split into
/// a dedicated extension so the core store file stays under the feature's
/// 350-LOC ceiling (same precedent as `BudgetDetailsCoordinator+Postpone.swift`).
/// Read-only — these never mutate state; they gate the "reporter au mois
/// suivant" action and feed its confirmation / toast copy.
extension BudgetDataStore {
    /// Calendar month/year immediately after the current budget (Dec → Jan,
    /// year + 1). `nil` until the current budget loads. Distinct from
    /// `nextBudgetId`, which is list-adjacent (next existing month in the
    /// sorted list) and can skip a gap — postpone (PUL-22) targets the literal
    /// next calendar month, so eligibility must check that specific month.
    var nextCalendarMonth: (month: Int, year: Int)? {
        guard let budget else { return nil }
        return budget.month == 12
            ? (month: 1, year: budget.year + 1)
            : (month: budget.month + 1, year: budget.year)
    }

    /// True when a budget for the next CALENDAR month already exists. Gates the
    /// postpone action (PUL-22, CA5): the server has nowhere to move the line if
    /// next month hasn't been created yet.
    var hasNextMonthBudget: Bool {
        guard let next = nextCalendarMonth else { return false }
        return allBudgets.contains { $0.month == next.month && $0.year == next.year }
    }

    /// Localized month name of the next calendar month (e.g. "juillet"), used in
    /// the postpone confirmation / toast / disabled-state copy. `nil` until the
    /// current budget loads.
    var nextMonthLabel: String? {
        guard let next = nextCalendarMonth else { return nil }
        return Formatters.monthName(for: next.month).lowercased()
    }
}
