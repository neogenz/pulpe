import SwiftUI

/// Resolves my accounts and what I owe, in the user's currency, followed or not, before the
/// reconciliation sheet is built, since its flow seeds its rows once. Flag off or a failed read:
/// `nil`, the sheet has free rows only and writes nothing to « Mon patrimoine ».
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
                    // Always fresh: a line checked a minute ago already moved the value the
                    // caption shows (« où il vaut aujourd'hui … »). A failed refresh keeps the
                    // assets of an earlier load, and `hasError` stays false while they are there.
                    await assetStore.forceRefresh()
                    accounts = assetStore.hasError
                        ? nil
                        : assetStore.activeAssets.filter { $0.currency == userSettingsStore.currency }
                    isResolved = true
                }
        }
    }
}
