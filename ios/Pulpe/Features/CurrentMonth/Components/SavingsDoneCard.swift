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
            return AppLocale.string("\(formatted) · objectif \(goalName)")
        }
        return formatted
    }

    private var accessibilityDescription: String {
        guard !amountsHidden else {
            return AppLocale.string("Épargne du mois versée — montant masqué")
        }
        return AppLocale.string("Épargne du mois versée, \(subtitle)")
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.lg) {
                RowIcon(systemName: "checkmark", tint: .financialSavings)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    // `cardTitle`, not `sectionTitle`: on the page, that weight now belongs
                    // to a section's name. Wearing it inside a card, this row claimed to be
                    // heading a list that doesn't exist.
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
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            // No heading of its own: "tout va bien" is the whole message, and a section
            // title above a single row would announce a list that isn't there.
            .pulpeRowCard()
        }
        .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.card))
        .plainPressedButtonStyle()
        .accessibilityLabel(accessibilityDescription)
        .accessibilityHint("Voir mes objectifs d'épargne")
    }
}
