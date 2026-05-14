import SwiftUI

/// Blocking screen shown over the entire app tree when the running binary is
/// below the backend-published minimum supported iOS version.
///
/// Presented via `.fullScreenCover` at the `WindowGroup` level so it covers
/// every route (loading, onboarding, login, main). Non-dismissable — the only
/// action is "Mettre à jour" which opens the App Store via `openURL`.
struct ForceUpdateView: View {
    let storeURL: URL?

    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Spacer()

            Image(systemName: "arrow.up.circle.fill")
                .font(.system(size: DesignTokens.IconSize.brand, weight: .semibold))
                .foregroundStyle(Color.pulpePrimary)
                .accessibilityHidden(true)

            Text("Mise à jour requise")
                .font(.title2.bold())
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)

            Text("Une nouvelle version de Pulpe est disponible. Mets l'app à jour pour continuer.")
                .font(.body)
                .foregroundStyle(Color.onSurfaceVariant)
                .multilineTextAlignment(.center)

            Spacer()

            Button("Mettre à jour", action: openStore)
                .primaryButtonStyle(isEnabled: storeURL != nil)
                .disabled(storeURL == nil)
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pulpeBackground()
        .interactiveDismissDisabled()
    }

    private func openStore() {
        guard let storeURL else { return }
        openURL(storeURL)
    }
}

#Preview("Force update — with store URL") {
    ForceUpdateView(storeURL: URL(string: "https://apps.apple.com/app/pulpe"))
}

#Preview("Force update — no store URL") {
    ForceUpdateView(storeURL: nil)
}
