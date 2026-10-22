import Foundation

/// Deleting a month from its detail screen (PUL-361). The view only offers it on a future
/// month; the server owns that rule and the link handshake, so a refusal lands in the
/// failure toast.
extension BudgetDetailsCoordinator {
    /// What the delete would remove, read fresh before the confirmation alert. The id is the
    /// caller's, captured at tap time: the open month can change while the request is on the wire.
    func monthDeletionImpact(budgetId: String) async throws -> BudgetDeletionImpact {
        try await budgetService.getDeletionImpact(id: budgetId)
    }

    /// Applied AFTER the server confirms (no optimistic removal): a failure leaves the
    /// screen and its cache untouched and shows an error toast.
    func dispatchMonthDeletion(_ action: BudgetDetailsAction) async -> Bool {
        guard case .deleteMonth(let budgetId, let confirmLinks, let context, let onDeleted) = action else {
            return false
        }
        guard !isDeletingMonth else { return true }
        isDeletingMonth = true
        defer { isDeletingMonth = false }
        // A still-pending undo toast would otherwise commit after the month is gone and
        // write the deleted month back into the detail cache.
        await commitPendingSoftDeletionsBeforeNavigation()
        do {
            try await budgetService.deleteBudget(id: budgetId, confirmLinks: confirmLinks)
        } catch {
            context.toastManager.show(AppLocale.string("Le mois n'a pas pu être supprimé"), type: .error)
            return true
        }
        // `onMutation` fires the stale-marking (list, dashboard, current month and goals) directly,
        // not through `syncCache()`: that returns early once a pager swipe left the store without a
        // budget, and its cache write is superseded by the wipe below anyway. The wipe also drops
        // the neighbours: the month no longer exists, so no entry may serve it and the rollover of
        // the months around it has to refetch.
        dataStore.onMutation?()
        dataStore.invalidateAllCache()
        context.toastManager.show(AppLocale.string("Mois supprimé"))
        onDeleted()
        return true
    }
}
