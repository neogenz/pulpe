import SwiftUI

/// PUL-17 — the "Prévision lissée → voir les mois" affordance. Shared by
/// the budget-line detail page AND the transaction detail page so both surfaces
/// of a spread line reach the occurrences timeline in lockstep. The caller
/// provides the action (it owns the router + the spread group id).
struct SpreadAffordanceButton: View {
    let kind: TransactionKind
    let onTap: () -> Void

    var body: some View {
        ContextLinkRow(
            icon: "calendar",
            iconTint: kind.color,
            title: Self.title(for: kind),
            accessibilityLabel: Self.accessibilityLabel(for: kind),
            action: onTap
        )
        .accessibilityIdentifier("spreadAffordanceButton")
    }

    /// Whole key per kind — "Épargne lissée" is a sentence, not "{noun} + lissée":
    /// the accord and the word order differ per language. V1 spreads only expenses
    /// and savings (`BudgetLineSpread`), so the noun is binary.
    static func title(for kind: TransactionKind) -> String {
        kind == .saving ? AppLocale.string("Épargne lissée") : AppLocale.string("Dépense lissée")
    }

    private static func accessibilityLabel(for kind: TransactionKind) -> String {
        kind == .saving
            ? AppLocale.string("Épargne lissée, voir les mois")
            : AppLocale.string("Dépense lissée, voir les mois")
    }
}
