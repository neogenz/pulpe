import SwiftUI

/// Read-only display row for a custom transaction during onboarding.
/// Shows name, amount, and action buttons (edit pencil + delete ×).
struct OnboardingTransactionRow: View {
    let transaction: OnboardingTransaction
    let onEdit: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(transaction.name)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                Text(transaction.amount.asCHF)
                    .font(PulpeTypography.caption)
                    .monospacedDigit()
                    .foregroundStyle(Color.onSurfaceVariant)
            }

            Spacer()

            Button(action: onEdit) {
                Image(systemName: "pencil")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.pulpePrimary)
            }
            .iconButtonStyle()

            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .iconButtonStyle()
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
    }
}
