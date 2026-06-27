import Foundation

/// Postpone (report to next month) extension — PUL-22. Moving an unchecked,
/// one-off line / a free transaction to next month's budget is a hard server
/// mutation with no undo (unlike soft-delete): the row leaves the current
/// month entirely. Mirrors the `deleteBudgetLine` / `deleteTransaction` shape
/// in `+Mutations.swift` — optimistic local remove → server call → rollback on
/// error — plus a success toast naming the target month.
extension BudgetDetailsCoordinator {
    /// Routes the two postpone actions. Lives here (not the main coordinator's
    /// `dispatch*` chain) so the postpone concern stays self-contained and the
    /// coordinator file stays under the 350-LOC feature ceiling.
    func dispatchPostpone(_ action: BudgetDetailsAction) async -> Bool {
        switch action {
        case .postponeBudgetLine(let line, let ctx):
            await postponeBudgetLine(line, context: ctx)
        case .postponeTransaction(let tx, let ctx):
            await postponeTransaction(tx, context: ctx)
        default:
            return false
        }
        return true
    }

    func postponeBudgetLine(_ line: BudgetLine, context: ToastContext) async {
        // The view gates eligibility (unchecked, one-off, no allocated tx) and
        // CA5 (next-month budget exists). This guard only rejects the virtual
        // rollover line, which is never a real server entity.
        guard !(line.isRollover ?? false) else { return }

        let originalLines = dataStore.budgetLines
        let targetMonth = dataStore.nextMonthLabel
        dataStore.removeBudgetLine(id: line.id)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        // Next month gained the line; previous month is unaffected here but the
        // helper invalidates both adjacent entries so the target refetches.
        dataStore.invalidateAdjacentCache()

        do {
            _ = try await budgetLineService.postpone(id: line.id)
            showPostponeToast(context: context, targetMonth: targetMonth)
        } catch {
            dataStore.setBudgetLines(originalLines)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }
    }

    func postponeTransaction(_ transaction: Transaction, context: ToastContext) async {
        let originalTransactions = dataStore.transactions
        let targetMonth = dataStore.nextMonthLabel
        dataStore.removeTransaction(id: transaction.id)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()

        do {
            _ = try await transactionService.postpone(id: transaction.id)
            showPostponeToast(context: context, targetMonth: targetMonth)
        } catch {
            dataStore.setTransactions(originalTransactions)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }
    }

    private func showPostponeToast(context: ToastContext, targetMonth: String?) {
        if let targetMonth {
            context.toastManager.show("Reporté en \(targetMonth)")
        } else {
            context.toastManager.show("Reporté au mois suivant")
        }
    }
}
