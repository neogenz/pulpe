import SwiftUI

/// Resolves the in-Pulpe accounts of the user's currency before the reconciliation sheet is
/// built, since its flow seeds its rows once. Flag off or a failed read: no linked account,
/// the sheet opens on one empty row as it always did, with no asset request.
struct ReconcileLinkedAccountsGate<Content: View>: View {
    @ViewBuilder let content: ([Asset]) -> Content

    @Environment(FeatureFlagsStore.self) private var featureFlags
    @Environment(AssetStore.self) private var assetStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var linkedAccounts: [Asset]?

    var body: some View {
        if !featureFlags.isNetWorthEnabled {
            content([])
        } else if let linkedAccounts {
            content(linkedAccounts)
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.sheetBackground)
                .task {
                    await assetStore.loadIfNeeded()
                    linkedAccounts = assetStore.hasError
                        ? []
                        : assetStore.inPulpeAccounts(currency: userSettingsStore.currency)
                }
        }
    }
}
