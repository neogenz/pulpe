import SwiftUI

/// The empty state of a root page that keeps its header (V2 `empty` on a white card): a pale-green
/// disc, a title, one sentence and one action, centered in a surface card.
struct EmptyStateCard: View {
    let systemImage: String
    let title: String
    let message: String
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.compactGap) {
            Image(systemName: systemImage)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.accentInk)
                .frame(width: DesignTokens.Control.emptyDisc, height: DesignTokens.Control.emptyDisc)
                .background(Color.accentWash, in: Circle())
                .accessibilityHidden(true)
            Text(title)
                .font(PulpeTypography.statusTitle)
                .foregroundStyle(Color.textPrimary)
            Text(message)
                .font(PulpeTypography.bannerText)
                .foregroundStyle(Color.textSecondary)
            Button(actionTitle, action: action)
                .primaryButtonStyle(size: .small)
                .padding(.top, DesignTokens.Spacing.sm)
        }
        .multilineTextAlignment(.center)
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity)
        .pulpeSurfaceCard()
    }
}

#Preview {
    EmptyStateCard(
        systemImage: "target",
        title: "Fixe ton premier objectif",
        message: "Suis tes projets d'épargne long terme, sans recalculer à la main.",
        actionTitle: "Créer un objectif"
    ) {}
    .padding()
    .background(Color.appBackground)
}
