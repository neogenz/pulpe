import SwiftUI

/// The disc that opens a row: a symbol on a wash of its own tint.
///
/// Extracted from the checkmark disc `SavingsDoneCard` composed by hand. Every row of
/// the home ledger now starts with one, because a row that starts with a shape can be
/// picked out of a list without being read — which is the whole job of a leading mark.
struct RowIcon: View {
    let systemName: String
    let tint: Color

    var body: some View {
        Circle()
            .fill(tint.opacity(DesignTokens.Opacity.accent))
            .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
            .overlay {
                Image(systemName: systemName)
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(tint)
            }
            // The row already names what it is; announcing the glyph would say it twice.
            .accessibilityHidden(true)
    }
}

#Preview {
    VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
        RowIcon(systemName: "plus", tint: .pulpePrimary)
        RowIcon(systemName: TransactionKind.expense.icon, tint: TransactionKind.expense.color)
        RowIcon(systemName: TransactionKind.income.icon, tint: TransactionKind.income.color)
        RowIcon(systemName: TransactionKind.saving.icon, tint: TransactionKind.saving.color)
    }
    .padding()
    .background(Color.appBackground)
}
