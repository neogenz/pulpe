import SwiftUI

/// Dashboard entry point to the savings goals (PUL-12). Rendered inside the
/// Épargne section of `CurrentMonthView`. Always reachable — even with no
/// savings yet — so the empty state stays accessible (CA18). Neutral/primary
/// only, never an alert color (RG-002).
struct SavingsGoalsEntryRow: View {
    let hasSavings: Bool

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "target")
                .font(PulpeTypography.actionIcon)
                .foregroundStyle(Color.pulpePrimary)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(hasSavings ? "Voir mes objectifs" : "Fixe ton premier objectif")
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                if !hasSavings {
                    Text("Suis tes projets d'épargne long terme")
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textTertiary)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
    }
}
