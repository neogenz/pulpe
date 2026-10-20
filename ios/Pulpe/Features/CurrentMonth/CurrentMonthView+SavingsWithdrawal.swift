import SwiftUI

/// Opens that month's budget page with the withdrawal preview (PUL-292). The app shell
/// sets it, so this feature never reaches into the budget feature. `nil` where nothing
/// routes « À remettre »: the add sheet then hides that option.
extension EnvironmentValues {
    @Entry var requestSavingsWithdrawal: ((SavingsWithdrawalRequest) -> Void)?
}

// MARK: - Add sheet and its « À remettre » handoff
extension CurrentMonthView {
    @ViewBuilder
    func addTransactionSheet(source: FirstTransactionTracker.Source, store: CurrentMonthStore) -> some View {
        if let budget = store.budget {
            AddTransactionSheet(
                budgetId: budget.id,
                source: source,
                onRequestSavingsWithdrawal: requestSavingsWithdrawal == nil ? nil : { amount, currency, name in
                    pendingWithdrawal = SavingsWithdrawalRequest(
                        budget: budget,
                        amount: amount,
                        inputCurrency: currency,
                        source: name,
                        remaining: store.metrics.remaining
                    )
                },
                onAdd: store.addTransaction
            )
        }
    }

    /// Runs from the sheet's `onDismiss`, so the preview is never presented on top of it.
    func handOverPendingWithdrawal() {
        guard let request = pendingWithdrawal else { return }
        pendingWithdrawal = nil
        requestSavingsWithdrawal?(request)
    }
}
