import Foundation
import SwiftUI

/// Orchestrates every mutation on the BudgetDetails screen. Owns the four
/// stores (data / filters / sync / mutation queue) and routes view-layer
/// actions to the right combination of optimistic local apply, server call,
/// and rollback.
///
/// Single mutation entrypoint: `dispatch(_:)`. Views never touch stores
/// directly — they read state and forward intents through the coordinator.
@Observable @MainActor
final class BudgetDetailsCoordinator {
    let dataStore: BudgetDataStore
    let filtersStore: FiltersStore
    let syncStore: SyncStateStore
    let mutationQueue: MutationQueue

    @ObservationIgnored private let budgetService: BudgetService
    @ObservationIgnored private let budgetLineService: BudgetLineService
    @ObservationIgnored private let transactionService: TransactionService

    init(
        budgetId: String,
        budgetService: BudgetService = .shared,
        budgetLineService: BudgetLineService = .shared,
        transactionService: TransactionService = .shared,
        cache: BudgetDetailCache = .shared,
        defaults: UserDefaults = .standard
    ) {
        self.dataStore = BudgetDataStore(budgetId: budgetId, cache: cache)
        self.filtersStore = FiltersStore(defaults: defaults)
        self.syncStore = SyncStateStore()
        self.mutationQueue = MutationQueue()
        self.budgetService = budgetService
        self.budgetLineService = budgetLineService
        self.transactionService = transactionService
    }

    // MARK: - Dispatch

    /// Single mutation entrypoint. Routes by action category to keep each
    /// branch under the cyclomatic-complexity budget.
    func dispatch(_ action: BudgetDetailsAction) async {
        if await dispatchLoadOrFilter(action) { return }
        if await dispatchToggle(action) { return }
        if await dispatchBudgetLineMutation(action) { return }
        if await dispatchTransactionMutation(action) { return }
        await dispatchSideEffect(action)
    }

    private func dispatchLoadOrFilter(_ action: BudgetDetailsAction) async -> Bool {
        switch action {
        case .loadDetails(let force):
            await loadDetails(force: force)
        case .reloadCurrentBudget:
            await reloadCurrentBudget()
        case .prepareNavigation(let id):
            dataStore.prepareNavigation(to: id)
        case .setCheckedFilter(let filter):
            filtersStore.setCheckedFilter(filter)
        case .setTypeFilter(let filter):
            filtersStore.setTypeFilter(filter)
        default:
            return false
        }
        return true
    }

    private func dispatchToggle(_ action: BudgetDetailsAction) async -> Bool {
        switch action {
        case .toggleLine(let line):
            await toggleBudgetLine(line)
        case .confirmCheckAll(let line, let checkAll):
            await confirmToggle(for: line, checkAll: checkAll)
        case .toggleTransaction(let tx):
            await toggleTransaction(tx)
        default:
            return false
        }
        return true
    }

    private func dispatchBudgetLineMutation(_ action: BudgetDetailsAction) async -> Bool {
        switch action {
        case .addBudgetLine(let line):
            addBudgetLine(line)
        case .updateBudgetLine(let line):
            await updateBudgetLine(line)
        case .softDeleteBudgetLine(let line, let ctx):
            softDeleteBudgetLine(line, context: ctx)
        case .deleteBudgetLine(let line):
            await deleteBudgetLine(line)
        default:
            return false
        }
        return true
    }

    private func dispatchTransactionMutation(_ action: BudgetDetailsAction) async -> Bool {
        switch action {
        case .addTransaction(let tx):
            addTransaction(tx)
        case .updateTransaction(let tx):
            await updateTransaction(tx)
        case .softDeleteTransaction(let tx, let ctx):
            softDeleteTransaction(tx, context: ctx)
        case .deleteTransaction(let tx):
            await deleteTransaction(tx)
        default:
            return false
        }
        return true
    }

    private func dispatchSideEffect(_ action: BudgetDetailsAction) async {
        switch action {
        case .showCheckToastIfNeeded(let line, let ctx, let amountsHidden):
            showCheckToastIfNeeded(for: line, context: ctx, amountsHidden: amountsHidden)
        case .resetCheckAllState:
            syncStore.resetCheckAllState()
        default:
            break
        }
    }

    // MARK: - Loading

