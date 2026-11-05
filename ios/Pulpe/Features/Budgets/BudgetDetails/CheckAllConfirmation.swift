import SwiftUI

/// Pointing a prévision that still has movements to point (V2 `Prevision-pointer`): ask
/// whether they go with it. Three answers, and the sheet names the movement when there is one.
struct CheckAllConfirmation: ViewModifier {
    let coordinator: BudgetDetailsCoordinator
    let transactionsByLineId: [String: [Transaction]]
    let currency: SupportedCurrency
    let amountsHidden: Bool
    let toastContext: ToastContext

    func body(content: Content) -> some View {
        @Bindable var syncStore = coordinator.syncStore

        content.sheet(
            isPresented: $syncStore.showCheckAllTransactionsAlert,
            onDismiss: {
                // "Annuler" or a swipe: the line stays as it was.
                if coordinator.syncStore.budgetLineToCheckAll != nil {
                    Task { await coordinator.dispatch(.resetCheckAllState) }
                }
            },
            content: {
                if let line = coordinator.syncStore.budgetLineToCheckAll {
                    ImpactConfirmSheet(
                        title: AppLocale.string("Pointer aussi les mouvements ?"),
                        message: Self.message(
                            lineName: line.name,
                            movements: transactionsByLineId[line.id] ?? [],
                            currency: currency,
                            amountsHidden: amountsHidden
                        ),
                        note: AppLocale.string("Pointer ne change pas ton disponible."),
                        currency: currency,
                        primary: .init(title: AppLocale.string("Oui, tout pointer")) { confirm(line, checkAll: true) },
                        secondary: .init(title: AppLocale.string("Non, juste la prévision")) {
                            confirm(line, checkAll: false)
                        }
                    )
                }
            }
        )
    }

    private func confirm(_ line: BudgetLine, checkAll: Bool) {
        Task {
            await coordinator.dispatch(
                .confirmCheckAll(line: line, checkAll: checkAll, toastContext, amountsHidden: amountsHidden)
            )
        }
    }

    /// One movement left: name it (« Migros, 84.30 le 3 novembre »). Several: count them.
    static func message(
        lineName: String,
        movements: [Transaction],
        currency: SupportedCurrency,
        amountsHidden: Bool
    ) -> String {
        let pending = movements.filter { !$0.isChecked }
        guard pending.count == 1, let movement = pending.first else {
            return AppLocale.string("\(lineName) a encore \(pending.count) mouvements à pointer.")
        }
        let amount = amountsHidden
            ? AppLocale.string("Montant masqué")
            : movement.amount.asAmount(for: currency)
        let day = Formatters.dayMonthLabel(for: movement.transactionDate)
        return AppLocale.string(
            "\(lineName) a encore 1 mouvement à pointer : \(movement.name), \(amount) le \(day)."
        )
    }
}
