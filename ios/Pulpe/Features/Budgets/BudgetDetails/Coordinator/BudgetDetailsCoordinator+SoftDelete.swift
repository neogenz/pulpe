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

        // CA9 choke point (PUL-292): a linked savings-withdrawal line must NEVER
        // be soft-deleted as a single line — that would orphan its pair. Route it
        // to the explicit choice alert instead. Every delete entry point dispatches
        // `.softDeleteBudgetLine`, so this one guard covers them all.
        guard line.savingsWithdrawalGroupId == nil else {
            syncStore.presentSavingsWithdrawalDeleteChoice(for: line)
            return
        }

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
            context.toastManager.show(AppLocale.string("Pointé"))
        } else if isPessimistic {
            let consumedText = consumed.asCurrency(context.presentationCurrency)
            let effectiveText = effective.asCurrency(context.presentationCurrency)
            context.toastManager.show(
                AppLocale.string("Pointé · \(consumedText) — \(effectiveText) prévus")
            )
        } else {
            let effectiveText = effective.asCurrency(context.presentationCurrency)
            context.toastManager.show(AppLocale.string("Pointé · \(effectiveText)"))
        }
    }

    func dispatchSideEffect(_ action: BudgetDetailsAction) async {
        switch action {
        case .showCheckToastIfNeeded(let line, let ctx, let amountsHidden):
            showCheckToastIfNeeded(for: line, context: ctx, amountsHidden: amountsHidden)
        case .resetCheckAllState:
            syncStore.resetCheckAllState()
        default:
            break
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
        let confirmed = mutationQueue.pendingSoftDeletions
        let commit: @MainActor () async -> Void = {
            await self.commitPendingSoftDeletions(confirmed)
        }
        if mutationQueue.count == 1 || context.toastManager.currentToast?.type != .undo {
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
        case .transaction(let restored, _):
            if !dataStore.transactions.contains(where: { $0.id == restored.id }) {
                dataStore.appendTransaction(restored)
            }
        case .budgetLine(let restored, _):
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
        let confirmed = mutationQueue.pendingSoftDeletions
        let commit: @MainActor () async -> Void = {
            await self.commitPendingSoftDeletions(confirmed)
        }
        context.toastManager.showWithUndo(
            copy.title,
            detail: copy.detail,
            undo: undo,
            onFinishedWithoutUndo: commit
        )
    }

    // MARK: - Snapshot filtering

    /// Strips rows still pending soft-deletion from a fetched server snapshot.
    /// The server keeps them until the undo toast commits, so a reload landing
    /// inside the undo window (pop-back restarting the screen's `.task`,
    /// pull-to-refresh) would otherwise re-display every deleted row on apply
    /// (PUL-271). Call AFTER the fetch returns: an undo landing mid-fetch pops
    /// its item from the queue, and the restored row must survive the apply.
    func filteringPendingSoftDeletions(from details: BudgetDetails) -> BudgetDetails {
        guard !mutationQueue.isEmpty else { return details }
        var lineIds = Set<String>()
        var txIds = Set<String>()
        for pending in mutationQueue.pendingSoftDeletions {
            switch pending {
            case .transaction(let tx, _):
                txIds.insert(tx.id)
            case .budgetLine(let line, _):
                lineIds.insert(line.id)
            }
        }
        return BudgetDetails(
            budget: details.budget,
            transactions: details.transactions.filter { !txIds.contains($0.id) },
            budgetLines: details.budgetLines.filter { !lineIds.contains($0.id) }
        )
    }

    /// Rapid requests share the same flush; only the latest may replace the current month.
    func prepareNavigation(to budgetId: String) async {
        navigationGeneration += 1
        let request = navigationGeneration
        // Re-selecting the current month cancels an older request still waiting on a DELETE.
        isNavigating = budgetId != dataStore.budgetId
        guard isNavigating else { return }
        defer { if request == navigationGeneration { isNavigating = false } }
        await commitPendingSoftDeletionsBeforeNavigation(request: request)
        guard request == navigationGeneration else { return }
        loadGeneration += 1
        syncStore.setLoading(false)
        syncStore.clearError()
        dataStore.prepareNavigation(to: budgetId)
    }

    /// Finalize pending soft-deletions before the screen navigates to another
    /// month. Commits them against the still-current store and drops any stale
    /// error, so neither the undo/rollback paths nor an error banner can target
    /// the next month's data (PUL-258). Must be awaited BEFORE
    /// `dataStore.prepareNavigation` swaps the budget — otherwise a failed
    /// commit re-injects into, and a stale error surfaces on, the wrong month.
    func commitPendingSoftDeletionsBeforeNavigation(request: Int? = nil) async {
        repeat {
            guard request == nil || request == navigationGeneration else { return }
            await commitPendingSoftDeletions(mutationQueue.pendingSoftDeletions)
        } while !mutationQueue.isEmpty || softDeletionCommit != nil
        syncStore.clearError()
    }

    private func commitPendingSoftDeletions(_ confirmed: [PendingBudgetDetailSoftDeletion]) async {
        let batch = mutationQueue.drain(confirmed)
        let previous = softDeletionCommit?.task
        guard !batch.isEmpty else {
            await previous?.value
            return
        }
        let id = UUID()
        let task = Task {
            await previous?.value
            await commitPendingSoftDeletionBatch(batch)
            if softDeletionCommit?.id == id { softDeletionCommit = nil }
        }
        softDeletionCommit = (id, task)
        await task.value
    }

    private func commitPendingSoftDeletionBatch(_ batch: [PendingBudgetDetailSoftDeletion]) async {
        for item in batch {
            switch item {
            case .transaction(let tx, _):
                await commitDeleteTransaction(tx)
            case .budgetLine(let line, _):
                await commitDeleteBudgetLine(line)
            }
        }
    }

    private func commitDeleteTransaction(_ tx: Transaction) async {
        do {
            try await transactionService.deleteTransaction(id: tx.id)
            // A reload racing the undo window can re-inject the row via
            // `applyDetails` (which overwrites the store and cache from the
            // server, where the row still existed). The server DELETE has now
            // succeeded, so drop the re-injected copy to keep the rendered
            // store and the detail cache consistent (PUL-264). Idempotent when
            // no reload raced — the row is already absent.
            dataStore.removeTransaction(id: tx.id)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
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
            // See `commitDeleteTransaction`: re-remove in case a reload
            // re-injected the line during the undo window (PUL-264). Idempotent.
            dataStore.removeBudgetLine(id: line.id)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
        } catch {
            dataStore.appendBudgetLine(line)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }
    }
}
