import SwiftUI

// MARK: - Routing

/// Push destination builders for `BudgetDetailsView`, split out to keep the main
/// view file under the feature's 350-LOC budget (same precedent as the
/// `BudgetLineDetailPage` ↔ `+Hero` split). The sheets live in
/// `BudgetDetailSheetContent`, shared with `EditTransactionHost`. The members used
/// here (`coordinator`, `router`, `tagStore`, `toastContext`) are declared
/// non-private on the view for this reason.
extension BudgetDetailsView {
    /// Lives here rather than on the view so the page stays under its LOC budget;
    /// every consumer is a routing or mutation call site anyway.
    var toastContext: ToastContext {
        ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
    }

    func handlePointGesture(on line: BudgetLine) {
        Task {
            await coordinator.dispatch(
                .toggleLine(line, toastContext, amountsHidden: amountsHidden)
            )
        }
    }

    @ViewBuilder
    func pushDestination(for route: BudgetLinePushRoute) -> some View {
        switch route {
        case .lineDetail(let lineId):
            BudgetLineDetailPage(
                lineId: lineId,
                tagNamesById: tagStore.namesById,
                onEditLine: { line in router.present(.editBudgetLine(line)) }
            )
            .ignoresForeignKeyboardInset()
        // Bare below: both own the field that raises the keyboard.
        case .addAllocatedTx(let lineId):
            AddAllocatedTransactionPage(lineId: lineId)
        case .editTx(let transactionId):
            EditTransactionPage(transactionId: transactionId)
        }
    }
}
