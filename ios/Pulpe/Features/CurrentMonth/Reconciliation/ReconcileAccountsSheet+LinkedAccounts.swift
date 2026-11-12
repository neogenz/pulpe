import SwiftUI

/// Under a row of one of my accounts: what it was worth when last recorded.
struct LinkedAccountHint: View {
    let asset: Asset

    var body: some View {
        Text(AppLocale.string("Dernier solde : \(asset.latestValue.asCurrency(asset.currency)), \(asset.ageLabel())"))
            .font(PulpeTypography.captionRegular)
            .foregroundStyle(Color.textSecondary)
            .sensitiveAmount()
    }
}

/// Tells which rows update Mon patrimoine, and that the others are not saved.
struct LinkedAccountsFootnote: View {
    var body: some View {
        Text("Je mets à jour le solde de tes comptes de Mon patrimoine. Les autres lignes ne sont pas enregistrées.")
            .font(PulpeTypography.captionRegular)
            .foregroundStyle(Color.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct AppliesAccountLinks: ViewModifier {
    let flow: ReconcileAccountsFlow
    @Environment(AssetStore.self) private var assetStore
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore

    func body(content: Content) -> some View {
        content.onChange(of: flow.isCompleted) { _, _ in
            let currency = userSettingsStore.currency
            Task { await flow.applyAccountLinks(into: assetStore, currency: currency, toastManager: toastManager) }
        }
    }
}

extension ReconcileAccountsFlow {
    /// The link plan, written once completed. A new account lands in « Comptes ». A failure
    /// only toasts, in words of its own: the reconciliation itself stays done.
    func applyAccountLinks(
        into assetStore: AssetStore, currency: SupportedCurrency, toastManager: ToastManager
    ) async {
        let plan = linkPlan
        guard isCompleted, !plan.isEmpty else { return }
        do {
            try await assetStore.followAccounts(
                creating: NewFollowedAccounts(
                    accounts: plan.creates.map { (name: $0.name, value: $0.value) },
                    currency: currency,
                    category: .starter(name: AppLocale.string("Comptes"))
                ),
                links: plan.links, unlinks: plan.unlinks, snapshots: plan.snapshots
            )
        } catch {
            toastManager.show(
                AppLocale.string(
                    "Rapprochement fait, mais je n'ai pas pu enregistrer tes soldes dans Mon patrimoine."
                ),
                type: .error
            )
        }
    }
}

extension View {
    /// Completion, and only completion, writes the accounts I finished with to Mon patrimoine.
    func appliesAccountLinks(of flow: ReconcileAccountsFlow) -> some View {
        modifier(AppliesAccountLinks(flow: flow))
    }
}
