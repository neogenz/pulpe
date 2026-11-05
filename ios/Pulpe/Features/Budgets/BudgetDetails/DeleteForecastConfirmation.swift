import SwiftUI

/// Deleting a prévision (V2 `Prevision-supprimer`): say what its movements become, what it
/// does to the disponible, and that the template keeps the line. Confirming starts the
/// soft-delete, whose toast still offers the undo.
struct DeleteForecastConfirmation: ViewModifier {
    @Binding var line: BudgetLine?
    let dataStore: BudgetDataStore
    let transactionsByLineId: [String: [Transaction]]
    let currency: SupportedCurrency
    let onConfirm: (BudgetLine) -> Void

    func body(content: Content) -> some View {
        content.sheet(item: $line) { line in
            let figures = dataStore.impactOfRemoving(lineId: line.id)
            ImpactConfirmSheet(
                title: AppLocale.string("Supprimer \(line.name) ?"),
                message: Self.message(
                    line: line,
                    movements: transactionsByLineId[line.id] ?? [],
                    month: dataStore.budget?.month,
                    disponibleMoves: figures.tone != .neutral,
                    currency: currency
                ),
                impact: figures.tone == .neutral
                    ? nil
                    : .init(title: figures.title(currency: currency), figures: figures),
                note: AppLocale.string("Tu auras quelques secondes pour annuler."),
                currency: currency,
                isDestructive: true,
                primary: .init(
                    title: AppLocale.string("Supprimer la prévision"),
                    accessibilityIdentifier: "deleteForecastConfirmButton"
                ) { onConfirm(line) }
            )
        }
    }

    /// « Ses 7 mouvements deviennent des imprévus : 664.20 en tout. Ton disponible ne bouge
    /// pas. » then, for a line that comes from the template, « Seul novembre est concerné :
    /// ton modèle garde Courses. » When the disponible moves, the impact block says it.
    static func message(
        line: BudgetLine,
        movements: [Transaction],
        month: Int?,
        disponibleMoves: Bool,
        currency: SupportedCurrency
    ) -> String {
        var sentences: [String] = []
        if !movements.isEmpty {
            let total = movements.reduce(Decimal.zero) { $0 + $1.amount }.asAmount(for: currency)
            sentences.append(AppLocale.string(
                "Ses \(movements.count) mouvements deviennent des imprévus : \(total) en tout."
            ))
        }
        if !disponibleMoves {
            sentences.append(AppLocale.string("Ton disponible ne bouge pas."))
        }
        var paragraphs = [sentences.joined(separator: " ")]
        if line.templateLineId != nil, let month {
            let name = Formatters.monthNameInText(for: month)
            paragraphs.append(AppLocale.string("Seul \(name) est concerné : ton modèle garde \(line.name)."))
        }
        return paragraphs.filter { !$0.isEmpty }.joined(separator: "\n")
    }
}
