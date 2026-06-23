import Foundation

/// Add / update / delete (hard) mutations split from the main coordinator
/// file to keep the class body under SwiftLint's `type_body_length` budget.
/// All mutations follow the same shape: optimistic local apply, server call,
/// rollback on error.
extension BudgetDetailsCoordinator {
    /// Late-binds the app-scoped stores projecting the same budget aggregates
    /// (list + dashboard) so every mutation below marks them stale and their
    /// next `loadIfNeeded()` refetches (PUL-270). Called from the view's
    /// `.task` because `@Environment` is unavailable in `init` — same
    /// precedent as `router.bind(to:)` in `MainTabView`. Strong captures on
    /// purpose: both stores are app-scoped and outlive this coordinator.
    func bind(budgetListStore: BudgetListStore, dashboardStore: DashboardStore) {
        dataStore.onMutation = {
            budgetListStore.invalidateCache()
            dashboardStore.invalidateCache()
        }
    }

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

    func deleteBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        let originalLines = dataStore.budgetLines
        dataStore.removeBudgetLine(id: line.id)
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()

        do {
            try await budgetLineService.deleteBudgetLine(id: line.id)
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
            try await transactionService.deleteTransaction(id: tx.id)
        } catch {
            dataStore.setTransactions(originalTransactions)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }
    }

    // MARK: - Form-driven server mutations
    //
    // Form pages (`AddAllocatedTransactionPage`, `EditTransactionPage`) need
    // the server-confirmed entity to drive their dismiss/error path. Routing
    // through `dispatch(_:)` would require shipping the error back via a
    // callback or a transient store; instead, expose typed throwing async
    // methods on the coordinator so views never reach into
    // `TransactionService.shared` directly (Rule 9 — feature architecture).

    func createAllocatedTransaction(
        _ data: TransactionCreate
    ) async throws -> Transaction {
        let transaction = try await transactionService.createTransaction(data)
        addTransaction(transaction)
        return transaction
    }

    func updateTransaction(
        id: String,
        data: TransactionUpdate
    ) async throws -> Transaction {
        let updated = try await transactionService.updateTransaction(id: id, data: data)
        if dataStore.transactions.contains(where: { $0.id == updated.id }) {
            dataStore.updateTransaction(updated)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            dataStore.invalidateAdjacentCache()
        }
        return updated
    }

    // MARK: - Spread from existing (PUL-17 v1.1)

    /// Lisse une prévision existante (total préservé). The server deletes the
    /// source line and fans out N tranches in one transaction; on success we drop
    /// the source locally, graft the M0 tranche that landed in THIS budget, and
    /// invalidate the cross-budget caches the coordinator doesn't own. Applied
    /// AFTER the server confirms (no optimistic rollback): a failure leaves the
    /// source intact and the detail page open.
    func spreadBudgetLineFromExisting(
        lineId: String,
        periods: [SpreadFromExistingPeriod],
        context: ToastContext
    ) async {
        do {
            let response = try await budgetLineService.spreadExistingBudgetLine(id: lineId, periods: periods)
            applySpreadFromExisting(removingLineId: lineId, removingTransactionId: nil, response: response)
            context.toastManager.show("C'est lissé sur \(periods.count) mois")
        } catch {
            syncStore.setError(error)
            context.toastManager.show("Le lissage n'a pas pu aboutir", type: .error)
        }
    }

    /// Lisse une transaction libre existante (total préservé). Same shape; the
    /// source is a transaction (removed locally), the N tranches are budget lines.
    func spreadTransactionFromExisting(
        txId: String,
        periods: [SpreadFromExistingPeriod],
        context: ToastContext
    ) async {
        do {
            let response = try await transactionService.spreadExistingTransaction(id: txId, periods: periods)
            applySpreadFromExisting(removingLineId: nil, removingTransactionId: txId, response: response)
            context.toastManager.show("C'est lissé sur \(periods.count) mois")
        } catch {
            syncStore.setError(error)
            context.toastManager.show("Le lissage n'a pas pu aboutir", type: .error)
        }
    }

    private func applySpreadFromExisting(
        removingLineId: String?,
        removingTransactionId: String?,
        response: BudgetLineSpreadResponse
    ) {
        if let lineId = removingLineId { dataStore.removeBudgetLine(id: lineId) }
        if let txId = removingTransactionId { dataStore.removeTransaction(id: txId) }
        // Graft the tranche that landed in the currently-open budget (M0) so the
        // screen updates immediately — same seam as the additive `onAdd`.
        if let m0Line = response.lines.first(where: { $0.budgetId == dataStore.budgetId }) {
            dataStore.appendBudgetLine(m0Line)
        }
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAdjacentCache()
        // Cross-budget: a spread touches N months the coordinator doesn't own.
        BudgetDetailCache.shared.invalidateAll()
    }
}
