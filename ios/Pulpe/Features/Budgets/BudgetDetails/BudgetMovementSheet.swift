import SwiftUI

/// The movement sheet wired to the budget feature: creates under a prévision ("Noter un montant"),
/// or edits a movement ("Modifier"). It reads the open budget from the coordinator and hands the
/// shared sheet closures, so the sheet itself never reaches into this feature. Shown by
/// `BudgetDetailSheetContent` on the budget page and by `EditTransactionHost` on the accueil.
struct BudgetMovementSheet: View {
    /// The prévision a new movement starts under. `nil` for the generic "+".
    var lineId: String?
    /// The movement to edit. Set, the sheet is "Modifier".
    var transactionId: String?
    /// Set, the sheet opens as a withdrawal from a goal.
    var withdrawalStart: GoalWithdrawalStart?

    @Environment(BudgetDetailsCoordinator.self) private var coordinator
    @Environment(BudgetDetailsRouter.self) private var router
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    private var editedTransaction: Transaction? {
        transactionId.flatMap { id in coordinator.dataStore.ledgerTransactions.first { $0.id == id } }
    }

    private var toastContext: ToastContext {
        ToastContext(toastManager: appState.toastManager, presentationCurrency: userSettingsStore.currency)
    }

    var body: some View {
        let store = coordinator.dataStore
        if transactionId != nil, editedTransaction == nil {
            // The movement left the budget (deleted, synced away) while the sheet was opening.
            AutoPopView { editedTransaction == nil }
        } else {
            MovementSheet(
                context: MovementSheetContext(
                    budgetId: store.budgetId,
                    budgetLines: store.budgetLines,
                    transactions: store.ledgerTransactions,
                    rollover: store.budget?.rollover.orZero ?? 0,
                    preselectedLineId: lineId,
                    editing: editedTransaction,
                    source: .budgetDetails
                ),
                editActions: editedTransaction == nil ? nil : editActions,
                userCurrency: userSettingsStore.currency,
                withdrawalStart: withdrawalStart,
                onRequestSavingsWithdrawal: requestSavingsWithdrawal,
                onRequestNewForecast: { router.present(.addBudgetLine(.expense)) },
                onAdd: { coordinator.addTransaction($0) }
            )
        }
    }

    private var editActions: MovementSheetEditActions {
        MovementSheetEditActions(
            save: { id, data in
                // Local apply is synchronous on return; the background reload converges the rest.
                _ = try await coordinator.updateTransaction(id: id, data: data)
                Task { await coordinator.dispatch(.reloadCurrentBudget) }
            },
            delete: { tx in
                let ctx = toastContext
                Task { await coordinator.dispatch(.softDeleteTransaction(tx, ctx)) }
            },
            spread: { tx in
                guard let budget = coordinator.dataStore.budget else { return }
                router.present(.spreadExisting(SpreadExistingSource(
                    id: tx.id,
                    sourceType: .transaction,
                    kind: tx.kind,
                    name: tx.name,
                    total: tx.amount,
                    month: budget.month,
                    year: budget.year
                )))
            },
            postpone: coordinator.dataStore.hasNextMonthBudget
                ? MovementPostpone(nextMonth: coordinator.dataStore.nextMonthLabel) { tx in
                    let ctx = toastContext
                    Task { await coordinator.postponeTransaction(tx, context: ctx) }
                }
                : nil
        )
    }

    private func requestSavingsWithdrawal(amount: Decimal, currency: SupportedCurrency, source: String?) {
        guard let budget = coordinator.dataStore.budget else { return }
        router.present(.savingsWithdrawal(SavingsWithdrawalPrefill(
            budgetId: budget.id,
            anchorMonth: budget.month,
            anchorYear: budget.year,
            amount: amount,
            inputCurrency: currency,
            source: source
        )))
    }
}
