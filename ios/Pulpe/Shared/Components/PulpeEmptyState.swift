import SwiftUI

/// Full-screen empty state (V2 `empty`): a 56pt pale-green disc, a title, one sentence, one action.
///
/// Fills the available space and paints the app background itself, like
/// `LoadingView` — a placeholder that only hugs its content leaves the rest of
/// the screen on the system background, showing as a band behind the text.
struct PulpeEmptyState: View {
    let systemImage: String
    let title: String
    let message: String
    let actionTitle: String?
    let isActionEnabled: Bool
    let action: (() -> Void)?

    init(
        systemImage: String,
        title: String,
        message: String,
        actionTitle: String? = nil,
        isActionEnabled: Bool = true,
        action: (() -> Void)? = nil
    ) {
        self.systemImage = systemImage
        self.title = title
        self.message = message
        self.actionTitle = actionTitle
        self.isActionEnabled = isActionEnabled
        self.action = action
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.compactGap) {
            Image(systemName: systemImage)
                .font(.system(size: DesignTokens.Control.emptyGlyph, weight: .regular))
                .foregroundStyle(Color.accentInk)
                .frame(width: DesignTokens.Control.emptyDisc, height: DesignTokens.Control.emptyDisc)
                .background(Color.accentWash, in: Circle())
                // Decorative: VoiceOver would otherwise read the SF Symbol name
                // before the title.
                .accessibilityHidden(true)
            Text(title)
                .font(PulpeTypography.statusTitle)
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)
            Text(message)
                .font(PulpeTypography.bannerText)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: DesignTokens.Layout.emptyMessageMaxWidth)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .disabled(!isActionEnabled)
                    .primaryButtonStyle(isEnabled: isActionEnabled, size: .small)
                    .padding(.top, DesignTokens.Spacing.sm)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.vertical, DesignTokens.Spacing.xxxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pulpeBackground()
    }
}

#Preview("With action") {
    PulpeEmptyState(
        systemImage: "target",
        title: "Fixe ton premier objectif",
        message: "Suis tes projets d'épargne long terme, sans recalculer à la main",
        actionTitle: "Créer un objectif"
    ) {}
}

#Preview("Without action") {
    PulpeEmptyState(
        systemImage: "doc.on.doc",
        title: "Pas encore de modèle",
        message: "Crée-en un pour préparer tes prochains budgets plus vite"
    )
}
