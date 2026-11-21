import SwiftUI

struct BudgetDetailsRealizedBalanceSheet: View {
    @Environment(BudgetDetailsCoordinator.self) private var coordinator
    @Environment(UserSettingsStore.self) private var settings
    @Environment(ToastManager.self) private var toastManager
    @Environment(AppState.self) private var appState
    @Environment(\.amountsHidden) private var amountsHidden
    @State private var isReconciling = false
    private let drafts = ReconcileDraftStore.shared

    var body: some View {
        let budget = coordinator.dataStore.budget
        RealizedBalanceSheet(
            metrics: coordinator.dataStore.metrics,
            realizedMetrics: coordinator.dataStore.realizedMetrics,
            period: budget.map { BudgetPeriod(month: $0.month, year: $0.year) },
            // Only the current period can be compared with the accounts as they are today.
            onReconcile: budget?.isCurrentPeriod(payDayOfMonth: settings.payDayOfMonth) == true
                ? { isReconciling = true } : nil
        )
        .sheet(isPresented: $isReconciling) {
            if let month = reconciledMonth {
                ReconcileLinkedAccountsGate { netWorthAccounts in
                    ReconcileAccountsSheet(
                        month: month,
                        checking: coordinator.reconciliationChecking(
                            ToastContext(toastManager: toastManager, presentationCurrency: settings.currency),
                            amountsHidden: amountsHidden
                        ),
                        netWorthAccounts: netWorthAccounts,
                        restoring: drafts.draft(for: month.budgetId),
                        // Only the PIN lock takes the sheet without the user: closed any other way, it starts over.
                        onLeave: { drafts.keep(appState.authState == .needsPinEntry ? $0 : nil, resumes: false) },
                        onAdjustmentCreated: { transaction in
                            FirstTransactionTracker.shared
                                .recordCreated(kind: transaction.kind, source: .reconciliation)
                            Task { await coordinator.dispatch(.addReconciliationAdjustment(transaction)) }
                        }
                    )
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
