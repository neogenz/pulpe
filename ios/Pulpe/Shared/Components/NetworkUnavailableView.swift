import SwiftUI

/// Full-screen view shown when the backend server is unreachable at startup
struct NetworkUnavailableView: View {
    let onRetry: () async -> Void
    /// Escape hatch back to the login screen. Without it, a session failure
    /// misclassified as retryable would trap the user on this screen forever.
    let onSignOut: () async -> Void
    @State private var isRetrying = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            Spacer()

            Image(systemName: "wifi.exclamationmark")
                .font(PulpeTypography.heroIcon)
                .foregroundStyle(Color.textSecondaryOnboarding)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Connexion impossible")
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.textPrimaryOnboarding)

                Text("Impossible de joindre le serveur — vérifie ta connexion internet et réessaie.")
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)

                if AppConfiguration.environment == .local {
                    Text("Build Local : le serveur est peut-être éteint — lance pnpm dev.")
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.textSecondaryOnboarding)
                        .multilineTextAlignment(.center)
                }
            }

            Button {
                Task {
                    isRetrying = true
                    defer { isRetrying = false }
                    await onRetry()
                }
            } label: {
                if isRetrying {
                    ProgressView()
                        .tint(.white)
                } else {
                    Label("Réessayer", systemImage: "arrow.clockwise")
                }
            }
            .primaryButtonStyle(isEnabled: !isRetrying)
            .disabled(isRetrying)

            Button("Retour à la connexion") {
                Task { await onSignOut() }
            }
            .textLinkButtonStyle()
            .disabled(isRetrying)

            Spacer()
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pulpeBackground()
    }
}

#Preview {
    NetworkUnavailableView(
        onRetry: { try? await Task.sleep(for: .seconds(1)) },
        onSignOut: {}
    )
}
