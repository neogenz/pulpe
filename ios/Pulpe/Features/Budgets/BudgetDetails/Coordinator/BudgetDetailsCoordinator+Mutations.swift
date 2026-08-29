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
    func bind(
        budgetListStore: BudgetListStore,
        dashboardStore: DashboardStore,
        currentMonthStore: CurrentMonthStore,
        savingsGoalStore: SavingsGoalStore
    ) {
        // A value, not `dataStore`: the closure is stored on the store itself.
        let budgetId = dataStore.budgetId
        dataStore.onMutation = {
            budgetListStore.invalidateCache()
            dashboardStore.invalidateCache()
            // `syncCache()` has just written the month this mutation touched. The
            // accueil's month: the accueil takes that snapshot instead of refetching,
            // so a soft-deleted row stays gone during its undo window and comes back
            // on undo or on a failed commit, without a fetch; a cross-month spread or
            // withdrawal grafts this month before it wipes the others. Another month:
            // stale, as before, so the accueil's next load reads the cache again.
            if currentMonthStore.budget?.id == budgetId {
                currentMonthStore.adoptSharedSnapshotIfFresh()
            } else {
                currentMonthStore.invalidateCache()
            }
            // Goals read the same budget lines: a linked saving moves the plan,
            // and realizing an announced withdrawal (PUL-329 v2) moves the
            // balance itself. Stating it here rather than at each mutation site
            // keeps the one-fact seam intact.
            savingsGoalStore.invalidateFromBudgetMutation()
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

    // MARK: - Savings withdrawal (PUL-292)

    /// Grafts the Revenu-M line of a "piocher dans son épargne" couple into the
    /// open budget so its disponible updates instantly (CA7). The sheet already
    /// awaited the server (FX frozen, idempotency key) and hands back the
    /// confirmed income line. The paired Épargne lands in M+1 — a budget this
    /// coordinator doesn't own, possibly freshly created — so every detail cache
    /// is wiped to force a server-authoritative refetch on navigation (CA6),
    /// exactly like the cross-month spread graft. `syncCache()` first, as always,
    /// is the choke point firing `onMutation` (list/dashboard/currentMonth
    /// invalidation, PUL-270); its optimistic cache WRITE is then superseded by
    /// `invalidateAllCache()`.
    func graftSavingsWithdrawal(incomeLine: BudgetLine) {
        if incomeLine.budgetId == dataStore.budgetId {
            dataStore.appendBudgetLine(incomeLine)
        }
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAllCache()
    }

    /// Grouped delete with explicit choice (PUL-292, CA9). Direct server call —
    /// NO soft-delete/undo (the MutationQueue only knows single lines). Applied
    /// AFTER the server confirms (no optimistic rollback): a failure leaves the
    /// local state untouched and surfaces an explicit error toast (`syncStore`'s
    /// error is reserved for LOAD errors). On success the affected line(s) leave
    /// the open budget and every detail cache is wiped so the OTHER month
    /// refetches (`pair` touches M and M+1). Same shape as `applySpreadFromExisting`.
    func deleteSavingsWithdrawal(
        line: BudgetLine,
        scope: SavingsWithdrawalDeleteScope,
        context: ToastContext
    ) async {
        guard let groupId = line.savingsWithdrawalGroupId else { return }
        syncStore.resetSavingsWithdrawalDeleteChoice()
        syncStore.setLoading(true)
        syncStore.clearError()
        defer { syncStore.setLoading(false) }
        do {
            try await budgetLineService.deleteSavingsWithdrawal(
                groupId: groupId.uuidString.lowercased(),
                scope: scope
            )
            applySavingsWithdrawalDeletion(line, scope: scope)
            context.toastManager.show(scope.successToast)
        } catch {
            context.toastManager.show(
                AppLocale.string("La suppression n'a pas pu aboutir"),
                type: .error
            )
        }
    }

    /// Removes the affected line from the OPEN budget after a confirmed grouped
    /// delete. `pair`: both lines go, so the selected line (which lives in the
    /// open budget) is removed. `repayment`: only the M+1 saving is deleted, so
    /// the line is removed only when it IS that saving — the income of M keeps
    /// its badge. The other month is reconciled by the cache wipe.
    private func applySavingsWithdrawalDeletion(_ line: BudgetLine, scope: SavingsWithdrawalDeleteScope) {
        let removesSelectedLine = scope == .pair || line.kind == .saving
        if removesSelectedLine {
            dataStore.removeBudgetLine(id: line.id)
        }
        dataStore.recomputeMetrics()
        dataStore.syncCache()
        dataStore.invalidateAllCache()
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
        syncStore.setLoading(true)
        syncStore.clearError()
        defer { syncStore.setLoading(false) }
        do {
            let response = try await budgetLineService.spreadExistingBudgetLine(id: lineId, periods: periods)
            applySpreadFromExisting(removingLineId: lineId, removingTransactionId: nil, response: response)
            context.toastManager.show(AppLocale.string("C'est lissé sur \(periods.count) mois"))
        } catch {
            syncStore.setError(error)
            context.toastManager.show(AppLocale.string("Le lissage n'a pas pu aboutir"), type: .error)
        }
    }

    /// Lisse une transaction libre existante (total préservé). Same shape; the
    /// source is a transaction (removed locally), the N tranches are budget lines.
    func spreadTransactionFromExisting(
        txId: String,
        periods: [SpreadFromExistingPeriod],
        context: ToastContext
    ) async {
        syncStore.setLoading(true)
        syncStore.clearError()
        defer { syncStore.setLoading(false) }
        do {
            let response = try await transactionService.spreadExistingTransaction(id: txId, periods: periods)
            applySpreadFromExisting(removingLineId: nil, removingTransactionId: txId, response: response)
            context.toastManager.show(AppLocale.string("C'est lissé sur \(periods.count) mois"))
        } catch {
            syncStore.setError(error)
            context.toastManager.show(AppLocale.string("Le lissage n'a pas pu aboutir"), type: .error)
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
        // `syncCache()` first: it's the mutation choke point that fires `onMutation`
        // (invalidates the list/dashboard stores, PUL-270). Its cache WRITE is
        // deliberately superseded by `invalidateAllCache()` below — a cross-month
        // spread restructures N budgets the coordinator doesn't own, so every detail
        // cache is wiped to force a server-authoritative refetch rather than serve
        // this budget's optimistic copy.
        dataStore.syncCache()
        // `invalidateAllCache()` already wipes adjacent budgets too, so no separate
        // `invalidateAdjacentCache()` is needed on this cross-budget path.
        dataStore.invalidateAllCache()
    }
}
