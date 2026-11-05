import SwiftUI

/// Dismissible App Store prompt shown once for each published target version.
struct UpdateAvailableSheet: View {
    let version: String
    let storeURL: URL
    let onClose: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        StatusScreen(
            systemImage: "arrow.up.circle",
            discSize: DesignTokens.Control.statusDiscCompact,
            title: AppLocale.string("Mise à jour disponible"),
            message: AppLocale.string("Version \(version)") + "\n"
                + AppLocale.string("Quelques améliorations t'attendent. Installe-les quand tu veux."),
            primary: .init(title: AppLocale.string("Mettre à jour")) {
                onClose()
                dismiss()
                openURL(storeURL)
            },
            secondary: .init(title: AppLocale.string("Plus tard")) {
                onClose()
                dismiss()
            }
        )
        .background(Color.sheetBackground)
    }
}

#Preview("Update available") {
    UpdateAvailableSheet(
        version: "1.3.2",
        storeURL: URL(string: "https://apps.apple.com/app/pulpe")!,
        onClose: {}
    )
}
