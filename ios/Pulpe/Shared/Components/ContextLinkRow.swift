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
    /// Extra sentence under the title. Reserved for a row that leads nowhere:
    /// when there is no destination, the row owes the user the reason.
    var detail: String?
    var accessibilityLabel: String?
    var accessibilityHint: String?
    /// `nil` turns the row into a statement instead of a link: no button, no
    /// chevron, no tap. A dead end must not look navigable (PUL-329).
    var action: (() -> Void)?

    @ViewBuilder
    var body: some View {
        if let action {
            Button(action: action) {
                rowContent(showsChevron: true)
            }
            .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
            .plainPressedButtonStyle()
            .accessibilityLabel(accessibilityLabel ?? title)
            .ifLet(accessibilityHint) { view, hint in view.accessibilityHint(hint) }
        } else {
            rowContent(showsChevron: false)
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(staticAccessibilityLabel)
        }
    }

    /// The explanation is part of what a static row says, so VoiceOver reads it
    /// with the title rather than as a separate stop.
    private var staticAccessibilityLabel: String {
        [accessibilityLabel ?? title, detail].compactMap { $0 }.joined(separator: ". ")
    }

    private func rowContent(showsChevron: Bool) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: icon)
                .font(PulpeTypography.actionIcon)
                .foregroundStyle(iconTint)

            // A long goal name wraps rather than truncates — the whole point
            // of the row is naming where it leads.
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(title)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)

                if let detail {
                    Text(detail)
                        .font(PulpeTypography.footnote)
                        .foregroundStyle(Color.onSurfaceVariant)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .multilineTextAlignment(.leading)

            Spacer(minLength: DesignTokens.Spacing.sm)

            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .pulpeCard()
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

        ContextLinkRow(
            icon: SavingsGoalSource.broken(name: "Voiture").icon,
            iconTint: .textTertiary,
            title: SavingsGoalSource.broken(name: "Voiture").label,
            detail: SavingsGoalSource.brokenExplanation
        )
    }
    .padding(DesignTokens.Spacing.lg)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appBackground)
}
