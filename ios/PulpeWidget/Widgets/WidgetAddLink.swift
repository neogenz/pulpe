import SwiftUI

/// The one green thing on a widget: a filled disc with a plus that opens a new expense.
struct WidgetAddLink: View {
    var body: some View {
        Link(destination: DeepLinks.addExpense) {
            Image(systemName: "plus")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.textOnPrimary)
                .frame(width: DesignTokens.IconSize.widgetAction, height: DesignTokens.IconSize.widgetAction)
                .background(Color.pulpePrimary, in: Circle())
        }
        .accessibilityLabel("Ajouter une dépense")
    }
}

extension SupportedCurrency {
    /// An amount in ink with its currency as a smaller secondary suffix (V2 widget figure).
    func widgetFigure(_ amount: Decimal, font: Font, isOverBudget: Bool) -> Text {
        Text(verbatim: amount.asAmount(for: self))
            .font(font)
            .foregroundStyle(isOverBudget ? Color.financialOverBudget : Color.textPrimary)
            + Text(verbatim: " \(symbol)")
            .font(.system(.callout, weight: .semibold))
            .foregroundStyle(Color.textSecondary)
    }
}
