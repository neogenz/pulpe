import Foundation

/// Deleting an operation from the home, with the grace period checking a line already had:
/// the row leaves the screen at once, and the server only hears about it when the undo
/// toast dismisses without an "Annuler". Deleting is the one act on this screen with no way
/// back, and the confirmation alert it replaces asked its question before the user could
/// see what the answer looked like — over a `ScrollView` row, which broke the card behind it.
///
/// Free of the view on purpose: it needs the store and the toast, never `self`. Reaching an
/// `@Environment` property off a stale copy of a view struct is not the same object (PUL-264),
/// and the closures below outlive the body evaluation that built them.
@MainActor
enum HomeDeletion {
    static func delete(
        _ transaction: Transaction,
        store: CurrentMonthStore,
        toastManager: ToastManager
    ) {
        let wasFirst = store.pendingDeletionCount == 0
        store.softDeleteTransaction(transaction)

        let message = toastMessage(latest: transaction, held: store.pendingDeletionCount)
        let undo: @MainActor () async -> Void = { store.undoPendingDeletions() }
        let commit: @MainActor () async -> Void = {
            let refused = await store.commitPendingDeletions()
            guard !refused.isEmpty else { return }
            toastManager.show(failureMessage(refused), type: .error)
        }

        if wasFirst {
            toastManager.showWithUndo(message, undo: undo, onFinishedWithoutUndo: commit)
        } else {
            // Refresh rather than re-present: replacing an undo toast fires the outgoing
            // one's commit, closing the window on rows still shown as undoable.
            toastManager.refreshUndoToast(message: message, undo: undo, onFinishedWithoutUndo: commit)
        }
    }

    /// One toast fronts every row deleted inside the window, so past the first it counts
    /// rather than names — and its single "Annuler" answers for all of them.
    static func toastMessage(latest: Transaction, held: Int) -> String {
        guard held > 1 else { return AppLocale.string("\(latest.name) supprimé") }
        return AppLocale.string("\(held) opérations supprimées")
    }

    static func failureMessage(_ refused: [Transaction]) -> String {
        guard refused.count > 1 else {
            return AppLocale.string("\(refused.first?.name ?? "") n'a pas pu être supprimé")
        }
        return AppLocale.string("\(refused.count) opérations n'ont pas pu être supprimées")
    }
}
