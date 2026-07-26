import SwiftUI

/// Branded full-screen empty state: pulsing glyph, title, guidance, optional CTA.
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
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: systemImage)
                .font(PulpeTypography.emojiDisplay)
                .foregroundStyle(Color.textTertiary)
                .symbolEffect(.pulse, options: .nonRepeating)
                // Decorative: VoiceOver would otherwise read the SF Symbol name
                // before the title.
                .accessibilityHidden(true)
            Text(title)
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimary)
            Text(message)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textTertiary)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .disabled(!isActionEnabled)
                    .primaryButtonStyle(isEnabled: isActionEnabled)
            }
        }
        .padding(DesignTokens.Spacing.xxxl)
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
