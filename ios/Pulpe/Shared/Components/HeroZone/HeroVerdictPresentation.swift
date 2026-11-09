import SwiftUI

/// Verdict of a period against its plan, shared by every `HeroZone` consumer that compares
/// an estimate to a plan. Pure presentation: formulas stay in `BudgetFormulas`.
struct HeroVerdictPresentation: Equatable {
    enum Verdict: Equatable {
        case gain
        case overrun
        case onPlan
    }

    enum Tone: Equatable {
        case favorable
        case caution
        case deficit
    }

    let plannedBalance: Decimal
    let estimatedBalance: Decimal
    let variance: Decimal
    let verdict: Verdict
    let tone: Tone

    /// The day the month left its plan, straight from the plot below. `nil` when it never
    /// did — and also when there is no plot to date it from, where the sentence simply
    /// drops the date rather than inventing one.
    let driftDate: Date?

    init(
        plannedBalance: Decimal,
        estimatedBalance: Decimal,
        driftDate: Date? = nil
    ) {
        self.plannedBalance = plannedBalance.rounded(2)
        self.estimatedBalance = estimatedBalance.rounded(2)
        self.driftDate = driftDate

        let difference = (self.estimatedBalance - self.plannedBalance).rounded(2)
        variance = difference
        verdict = difference > 0 ? .gain : difference < 0 ? .overrun : .onPlan
        tone = self.estimatedBalance < 0 ? .deficit : difference < 0 ? .caution : .favorable
    }

    /// From the period's metrics: the estimate is what remains, the plan is the caller's.
    init(metrics: BudgetFormulas.Metrics, plannedBalance: Decimal, driftDate: Date? = nil) {
        self.init(plannedBalance: plannedBalance, estimatedBalance: metrics.remaining, driftDate: driftDate)
    }

    /// The same accent on a light card (the Accueil's white hero): green when ahead of the
    /// plan, ocre behind it, coral once the month is in deficit, plain ink exactly on plan.
    var lightAccent: Color {
        guard verdict != .onPlan else { return .textPrimary }
        return switch tone {
        case .favorable: .pulpePrimary
        case .caution: .financialOverBudget
        case .deficit: .coral
        }
    }

    /// The one thing on the card the plot cannot draw and the metrics cannot show: *when*
    /// the month left its plan. The size of the gap is in `Imprévus`, its shape is in the
    /// line, so repeating either here would spend the sentence on something already said.
    var verdictText: String {
        switch verdict {
        case .onPlan:
            AppLocale.string("Tu es pile sur ton plan.")
        case .overrun:
            if let day = driftDay {
                AppLocale.string("Tu dépenses plus que prévu depuis le \(day).")
            } else {
                AppLocale.string("Il te reste moins que prévu.")
            }
        case .gain:
            if let day = driftDay {
                AppLocale.string("Tu dépenses moins que prévu depuis le \(day).")
            } else {
                AppLocale.string("Il te reste plus que prévu.")
            }
        }
    }

    /// The drift day, already formatted. Whole sentences carry it rather than a
    /// "\(lead) depuis le …" template: only French puts the clause in that order.
    private var driftDay: String? {
        driftDate.map { Formatters.dayMonthLabel(for: $0) }
    }
}
