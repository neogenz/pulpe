import SwiftUI

/// The one filled element in the budget's content zone, and the same shape the accueil gives
/// to recording an operation — only the word changes. Adding a forecast is what this screen
/// is for; the other action it offers only reads what is already there, so it stays a glyph
/// in the navigation bar rather than competing here for the same weight.
struct BudgetDetailsAddLineButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(AppLocale.string("Ajouter une prévision"), systemImage: "plus")
        }
        .primaryButtonStyle()
        .accessibilityLabel(AppLocale.string("Ajouter une prévision"))
        .accessibilityIdentifier("budgetAddLineButton")
    }
}

#Preview {
    BudgetDetailsAddLineButton(action: {})
        .padding(DesignTokens.Spacing.lg)
        .pulpeBackground()
}
