import SwiftUI

private struct AppliesAccountLinks: ViewModifier {
    let flow: ReconcileAccountsFlow
    @Environment(AssetStore.self) private var assetStore
    @Environment(ToastManager.self) private var toastManager

    func body(content: Content) -> some View {
        content.onChange(of: flow.isCompleted) { _, _ in
            Task { await flow.applyAccountLinks(into: assetStore, toastManager: toastManager) }
        }
    }
}

extension ReconcileAccountsFlow {
    /// The link plan, written once completed: balances of the followed items, and which ones are
    /// followed. A failure only toasts, in words of its own: the reconciliation itself stays done.
    func applyAccountLinks(into assetStore: AssetStore, toastManager: ToastManager) async {
        let plan = linkPlan
        guard isCompleted, !plan.isEmpty else { return }
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
    /// Completion, and only completion, writes the accounts I finished with to Mon patrimoine.
    func appliesAccountLinks(of flow: ReconcileAccountsFlow) -> some View {
        modifier(AppliesAccountLinks(flow: flow))
    }
}
