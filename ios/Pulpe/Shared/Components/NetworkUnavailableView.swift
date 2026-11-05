import SwiftUI

/// Full-screen view shown when the backend server is unreachable at startup
struct NetworkUnavailableView: View {
    let onRetry: () async -> Void
    /// Escape hatch back to the login screen. Without it, a session failure
    /// misclassified as retryable would trap the user on this screen forever.
    let onSignOut: () async -> Void
    @State private var isRetrying = false

    var body: some View {
        StatusScreen(
            systemImage: "wifi.slash",
            tone: .neutral,
            textIdentifier: "networkUnavailableTitle",
            title: AppLocale.string("Connexion impossible"),
            message: message,
            primary: .init(title: AppLocale.string("Réessayer")) {
                guard !isRetrying else { return }
                Task {
                    isRetrying = true
                    defer { isRetrying = false }
                    await onRetry()
                }
            },
            secondary: .init(title: AppLocale.string("Retour à la connexion")) {
                guard !isRetrying else { return }
                Task { await onSignOut() }
            }
        )
    }

    private var message: String {
        let base = AppLocale.string(
            "Pulpe n'arrive pas à joindre le serveur. Vérifie ta connexion internet, puis réessaie."
        )
        guard AppConfiguration.environment == .local else { return base }
        return base + "\n" + AppLocale.string("Build Local : le serveur est peut-être éteint, lance pnpm dev.")
    }
}

#Preview {
    NetworkUnavailableView(
        onRetry: { try? await Task.sleep(for: .seconds(1)) },
        onSignOut: {}
    )
}
