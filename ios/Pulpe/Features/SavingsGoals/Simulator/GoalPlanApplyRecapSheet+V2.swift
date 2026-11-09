import SwiftUI

/// V2 additions of the recap: the banner about months created from the template, the row
/// titles and captions, and the « Ton disponible de <mois> » card.
extension GoalPlanApplyRecapSheet {
    /// « Décembre 2026 », then the month alone until the year changes (« Janvier 2027 », « Février »).
    static func rowTitle(for index: Int, in changes: [SavingsPlanCalculator.SimulatedMonth]) -> String {
        let month = changes[index].month
        let name = Formatters.monthName(for: month.month)
        guard index == 0 || changes[index - 1].month.year != month.year else { return name }
        // `String(year)`: interpolating an `Int` would apply localized grouping.
        return "\(name) \(String(month.year))"
    }

    /// « cible franchie » on the month whose cumulative crosses the target, the running total
    /// on the last row.
    static func rowCaption(
        for index: Int,
        in changes: [SavingsPlanCalculator.SimulatedMonth],
        targetAmount: Decimal?,
        currency: SupportedCurrency
    ) -> String? {
        let change = changes[index]
        if index == changes.count - 1, changes.count > 1 {
            return AppLocale.string("\(change.simulatedCumulative.asAmount(for: currency)) au total")
        }
        guard let targetAmount,
              change.simulatedCumulative >= targetAmount,
              change.simulatedCumulative - change.simulatedAmount < targetAmount else { return nil }
        return AppLocale.string("cible franchie")
    }

    var missingBudgetBanner: String? {
        let missing = changes.filter { !$0.month.hasBudget }
        guard let first = missing.first?.month, let last = missing.last?.month else { return nil }
        let amounts = Set(missing.map(\.simulatedAmount))
        let amount = amounts.count == 1 ? amounts.first?.asAmount(for: currency) : nil
        let from = Formatters.monthName(for: first.month)
        guard missing.count > 1 else {
            if let amount, let goalName {
                return AppLocale.string(
                    "\(from) n'a pas de budget. Je le crée depuis ton Mois Type, avec \(amount) pour \(goalName)."
                )
            }
            return AppLocale.string("\(from) n'a pas de budget. Je le crée depuis ton Mois Type.")
        }
        let to = Formatters.monthNameInText(for: last.month)
        if let amount, let goalName {
            return AppLocale.string("""
                \(from) à \(to) n'ont pas de budget. Je les crée depuis ton Mois Type, \
                avec \(amount) pour \(goalName).
                """)
        }
        return AppLocale.string("\(from) à \(to) n'ont pas de budget. Je les crée depuis ton Mois Type.")
    }

    @ViewBuilder
    var impactCard: some View {
        let availability = GoalMonthAvailability(
            budgets: budgetListStore?.budgets ?? [],
            templateBalance: templateBalance
        )
        if let first = changes.first,
           let before = availability.available(month: first.month.month, year: first.month.year) {
            let step = first.simulatedAmount - SavingsPlanCalculator.currentPlanMovement(first.month)
            let last = changes.count > 1 && Self.hasUniformAdjustment(changes) ? changes.last?.month : nil
            ImpactBlock(
                title: GoalMonthAvailability.title(month: first.month.month),
                impact: MovementImpact(before: before, after: before - step, lineBefore: nil, lineAfter: nil),
                currency: currency,
                tone: .neutral,
                note: last.map {
                    AppLocale.string("Même effet chaque mois jusqu'en \(Formatters.monthNameInText(for: $0.month)).")
                },
                noteHasAmount: false
            )
        }
    }
}
