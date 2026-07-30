import SwiftUI

/// Tappable card row linking a detail screen to the larger set its subject
/// belongs to — the occurrences of a lissage, the savings goal a prévision funds.
///
/// The row owns its surface instead of inheriting one from its host. The same
/// component sits in the `List` of `BudgetLineDetailPage` and in the `ScrollView`
/// of `EditTransactionPage`; a host-provided surface is what rendered it as a
/// full-bleed system band in the former and as a bare, surface-less line in the
/// latter.
struct ContextLinkRow: View {
    let icon: String
    let iconTint: Color
    let title: String
    var accessibilityLabel: String?
    var accessibilityHint: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: icon)
                    .font(PulpeTypography.actionIcon)
                    .foregroundStyle(iconTint)

                // A long goal name wraps rather than truncates — the whole point
                // of the row is naming where it leads.
                Text(title)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)

                Spacer(minLength: DesignTokens.Spacing.sm)

                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
            .pulpeCard()
        }
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
        .plainPressedButtonStyle()
        .accessibilityLabel(accessibilityLabel ?? title)
        .ifLet(accessibilityHint) { view, hint in view.accessibilityHint(hint) }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: DesignTokens.Spacing.md) {
        ContextLinkRow(
            icon: "calendar",
            iconTint: .financialExpense,
            title: "Dépense lissée",
            action: {}
        )

        ContextLinkRow(
            icon: "target",
            iconTint: .financialSavings,
            title: "Objectif : Appartement à Lausanne",
            action: {}
        )
    }
    .padding(DesignTokens.Spacing.lg)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appBackground)
}
