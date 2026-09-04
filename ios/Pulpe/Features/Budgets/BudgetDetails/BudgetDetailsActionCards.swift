import SwiftUI

/// The two things this screen does, named in the content zone instead of hinted at by two
/// bare glyphs in the navigation bar. They replace those glyphs rather than doubling them:
/// two affordances for one action is how a screen teaches that neither is the real one.
///
/// Two independent cards, not one surface split by a rule. They open unrelated
/// destinations — a form and a read-only view — and a single card cut in half reads as one
/// control someone divided, which is a promise the pair does not keep.
struct BudgetDetailsActionCards: View {
    let onAddLine: () -> Void
    let onTrack: () -> Void

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            card(
                systemName: "plus",
                title: AppLocale.string("Ajouter"),
                accessibilityLabel: AppLocale.string("Ajouter une prévision"),
                identifier: "budgetAddLineButton",
                action: onAddLine
            )
            card(
                systemName: "chart.bar.fill",
                title: AppLocale.string("Suivi"),
                accessibilityLabel: AppLocale.string("Suivi du budget"),
                identifier: "budgetTrackingButton",
                action: onTrack
            )
        }
    }

    /// The icon sits above its word rather than beside it: side by side, the longer of the
    /// two labels wraps first and the pair stops being symmetric at the text sizes where
    /// symmetry is the only thing still saying they are peers.
    private func card(
        systemName: String,
        title: String,
        accessibilityLabel: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: DesignTokens.Spacing.xxs) {
                Image(systemName: systemName)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)

                Text(title)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.compact)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: DesignTokens.FrameHeight.actionCard)
            // The section cards further down the same screen carry this radius. A card
            // that sits inside the same scroll and rounds differently reads as a
            // different kind of object.
            .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
        }
        .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.card))
        .plainPressedButtonStyle()
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier(identifier)
    }
}

#Preview {
    BudgetDetailsActionCards(onAddLine: {}, onTrack: {})
        .padding(DesignTokens.Spacing.lg)
        .pulpeBackground()
}
