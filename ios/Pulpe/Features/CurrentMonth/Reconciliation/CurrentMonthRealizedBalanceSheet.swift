import SwiftUI

/// The home screen's "Suivi du budget": the shared `RealizedBalanceSheet`, plus
/// "Rapprocher mes comptes" (PUL-351) pinned under it and presented over it with the
/// month this store has loaded. The budget page shows the shared sheet alone — only the
/// current month is reconciled, and never through a second resolution of which month.
struct CurrentMonthRealizedBalanceSheet: View {
    @Environment(CurrentMonthStore.self) private var store
    @State private var isReconciling = false

    var body: some View {
        RealizedBalanceSheet(metrics: store.metrics, realizedMetrics: store.realizedMetrics)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if store.budget != nil {
                    reconcileButton
                }
            }
            .sheet(isPresented: $isReconciling) {
                if let month = reconciledMonth {
                    // `addTransaction` is the store's own landing for a created entry: the
                    // checked balance moves at once and the sibling stores are invalidated.
                    ReconcileAccountsSheet(
                        month: month,
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

    /// Pinned rather than scrolled: the sheet opens at its medium detent, where the end
    /// of its content — the "compare with your bank" tip — sits below the fold.
    private var reconcileButton: some View {
        Button {
            isReconciling = true
        } label: {
            Label("Rapprocher mes comptes", systemImage: "building.columns")
        }
        .secondaryButtonStyle()
        .accessibilityIdentifier("reconcileAccountsButton")
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.sheetBackground)
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
