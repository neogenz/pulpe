import SwiftUI

/// « Comparer avec mes comptes » (PUL-351) on the month the Accueil has loaded, opened from
/// « Le calcul » and from « À pointer ». Budget details supplies its own viewed month.
struct CurrentMonthReconcileSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(FeatureFlagsStore.self) private var featureFlags
    @Environment(CurrentMonthStore.self) private var store
    private let drafts = ReconcileDraftStore.shared

    var body: some View {
        if let budget = store.budget {
            // `addTransaction` is the store's own landing for a created entry: the checked
            // balance moves at once and the sibling stores are invalidated.
            ReconcileLinkedAccountsGate { netWorthAccounts in
                ReconcileAccountsSheet(
                    month: .init(
                        budgetId: budget.id,
                        realizedMetrics: store.realizedMetrics,
                        available: store.metrics.remaining,
                        hasPointingInFlight: store.hasTogglesInFlight
                    ),
                    checking: .init(
                        items: store.allUncheckedItems,
                        transactions: store.transactions, budgetLines: store.budgetLines,
                        syncingTransactionIds: store.syncingTransactionIds,
                        syncingBudgetLineIds: store.syncingBudgetLineIds,
                        toggle: { item in
                            switch item {
                            case .transaction(let tx, _): await store.toggleTransaction(tx)
                            case .budgetLine(let line, _): await store.toggleBudgetLine(line)
                            }
                        }
                    ),
                    netWorthAccounts: netWorthAccounts,
                    restoring: drafts.draft(for: budget.id),
                    statesAccount: featureFlags.isNetWorthEnabled,
                    // Only the PIN lock takes the sheet without the user: closed any other way, it starts over.
                    onLeave: { drafts.keep(appState.authState == .needsPinEntry ? $0 : nil) },
                    onAdjustmentCreated: { transaction in
                        FirstTransactionTracker.shared.recordCreated(kind: transaction.kind, source: .reconciliation)
                        store.addTransaction(transaction)
                    }
                )
            }
        }
    }
}
