import SwiftUI

private struct AppliesAccountLinks: ViewModifier {
    let flow: ReconcileAccountsFlow
    @Environment(AssetStore.self) private var assetStore
    @Environment(ToastManager.self) private var toastManager
    @Environment(AppState.self) private var appState

    func body(content: Content) -> some View {
        content.onDisappear {
            // The signal the presenters keep the draft on: the lock takes the sheet, the vault key is gone.
            let isLocked = appState.authState == .needsPinEntry
            Task { await flow.applyAccountLinks(into: assetStore, toastManager: toastManager, isLocked: isLocked) }
        }
    }
}

extension ReconcileAccountsFlow {
    /// The link plan, written once as the sheet closes when one of its comparisons was completed, from the
    /// rows as they are then: balances of the followed items, and which ones are followed. One save per
    /// sheet, so two never race and a row removed between two comparisons is unfollowed. A failure only
    /// toasts, in words of its own: the reconciliation itself stays done.
    /// The lock taking the sheet is no close: the draft carries the flag on to the rebuilt sheet.
    func applyAccountLinks(into assetStore: AssetStore, toastManager: ToastManager, isLocked: Bool = false) async {
        let plan = linkPlan
        guard !isLocked, didCompleteComparison, !hasAppliedAccountLinks, !plan.isEmpty else { return }
        hasAppliedAccountLinks = true
        do {
            try await assetStore.followAccounts(links: plan.links, unlinks: plan.unlinks, snapshots: plan.snapshots)
        } catch {
            toastManager.show(
                AppLocale.string(
                    "Comparaison faite, mais je n'ai pas pu enregistrer tes soldes dans Mon patrimoine."
                ),
                type: .error
            )
        }
    }
}

extension View {
    /// Closing a sheet where a comparison was completed, and only that, writes the accounts to Mon patrimoine.
    func appliesAccountLinks(of flow: ReconcileAccountsFlow) -> some View {
        modifier(AppliesAccountLinks(flow: flow))
    }
}
