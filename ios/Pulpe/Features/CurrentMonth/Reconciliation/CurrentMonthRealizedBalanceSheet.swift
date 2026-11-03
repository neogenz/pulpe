import SwiftUI

/// The home screen's "Suivi du budget": the shared `RealizedBalanceSheet`, with
/// "Rapprocher mes comptes" (PUL-351) presented over it with the month this store has
/// loaded. Budget details supplies its own viewed month.
struct CurrentMonthRealizedBalanceSheet: View {
    @Environment(CurrentMonthStore.self) private var store
    @State private var isReconciling = false

    var body: some View {
        RealizedBalanceSheet(
            metrics: store.metrics,
            realizedMetrics: store.realizedMetrics,
            onReconcile: store.budget == nil ? nil : { isReconciling = true }
        )
        .sheet(isPresented: $isReconciling) {
            if let month = reconciledMonth {
                // `addTransaction` is the store's own landing for a created entry: the
                // checked balance moves at once and the sibling stores are invalidated.
                ReconcileAccountsSheet(
                    month: month,
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
                        FirstTransactionTracker.shared.recordCreated(
                            kind: transaction.kind,
                            source: .reconciliation
                        )
                        store.addTransaction(transaction)
                    }
                )
            }
        }
    }

    private var reconciledMonth: ReconcileAccountsSheet.Month? {
        guard let budget = store.budget else { return nil }
        return ReconcileAccountsSheet.Month(
            budgetId: budget.id,
            realizedMetrics: store.realizedMetrics,
            rollover: store.metrics.rollover,
            periodLabel: BudgetPeriodCalculator.formatPeriod(
                month: budget.month,
                year: budget.year,
                payDayOfMonth: store.payDayOfMonth
            ),
            uncheckedCount: store.uncheckedCount,
            hasPointingInFlight: store.hasTogglesInFlight
        )
    }
}