    /// Full load: fetches budget details AND all budgets list (for month navigation)
    /// Use for: initial load (force=false), pull-to-refresh (force=true)
    private func loadDetails(force: Bool = false) async {
        // If cache already pre-populated data, skip fetch (unless forced).
        if !force,
           dataStore.budget != nil,
           !dataStore.allBudgets.isEmpty,
           BudgetDetailCache.shared.get(budgetId: dataStore.budgetId) != nil {
            return
        }

        let showsSkeleton = dataStore.budget == nil
        syncStore.setLoading(true)
        syncStore.clearError()
        let loadStart = ContinuousClock.now
        defer { syncStore.setLoading(false) }

        do {
            async let detailsTask = budgetService.getBudgetWithDetails(id: dataStore.budgetId)
            async let budgetsTask = budgetService.getBudgetsSparse(fields: "month,year")

            let (details, budgets) = try await (detailsTask, budgetsTask)

            if showsSkeleton {
                try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)
            }

            dataStore.applyDetails(details)
            dataStore.applyAllBudgets(budgets)
        } catch is CancellationError {
            // Task was cancelled, don't update error state
        } catch {
            syncStore.setError(error)
        }
    }

    /// Light reload: fetches only current budget details (no allBudgets).
    /// Use for: after toggle, update, or month navigation.
    func reloadCurrentBudget() async {
        syncStore.setLoading(dataStore.budget == nil)
        syncStore.clearError()
        defer { syncStore.setLoading(false) }

        do {
            let details = try await budgetService.getBudgetWithDetails(id: dataStore.budgetId)
            dataStore.applyDetails(details)
        } catch is CancellationError {
            // Task was cancelled, don't update error state
        } catch {
            syncStore.setError(error)
        }
    }

    // MARK: - Toggles

    /// Returns true iff the toggle proceeded (i.e. did NOT divert to the alert).
    @discardableResult
    func toggleBudgetLine(_ line: BudgetLine) async -> Bool {
        guard !(line.isRollover ?? false) else { return false }
        guard !syncStore.isSyncing(lineId: line.id) else { return false }

        let wasUnchecked = !line.isChecked

        // If checking and there are unchecked transactions, divert to the alert.
        if wasUnchecked {
            let hasUnchecked = dataStore.transactions.contains {
                $0.budgetLineId == line.id && !$0.isChecked
            }
            if hasUnchecked {
                syncStore.presentCheckAllAlert(for: line)
                return false
            }
        }

        return await performToggleBudgetLine(line)
    }

    /// Confirms toggle after user answers the alert. Returns true if toggle succeeded.
    @discardableResult
    func confirmToggle(for line: BudgetLine, checkAll: Bool) async -> Bool {
        defer { syncStore.resetCheckAllState() }

        let succeeded = await performToggleBudgetLine(line)
        if succeeded, checkAll {
            await checkAllAllocatedTransactions(for: line.id)
        }
        return succeeded
    }

    @discardableResult
    private func performToggleBudgetLine(_ line: BudgetLine) async -> Bool {
        guard !syncStore.isSyncing(lineId: line.id) else { return false }

        syncStore.markSyncing(lineId: line.id)
        defer { syncStore.clearSyncing(lineId: line.id) }

        let originalLines = dataStore.budgetLines
        if dataStore.budgetLines.contains(where: { $0.id == line.id }) {
            dataStore.updateBudgetLine(line.toggled())
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            dataStore.invalidateAdjacentCache()
        }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            return true
        } catch {
            dataStore.setBudgetLines(originalLines)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
            return false
        }
    }

    /// Toggle all unchecked transactions for a budget line in parallel.
    private func checkAllAllocatedTransactions(for budgetLineId: String) async {
        let unchecked = dataStore.transactions.filter {
            $0.budgetLineId == budgetLineId && !$0.isChecked
        }
        guard !unchecked.isEmpty else { return }

        for tx in unchecked {
            syncStore.markSyncing(txId: tx.id)
        }
        for tx in unchecked {
            dataStore.updateTransaction(tx.toggled())
        }
        dataStore.recomputeMetrics()

        var hadFailure = false
        await withTaskGroup(of: (String, Bool).self) { group in
            for tx in unchecked {
                group.addTask { [transactionService] in
                    do {
                        _ = try await transactionService.toggleCheck(id: tx.id)
                        return (tx.id, true)
                    } catch {
                        return (tx.id, false)
                    }
                }
            }

            for await (_, success) in group where !success {
                hadFailure = true
            }
        }

        for tx in unchecked {
            syncStore.clearSyncing(txId: tx.id)
        }
        dataStore.syncCache()

        if hadFailure {
            await reloadCurrentBudget()
        }
    }

    private func toggleTransaction(_ transaction: Transaction) async {
        guard !syncStore.isSyncing(txId: transaction.id) else { return }

        syncStore.markSyncing(txId: transaction.id)

        let originalTransactions = dataStore.transactions
        if dataStore.transactions.contains(where: { $0.id == transaction.id }) {
            dataStore.updateTransaction(transaction.toggled())
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            dataStore.invalidateAdjacentCache()
        }

        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
        } catch {
            dataStore.setTransactions(originalTransactions)
            dataStore.recomputeMetrics()
            dataStore.syncCache()
            syncStore.setError(error)
        }

        syncStore.clearSyncing(txId: transaction.id)
    }
}
