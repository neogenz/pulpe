import SwiftUI

/// Tour 11 "Épargne du mois versée" — replaces the drift card when nothing drifts
/// and the month's savings are fully transferred. The screen breathes when all is well.
struct SavingsDoneCard: View {
    let amount: Decimal
    let goalName: String?
    var onTap: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden

    private var subtitle: String {
        let formatted = amount.asCompactCurrency(userSettingsStore.currency)
        if let goalName {
            return "\(formatted) · objectif \(goalName)"
        }
        return formatted
    }

    private var accessibilityDescription: String {
        guard !amountsHidden else { return "Épargne du mois versée — montant masqué" }
        return "Épargne du mois versée, \(subtitle)"
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.lg) {
                Circle()
                    .fill(Color.financialSavings.opacity(DesignTokens.Opacity.accent))
                    .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
                    .overlay {
                        Image(systemName: "checkmark")
                            .font(PulpeTypography.metricLabelBold)
                            .foregroundStyle(Color.financialSavings)
                    }

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text("Épargne du mois versée")
                        .font(PulpeTypography.cardTitle)
                        .foregroundStyle(Color.textPrimary)

                    Text(subtitle)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textTertiary)
                        .monospacedDigit()
                        .sensitiveAmount()
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textTertiary)
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.vertical, DesignTokens.Spacing.lg)
            .pulpeCardBackground()
            .shadow(DesignTokens.Shadow.card)
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .accessibilityLabel(accessibilityDescription)
        .accessibilityHint("Voir mes objectifs d'épargne")
    }
}
