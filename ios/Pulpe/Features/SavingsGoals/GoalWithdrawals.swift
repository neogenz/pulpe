import SwiftUI

/// Namespace of the goal's withdrawals as the detail and the history list them
/// (PUL-329). A withdrawal is a decision, never an anomaly (RG-002): the amount keeps
/// its minus sign but the ordinary text colour.
enum GoalWithdrawals {
    enum PlannedItem: Identifiable {
        case linked(SavingsGoalPlannedWithdrawal)
        case planOnly(SavingsGoalPlanOnlyWithdrawal)

        var id: String {
            switch self {
            case .linked(let withdrawal): "linked-\(withdrawal.id)"
            case .planOnly(let withdrawal): "plan-only-\(withdrawal.id)"
            }
        }

        var name: String {
            switch self {
            case .linked(let withdrawal): withdrawal.name
            case .planOnly(let withdrawal): withdrawal.name
            }
        }

        var month: Int {
            switch self {
            case .linked(let withdrawal): withdrawal.month
            case .planOnly(let withdrawal): withdrawal.month
            }
        }

        var year: Int {
            switch self {
            case .linked(let withdrawal): withdrawal.year
            case .planOnly(let withdrawal): withdrawal.year
            }
        }

        var plannedAmount: Decimal {
            switch self {
            case .linked(let withdrawal): withdrawal.plannedAmount
            case .planOnly(let withdrawal): withdrawal.plannedAmount
            }
        }

        var realizedAmount: Decimal {
            switch self {
            case .linked(let withdrawal): withdrawal.realizedAmount
            case .planOnly: 0
            }
        }

        var primaryAmount: Decimal {
            switch self {
            case .linked(let withdrawal):
                switch withdrawal.status {
                case .partiallyRealized: withdrawal.remainingAmount
                case .planned, .realized: withdrawal.plannedAmount
                }
            case .planOnly(let withdrawal): withdrawal.plannedAmount
            }
        }

        /// Un retrait entamé est le seul qui ait deux montants à raconter. Tant
        /// que rien n'est sorti, « Prévu … · Réalisé 0 » répète le montant de la
        /// rangée et lui ajoute un zéro.
        var isPartiallyRealized: Bool {
            guard case .linked(let withdrawal) = self,
                  case .partiallyRealized = withdrawal.status else { return false }
            return true
        }

        var primaryAmountDetail: String? {
            isPartiallyRealized ? AppLocale.string("restant") : nil
        }

        var remainingAmount: Decimal {
            switch self {
            case .linked(let withdrawal): withdrawal.remainingAmount
            case .planOnly(let withdrawal): withdrawal.plannedAmount
            }
        }

        var budgetId: String? {
            guard case .linked(let withdrawal) = self else { return nil }
            return withdrawal.budgetId
        }

        var isPlanOnly: Bool {
            if case .planOnly = self { return true }
            return false
        }

        var statusLabel: String {
            guard case .linked(let withdrawal) = self else { return AppLocale.string("À réaliser") }
            return switch withdrawal.status {
            case .planned: AppLocale.string("À réaliser")
            case .partiallyRealized: AppLocale.string("Partiellement réalisé")
            case .realized: AppLocale.string("Réalisé")
            }
        }

        /// `String(year)`: interpolating an `Int` would apply localized grouping
        /// ("2'026" in de-CH) — never on a year.
        var periodLabel: String {
            "\(Formatters.monthName(for: month)) " + String(year)
        }

        func contextLabel(currency: SupportedCurrency) -> String {
            AppLocale.string("Prévu \(plannedAmount.asCurrency(currency))")
                + " · " + AppLocale.string("Réalisé \(realizedAmount.asCurrency(currency))")
        }

        /// Comma-joined independent segments, each its own key: the destination
        /// segment only exists off-budget, and no language has to reorder them.
        func accessibilityLabel(currency: SupportedCurrency) -> String {
            var parts = ["\(name), \(periodLabel), \(statusLabel)"]
            if isPlanOnly { parts.append(AppLocale.string("hors budget")) }
            parts.append(AppLocale.string("prévu \(plannedAmount.asCurrency(currency))"))
            parts.append(AppLocale.string("réalisé \(realizedAmount.asCurrency(currency))"))
            parts.append(AppLocale.string("reste \(remainingAmount.asCurrency(currency))"))
            return parts.joined(separator: ", ")
        }

        var accessibilityHint: String? { budgetId == nil ? nil : AppLocale.string("Ouvre le budget") }
    }

    nonisolated static func plannedItems(
        planned: [SavingsGoalPlannedWithdrawal],
        planOnly: [SavingsGoalPlanOnlyWithdrawal]
    ) -> [PlannedItem] {
        (planned.map(PlannedItem.linked) + planOnly.map(PlannedItem.planOnly))
            .sorted { lhs, rhs in
                if lhs.year != rhs.year { return lhs.year < rhs.year }
                if lhs.month != rhs.month { return lhs.month < rhs.month }
                return lhs.id < rhs.id
            }
    }
}
