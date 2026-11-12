import SwiftUI

/// Resolves my accounts of the user's currency, followed or not, before the reconciliation
/// sheet is built, since its flow seeds its rows once. Flag off or a failed read: `nil`, the
/// sheet opens on one empty row as it always did and writes nothing to « Mon patrimoine ».
struct ReconcileLinkedAccountsGate<Content: View>: View {
    @ViewBuilder let content: ([Asset]?) -> Content

    @Environment(FeatureFlagsStore.self) private var featureFlags
    @Environment(AssetStore.self) private var assetStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var accounts: [Asset]?
    @State private var isResolved = false

    var body: some View {
        if !featureFlags.isNetWorthEnabled {
            content(nil)
        } else if isResolved {
            content(accounts)
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.sheetBackground)
                .task {
                    await assetStore.loadIfNeeded()
                    accounts = assetStore.hasError
                        ? nil
                        : assetStore.ownAccounts(currency: userSettingsStore.currency)
                    isResolved = true
                }
        }
    }
}
