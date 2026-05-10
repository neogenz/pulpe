import Foundation

/// Add / update / delete (hard) mutations split from the main coordinator
/// file to keep the class body under SwiftLint's `type_body_length` budget.
/// All mutations follow the same shape: optimistic local apply, server call,
/// rollback on error.
extension BudgetDetailsCoordinator {
    func addBudgetLine(_ line: BudgetLine) {
        dataStore.appendBudgetLine(line)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()
    }

    func addTransaction(_ tx: Transaction) {
        dataStore.appendTransaction(tx)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()
    }

    func updateBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }
        if dataStore.budgetLines.contains(where: { $0.id == line.id }) {
            dataStore.updateBudgetLine(line)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            dataStore.invalidateAdjacentCache()
        }
        await reloadCurrentBudget()
    }

    func updateTransaction(_ tx: Transaction) async {
        if dataStore.transactions.contains(where: { $0.id == tx.id }) {
            dataStore.updateTransaction(tx)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            dataStore.invalidateAdjacentCache()
        }
        await reloadCurrentBudget()
    }

    func deleteBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        let originalLines = dataStore.budgetLines
        dataStore.removeBudgetLine(id: line.id)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()

        do {
            try await BudgetLineService.shared.deleteBudgetLine(id: line.id)
        } catch {
            dataStore.setBudgetLines(originalLines)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }
    }

    func deleteTransaction(_ tx: Transaction) async {
        let originalTransactions = dataStore.transactions
        dataStore.removeTransaction(id: tx.id)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()

        do {
            try await TransactionService.shared.deleteTransaction(id: tx.id)
        } catch {
            dataStore.setTransactions(originalTransactions)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }
    }
}
