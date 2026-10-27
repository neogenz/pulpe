import SwiftUI

/// Asks before un-pointing an announced withdrawal: deleting its one realizing Réel
/// sends the money back to the goal. Raised by `pointPlannedWithdrawal`.
struct PlannedWithdrawalUndoAlert: ViewModifier {
    @Bindable var syncStore: SyncStateStore
    let currency: SupportedCurrency
    let amountsHidden: Bool
    let onConfirm: (Transaction) -> Void

    func body(content: Content) -> some View {
        content.alert(
            "Annuler ce retrait ?",
            isPresented: $syncStore.showPlannedWithdrawalUndo,
            presenting: syncStore.plannedWithdrawalUndo
        ) { undo in
            Button("Annuler le retrait", role: .destructive) {
                syncStore.resetPlannedWithdrawalUndo()
                onConfirm(undo.realization)
            }
            Button("Garder le retrait", role: .cancel) {
                syncStore.resetPlannedWithdrawalUndo()
            }
        } message: { undo in
            if amountsHidden {
                Text("Ce montant retournera sur « \(undo.goalName) ».")
            } else {
                Text("\(undo.realization.amount.asCurrency(currency)) retourneront sur « \(undo.goalName) ».")
            }
        }
    }
}
