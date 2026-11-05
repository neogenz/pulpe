import SwiftUI

/// Reporting a one-off prévision to next month (V2 `Reporter`, PUL-22 CA10): what leaves this
/// month, what it does to its disponible, and that next month keeps its figure because the
/// report carries the amount over with the line.
struct PostponeConfirmation: ViewModifier {
    @Binding var line: BudgetLine?
    let dataStore: BudgetDataStore
    let currency: SupportedCurrency
    let onConfirm: (BudgetLine) -> Void

    func body(content: Content) -> some View {
        content.sheet(item: $line) { line in
            let next = dataStore.nextMonthLabel
            ImpactConfirmSheet(
                title: Self.title(nextMonth: next),
                message: Self.message(line: line, month: dataStore.budget?.month, nextMonth: next, currency: currency),
                impact: impact(of: line, nextMonth: next),
                currency: currency,
                primary: .init(title: AppLocale.string("Reporter"), accessibilityIdentifier: "postponeConfirmButton") {
                    onConfirm(line)
                }
            )
        }
    }

    private func impact(of line: BudgetLine, nextMonth: String?) -> ImpactConfirmSheet.Impact {
        let figures = dataStore.impactOfRemoving(lineId: line.id)
        var note: String?
        if let nextMonth, let remaining = dataStore.nextMonthRemaining {
            note = AppLocale.string("""
                \(nextMonth.capitalized) reste à \(remaining.asAmount(for: currency)) : \
                les \(line.amount.asAmount(for: currency)) y arrivent avec le report.
                """)
        }
        return .init(title: figures.title(currency: currency), figures: figures, note: note)
    }

    static func title(nextMonth: String?) -> String {
        guard let nextMonth else { return AppLocale.string("Reporter au mois suivant ?") }
        return AppLocale.string("Reporter en \(nextMonth) ?")
    }

    /// « Les 80.00 prévus pour Cadeau anniversaire quittent novembre et passent en décembre. »
    static func message(line: BudgetLine, month: Int?, nextMonth: String?, currency: SupportedCurrency) -> String? {
        guard let month, let nextMonth else { return nil }
        let amount = line.amount.asAmount(for: currency)
        let current = Formatters.monthNameInText(for: month)
        return AppLocale.string(
            "Les \(amount) prévus pour \(line.name) quittent \(current) et passent en \(nextMonth)."
        )
    }
}
