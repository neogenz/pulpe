import SwiftUI

/// Display row of a custom transaction during onboarding: name and amount in ink; a tap edits,
/// the × removes.
struct OnboardingTransactionRow: View {
    let transaction: OnboardingTransaction
    let onEdit: () -> Void
    let onRemove: () -> Void
    var currency: SupportedCurrency = .chf

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Button(action: onEdit) {
                HStack(spacing: DesignTokens.Spacing.md) {
                    Text(transaction.name)
                        .font(PulpeTypography.rowTitleRegular)
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(transaction.amount.asAmount(for: currency))
                        .font(PulpeTypography.rowAmount)
                        .foregroundStyle(Color.textPrimary)
                }
                .frame(minHeight: DesignTokens.ListRow.formRowHeight)
                .contentShape(Rectangle())
            }
            .plainPressedButtonStyle()
            .accessibilityLabel("Modifier \(transaction.name)")

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
            .iconButtonStyle()
            .accessibilityLabel("Supprimer \(transaction.name)")
        }
    }
}
