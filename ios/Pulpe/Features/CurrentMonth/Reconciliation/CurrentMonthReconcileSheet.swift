import SwiftUI

/// « Comparer avec mes comptes » (PUL-351) on the month the Accueil has loaded, opened from
/// « Le calcul » and from « À pointer ». Budget details supplies its own viewed month.
struct CurrentMonthReconcileSheet: View {
    @Environment(CurrentMonthStore.self) private var store

    var body: some View {
        if let budget = store.budget {
            // `addTransaction` is the store's own landing for a created entry: the checked
            // balance moves at once and the sibling stores are invalidated.
            ReconcileAccountsSheet(
                month: .init(
                    budgetId: budget.id,
                    realizedMetrics: store.realizedMetrics,
                    rollover: store.metrics.rollover,
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
                onAdjustmentCreated: { transaction in
                    FirstTransactionTracker.shared.recordCreated(kind: transaction.kind, source: .reconciliation)
                    store.addTransaction(transaction)
                }
            )
        }
    }
}
