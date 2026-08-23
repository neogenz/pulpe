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

    /// The accent the hero may spend on its link or chart — never on its surface. A month
    /// exactly on plan takes the plain ink: green is how the hero says "better than planned".
    var accent: Color {
        guard verdict != .onPlan else { return .heroInk }
        return switch tone {
        case .favorable: .heroAccentPositive
        case .caution: .heroAccentCaution
        case .deficit: .heroAccentDeficit
        }
    }

    /// Whether an envelope that ran past its plan was paid for elsewhere in the month.
    /// A month that lands exactly on plan absorbed it just as surely as one that landed
    /// above: only a month behind its own plan leaves the excess uncovered. Lives here
    /// rather than in the view so the card that says "compensé ailleurs" and the hero
    /// that says "pile sur ton plan" can never claim opposite things.
    var absorbsEnvelopeOverrun: Bool { verdict != .overrun }

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

    /// Carries its unit even though the hero above already shows one: its neighbour in
    /// the pair is a count of operations, and two figures set in the same type on the
    /// same row have nothing else to say which of them is money.
    func varianceText(for currency: SupportedCurrency) -> String {
        "\(variance > 0 ? "+" : "")\(variance.asAdaptiveCurrency(currency))"
    }

    /// One key for every non-zero count: the singular is a plural variant of it in
    /// the catalog, not a second sentence assembled here.
    func uncheckedAccessibilityText(count: Int) -> String {
        count == 0
            ? AppLocale.string("Aucune opération à pointer.")
            : AppLocale.string("\(count) opérations à pointer.")
    }

    func accessibilityDescription(
        monthName: String,
        currency: SupportedCurrency,
        amountsHidden: Bool,
        uncheckedCount: Int
    ) -> String {
        let month = monthName.capitalized
        let unchecked = uncheckedAccessibilityText(count: uncheckedCount)
        guard !amountsHidden else {
            return AppLocale.string("""
                \(month). Solde estimé fin de mois, montant masqué. \
                Comparaison au budget masquée. \(unchecked)
                """)
        }

        // Mirrors `verdictText`: VoiceOver and the sentence on screen say the same thing
        // about the same month, down to the day it left its plan.
        let gap = abs(variance).asAdaptiveCurrency(currency)
        let comparison = switch (verdict, driftDay) {
        case (.gain, let day?): AppLocale.string("\(gap) de mieux que prévu depuis le \(day)")
        case (.gain, nil): AppLocale.string("\(gap) de mieux que prévu")
        case (.overrun, let day?): AppLocale.string("\(gap) de moins que prévu depuis le \(day)")
        case (.overrun, nil): AppLocale.string("\(gap) de moins que prévu")
        case (.onPlan, _): AppLocale.string("Pile sur ton plan")
        }

        let formattedEstimate = "\(estimatedBalance > 0 ? "+" : "")\(estimatedBalance.asAdaptiveCurrency(currency))"
        return AppLocale.string("""
            \(month). Solde estimé fin de mois \
            \(formattedEstimate). \(comparison). \(unchecked)
            """)
    }
}
