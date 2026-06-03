import Foundation
import SwiftUI

/// Soft-delete + undo extension. Holds the LIFO undo flow shared between
/// transaction and budget-line deletions: a single undo toast surfaces, the
/// label updates as more items are removed within the toast window, undo
/// pops the last item, and the toast's natural dismissal commits the batch.
extension BudgetDetailsCoordinator {
    func softDeleteTransaction(_ transaction: Transaction, context: ToastContext) {
        dataStore.removeTransaction(id: transaction.id)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()

        mutationQueue.push(.transaction(transaction))
        presentOrRefreshDeletionToast(context: context)
    }

    func softDeleteBudgetLine(_ line: BudgetLine, context: ToastContext) {
        guard !(line.isRollover ?? false) else { return }

        dataStore.removeBudgetLine(id: line.id)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()

        mutationQueue.push(.budgetLine(line))
        presentOrRefreshDeletionToast(context: context)
    }

    func showCheckToastIfNeeded(
        for line: BudgetLine,
        context: ToastContext,
        amountsHidden: Bool
    ) {
        guard !line.isChecked, line.kind.isOutflow else { return }

        let consumed = dataStore.transactions
            .filter { $0.budgetLineId == line.id && $0.isChecked && $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }
        let effective = max(line.amount, consumed)
        let isPessimistic = effective > consumed && consumed > 0

        if isPessimistic && !amountsHidden {
            ProductTips.pessimisticCheckSeen = true
        }

        if amountsHidden {
            context.toastManager.show("Pointé")
        } else if isPessimistic {
            context.toastManager.show(
                "Pointé · \(consumed.asCurrency(context.presentationCurrency)) — "
                    + "\(effective.asCurrency(context.presentationCurrency)) prévus"
            )
        } else {
            context.toastManager.show(
                "Pointé · \(effective.asCurrency(context.presentationCurrency))"
            )
        }
    }

    // MARK: - Toast presentation

    private func presentOrRefreshDeletionToast(context: ToastContext) {
        let copy = mutationQueue.deletionToastCopy(presentationCurrency: context.presentationCurrency)
        // Capture `self` strongly: the undo/commit work must outlive the view.
        // `ToastContext.toastManager` is app-scoped, so when the user leaves the
        // screen the view-scoped coordinator has to stay alive until the toast
        // resolves — otherwise the deferred server DELETE is silently dropped
        // (PUL-264). No retain cycle: the coordinator never holds the toast
        // manager, so `self` is released as soon as the toast clears.
        let undo: @MainActor () async -> Void = {
            await self.restoreLastPendingDeletion(context: context)
        }
        let commit: @MainActor () async -> Void = {
            await self.commitPendingSoftDeletions()
        }
        if mutationQueue.count == 1 {
            context.toastManager.showWithUndo(
                copy.title,
                detail: copy.detail,
                undo: undo,
                onFinishedWithoutUndo: commit
            )
        } else {
            context.toastManager.refreshUndoToast(
                message: copy.title,
                detail: copy.detail,
                undo: undo,
                onFinishedWithoutUndo: commit
            )
        }
    }

    private func restoreLastPendingDeletion(context: ToastContext) async {
        guard let pending = mutationQueue.popLast() else { return }
        switch pending {
        case .transaction(let restored):
            if !dataStore.transactions.contains(where: { $0.id == restored.id }) {
                dataStore.appendTransaction(restored)
            }
        case .budgetLine(let restored):
            if !dataStore.budgetLines.contains(where: { $0.id == restored.id }) {
                dataStore.appendBudgetLine(restored)
            }
        }
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()

        guard !mutationQueue.isEmpty else { return }

        let copy = mutationQueue.deletionToastCopy(presentationCurrency: context.presentationCurrency)
        // Strong `self` — same app-scoped lifetime rationale as the initial
        // toast presentation above (PUL-264).
        let undo: @MainActor () async -> Void = {
            await self.restoreLastPendingDeletion(context: context)
        }
        let commit: @MainActor () async -> Void = {
            await self.commitPendingSoftDeletions()
        }
        context.toastManager.showWithUndo(
            copy.title,
            detail: copy.detail,
            undo: undo,
            onFinishedWithoutUndo: commit
        )
    }

    /// Finalize pending soft-deletions before the screen navigates to another
    /// month. Commits them against the still-current store and drops any stale
    /// error, so neither the undo/rollback paths nor an error banner can target
    /// the next month's data (PUL-258). Must be awaited BEFORE
    /// `dataStore.prepareNavigation` swaps the budget — otherwise a failed
    /// commit re-injects into, and a stale error surfaces on, the wrong month.
    func commitPendingSoftDeletionsBeforeNavigation() async {
        await commitPendingSoftDeletions()
        syncStore.clearError()
    }

    private func commitPendingSoftDeletions() async {
        // The queue is the source of truth: undo already removed any restored
        // item via `popLast`, so everything still pending must be committed —
        // even if a reload re-injected the line into the store in the meantime
        // (PUL-264). A store-membership guard here would let that reload cancel
        // a deletion the user confirmed.
        let batch = mutationQueue.drainAll()
        for item in batch {
            switch item {
            case .transaction(let tx):
                await commitDeleteTransaction(tx)
            case .budgetLine(let line):
                await commitDeleteBudgetLine(line)
            }
        }
    }

    private func commitDeleteTransaction(_ tx: Transaction) async {
        do {
            try await transactionService.deleteTransaction(id: tx.id)
        } catch {
            dataStore.appendTransaction(tx)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }
    }

    private func commitDeleteBudgetLine(_ line: BudgetLine) async {
        do {
            try await budgetLineService.deleteBudgetLine(id: line.id)
        } catch {
            dataStore.appendBudgetLine(line)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }
    }
}
