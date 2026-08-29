import SwiftUI

/// Dismissible App Store prompt shown once for each published target version.
struct UpdateAvailableSheet: View {
    let version: String
    let storeURL: URL
    let onClose: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: DesignTokens.IconSize.brand, weight: .semibold))
                        .foregroundStyle(Color.pulpePrimary)
                        .accessibilityHidden(true)

                    Text("Mise à jour disponible")
                        .font(.title2.bold())
                        .foregroundStyle(Color.textPrimary)
                        .multilineTextAlignment(.center)

                    Text("Version \(version)")
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.textTertiary)

                    Text("Profite des dernières améliorations de Pulpe. Tu peux les installer maintenant ou plus tard.")
                        .font(.body)
                        .foregroundStyle(Color.onSurfaceVariant)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)

            VStack(spacing: DesignTokens.Spacing.md) {
                Button("Mettre à jour", action: openStore)
                    .primaryButtonStyle()

                Button("Plus tard", action: close)
                    .secondaryButtonStyle()
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.sheetBackground)
    }

    private func close() {
        onClose()
        dismiss()
    }

    private func openStore() {
        onClose()
        dismiss()
        openURL(storeURL)
    }
}

#Preview("Update available") {
    UpdateAvailableSheet(
        version: "1.3.2",
        storeURL: URL(string: "https://apps.apple.com/app/pulpe")!,
        onClose: {}
    )
}
