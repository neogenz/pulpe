import Foundation

extension CurrentMonthStore {
    /// Points a movement or a prévision and says so in a toast with « Annuler ». The one path
    /// every screen that points takes (Accueil, Mouvements, À pointer), so the toast and the
    /// failure copy never differ. Returns whether the server took it.
    @discardableResult
    func point(_ item: CheckableItem, toasts: ToastManager) async -> Bool {
        let didSucceed: Bool
        switch item {
        case .transaction(let transaction, _):
            didSucceed = await toggleTransaction(transaction)
        case .budgetLine(let line, _):
            didSucceed = await toggleBudgetLine(line)
        }
        if didSucceed {
            toasts.showWithUndo(
                AppLocale.string("\(item.name) pointé"),
                undo: { [self] in await undoPointing(item, toasts: toasts) },
                onFinishedWithoutUndo: {}
            )
        } else {
            toasts.show(AppLocale.string("\(item.name) n'a pas pu être pointé — réessaie"), type: .error)
        }
        return didSucceed
    }

    /// Toggles a movement from its circle: pointing says so in the toast, un-pointing is silent.
    @discardableResult
    func togglePointing(of transaction: Transaction, toasts: ToastManager) async -> Bool {
        if transaction.isChecked {
            return await toggleTransaction(transaction)
        }
        return await point(.transaction(transaction), toasts: toasts)
    }

    /// Reverses a successful pointing from the undo toast. The store toggles from the value's
    /// state, so the undone item is handed over as already pointed.
    private func undoPointing(_ item: CheckableItem, toasts: ToastManager) async {
        let didSucceed: Bool
        switch item {
        case .transaction(let transaction, _):
            didSucceed = await toggleTransaction(transaction.toggled())
        case .budgetLine(let line, _):
            didSucceed = await toggleBudgetLine(line.toggled())
        }
        if !didSucceed {
            toasts.show(
                AppLocale.string("\(item.name) n'a pas pu être annulé — réessaie depuis le budget"),
                type: .error
            )
        }
    }
}
