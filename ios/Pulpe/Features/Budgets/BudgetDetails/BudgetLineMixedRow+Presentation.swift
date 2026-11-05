import SwiftUI

// MARK: - What the row says (V2 `row`)

/// One fact under the name, the figure on the right, and a thin bar for a prévision that is
/// being consumed. Pure, so the rules read without standing a view up.
struct BudgetLineRowPresentation: Equatable {
    let subtitle: String
    /// The subtitle states an overrun: it reads in the ocre, and so does the bar.
    let isOver: Bool
    /// Share of the prévision already consumed, `nil` when nothing was spent on it yet.
    let progress: Double?
    /// max(planned, spent), in ink; an income keeps its `+`.
    let amount: String

    init(
        line: BudgetLine,
        consumption: BudgetFormulas.Consumption,
        savingsGoalName: String?,
        isPointed: Bool,
        currency: SupportedCurrency
    ) {
        let allocated = consumption.allocated
        let shown = max(line.amount, allocated).asAmount(for: currency)
        amount = line.kind == .income ? "+\(shown)" : shown

        // ponytail: a prévision "se consomme" once a movement lands on it; no field says it
        // before that, so a fixed line with nothing spent reads as its rhythm.
        if line.kind == .expense, consumption.isOverBudget {
            isOver = true
            progress = 1
            subtitle = AppLocale.string("\((allocated - line.amount).asAmount(for: currency)) au-delà du prévu")
            return
        }
        isOver = false
        if line.kind == .expense, allocated > 0, line.amount > 0 {
            progress = min(Double(truncating: (allocated / line.amount) as NSDecimalNumber), 1)
            subtitle = AppLocale.string("Reste \(consumption.available.asAmount(for: currency))")
            return
        }
        progress = nil
        let fact = Self.fact(for: line, savingsGoalName: savingsGoalName)
        subtitle = isPointed ? "\(fact) · \(AppLocale.string("pointé"))" : fact
    }

    /// The one thing worth knowing about a line nobody has spent on: where it comes from,
    /// else how often it comes back.
    static func fact(for line: BudgetLine, savingsGoalName: String?) -> String {
        if line.isSpread { return PendingWording.spread }
        if savingsGoalName != nil { return AppLocale.string("Objectif") }
        if line.isSavingsWithdrawalIncome { return AppLocale.string("Pris sur ton épargne") }
        if let source = line.savingsGoalSource { return source.label }
        return line.recurrence == .fixed ? PendingWording.everyMonth : PendingWording.once
    }
}
