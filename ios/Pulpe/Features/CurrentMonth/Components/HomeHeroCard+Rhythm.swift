import SwiftUI

extension HomeHeroCard {
    /// Where the month lands if it keeps its pace, against what the plan kept: the sentence
    /// that follows the verdict. `nil` when there is nothing to project (the period's last
    /// day) or the pace lands exactly on the plan. Under the privacy mode it keeps the
    /// direction and drops both figures.
    static func rhythmSentence(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        currency: SupportedCurrency,
        amountsHidden: Bool
    ) -> String? {
        guard !projection(for: trajectory).isEmpty, let end = trajectory.periodEnd else { return nil }
        let landing = trend(for: trajectory).rounded(2)
        let planned = trajectory.plannedBalance.rounded(2)
        guard landing != planned else { return nil }
        let day = Formatters.dayMonthLabel(for: end)
        if amountsHidden {
            return landing < planned
                ? AppLocale.string("Le \(day), il te restera moins que prévu.")
                : AppLocale.string("Le \(day), il te restera plus que prévu.")
        }
        let landed = landing.asCompactCurrency(currency)
        let expected = planned.asCompactCurrency(currency)
        return AppLocale.string("À ce rythme, il te restera \(landed) le \(day) au lieu des \(expected) prévus.")
    }
}
