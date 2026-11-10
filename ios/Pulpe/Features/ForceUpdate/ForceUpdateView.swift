import SwiftUI

/// Blocking screen shown over the entire app tree when the running binary is
/// below the backend-published minimum supported iOS version.
///
/// Presented via `.fullScreenCover` at the `WindowGroup` level so it covers
/// every route (loading, onboarding, login, main). Non-dismissable: the only
/// action is "Mettre à jour" which opens the App Store via `openURL`.
struct ForceUpdateView: View {
    let storeURL: URL?

    @Environment(\.openURL) private var openURL

    var body: some View {
        StatusScreen(
            systemImage: "arrow.up.circle",
            title: AppLocale.string("Mise à jour requise"),
            message: AppLocale.string(
                "Cette version de Pulpe n'est plus prise en charge. Mets l'app à jour pour continuer, rien n'est perdu."
            ),
            primary: storeURL.map { url in
                .init(title: AppLocale.string("Mettre à jour")) { openURL(url) }
            }
        )
    }
}

#Preview("Force update, with store URL") {
    ForceUpdateView(storeURL: URL(string: "https://apps.apple.com/app/pulpe"))
}

#Preview("Force update, no store URL") {
    ForceUpdateView(storeURL: nil)
}
