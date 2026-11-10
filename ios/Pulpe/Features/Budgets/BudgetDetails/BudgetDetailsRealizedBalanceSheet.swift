import SwiftUI

struct BudgetDetailsRealizedBalanceSheet: View {
    @Environment(BudgetDetailsCoordinator.self) private var coordinator
    @Environment(UserSettingsStore.self) private var settings
    @Environment(ToastManager.self) private var toastManager
    @Environment(\.amountsHidden) private var amountsHidden
    @State private var isReconciling = false

    var body: some View {
        let budget = coordinator.dataStore.budget
        RealizedBalanceSheet(
            metrics: coordinator.dataStore.metrics,
            realizedMetrics: coordinator.dataStore.realizedMetrics,
            period: budget.map { BudgetPeriod(month: $0.month, year: $0.year) },
            onReconcile: budget == nil ? nil : { isReconciling = true }
        )
        .sheet(isPresented: $isReconciling) {
            if let month = reconciledMonth {
                ReconcileLinkedAccountsGate { linkedAccounts in
                    ReconcileAccountsSheet(
                        month: month,
                        checking: coordinator.reconciliationChecking(
                            ToastContext(toastManager: toastManager, presentationCurrency: settings.currency),
                            amountsHidden: amountsHidden
                        ),
                        linkedAccounts: linkedAccounts
                    ) { transaction in
                        FirstTransactionTracker.shared.recordCreated(kind: transaction.kind, source: .reconciliation)
                        Task { await coordinator.dispatch(.addReconciliationAdjustment(transaction)) }
                    }
                }
            }
        }
    }

    private var reconciledMonth: ReconcileAccountsSheet.Month? {
        guard let budget = coordinator.dataStore.budget else { return nil }
        return ReconcileAccountsSheet.Month(
            budgetId: budget.id,
            realizedMetrics: coordinator.dataStore.realizedMetrics,
            rollover: coordinator.dataStore.metrics.rollover,
            hasPointingInFlight: !coordinator.syncStore.syncingBudgetLineIds.isEmpty
                || !coordinator.syncStore.syncingTransactionIds.isEmpty
        )
    }
}
