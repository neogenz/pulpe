// swiftlint:disable file_length
import SwiftUI
import TipKit

// MARK: - UserDefaults Key

private enum BudgetDetailsUserDefaultsKey {
    static let showOnlyUnchecked = "pulpe-budget-show-only-unchecked"
}

// swiftlint:disable type_body_length
@Observable @MainActor
final class BudgetDetailsViewModel {
    private(set) var budgetId: String

    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    // Track IDs of items currently syncing for visual feedback
    private(set) var syncingBudgetLineIds: Set<String> = []
    private(set) var syncingTransactionIds: Set<String> = []

    // Alert state for checking all transactions when toggling an envelope
    var showCheckAllTransactionsAlert = false
    private(set) var budgetLineToCheckAll: BudgetLine?

    // Navigation between months
    private(set) var allBudgets: [BudgetSparse] = []
    private(set) var previousBudgetId: String?
    private(set) var nextBudgetId: String?

    // Filter state - persisted to UserDefaults
    private(set) var checkedFilter: CheckedFilterOption

    var isShowingOnlyUnchecked: Bool { checkedFilter == .unchecked }

    // Cached metrics to avoid recalculation on every access
    @ObservationIgnored private var cachedMetrics: BudgetFormulas.Metrics?
    @ObservationIgnored private var cachedRealizedMetrics: BudgetFormulas.RealizedMetrics?
    private var pendingDeleteTasks: [String: Task<Void, Never>] = [:]

    private let budgetService = BudgetService.shared
    private let budgetLineService = BudgetLineService.shared
    private let transactionService = TransactionService.shared
    private let cache = BudgetDetailCache.shared

    init(budgetId: String) {
        self.budgetId = budgetId
        // Load persisted filter preference (default: show only unchecked)
        let showOnlyUnchecked = UserDefaults.standard.object(
            forKey: BudgetDetailsUserDefaultsKey.showOnlyUnchecked
        ) as? Bool ?? true
        self.checkedFilter = showOnlyUnchecked ? .unchecked : .all

        // Pre-populate from cache to avoid skeleton on revisit
        if let cached = cache.get(budgetId: budgetId) {
            self.budget = cached.budget
            self.budgetLines = cached.budgetLines
            self.transactions = cached.transactions
            recomputeMetrics()
        }
        if let cachedBudgets = cache.getAllBudgets() {
            self.allBudgets = cachedBudgets
            updateAdjacentBudgets()
        }
    }

    func setCheckedFilter(_ filter: CheckedFilterOption) {
        checkedFilter = filter
        UserDefaults.standard.set(
            filter == .unchecked,
            forKey: BudgetDetailsUserDefaultsKey.showOnlyUnchecked
        )
    }

    var hasPreviousBudget: Bool { previousBudgetId != nil }
    var hasNextBudget: Bool { nextBudgetId != nil }

    /// Prepare navigation by changing the budgetId (synchronous)
    /// Pre-populates from cache if available, otherwise clears stale data so skeleton shows
    func prepareNavigation(to id: String) {
        budgetId = id
        if let cached = cache.get(budgetId: id) {
            budget = cached.budget
            budgetLines = cached.budgetLines
            transactions = cached.transactions
            recomputeMetrics()
            updateAdjacentBudgets()
        } else {
            // No cache — clear stale data so skeleton shows while loading
            budget = nil
            budgetLines = []
            transactions = []
            cachedMetrics = nil
            cachedRealizedMetrics = nil
        }
    }

    var metrics: BudgetFormulas.Metrics {
        cachedMetrics ?? BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    /// Recompute and cache metrics - call after data changes
    private func recomputeMetrics() {
        cachedMetrics = BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
        cachedRealizedMetrics = BudgetFormulas.calculateRealizedMetrics(
            budgetLines: displayBudgetLines,
            transactions: transactions
        )
    }

    /// Apply fetched details to local state, recompute metrics, and update cache.
    private func applyDetails(_ details: BudgetDetails) {
        budget = details.budget
        budgetLines = details.budgetLines
        transactions = details.transactions
        recomputeMetrics()
        updateAdjacentBudgets()
        cache.store(
            budgetId: budgetId,
            budget: details.budget,
            budgetLines: details.budgetLines,
            transactions: details.transactions
        )
    }

    /// Sync current in-memory state to the detail cache so popping back and re-entering
    /// doesn't flash stale data after an optimistic mutation.
    private func syncCache() {
        guard let budget else { return }
        cache.store(budgetId: budgetId, budget: budget, budgetLines: budgetLines, transactions: transactions)
    }

    /// Invalidate cached data for adjacent months so rollover values are re-fetched.
    private func invalidateAdjacentCache() {
        if let prevId = previousBudgetId { cache.invalidate(budgetId: prevId) }
        if let nextId = nextBudgetId { cache.invalidate(budgetId: nextId) }
    }

    var incomeLines: [BudgetLine] { budgetLines.byKind(.income) }
    var expenseLines: [BudgetLine] { budgetLines.byKind(.expense) }
    var savingLines: [BudgetLine] { budgetLines.byKind(.saving) }
    var freeTransactions: [Transaction] { transactions.unallocated }

    // MARK: - Filtered Lines (based on checked filter)

    /// Filters budget lines based on the checked filter preference
    private func applyCheckedFilter(_ lines: [BudgetLine]) -> [BudgetLine] {
        guard isShowingOnlyUnchecked else { return lines }
        return lines.filter { $0.checkedAt == nil }
    }

    var filteredIncomeLines: [BudgetLine] {
        applyCheckedFilter(incomeLines)
    }

    var filteredExpenseLines: [BudgetLine] {
        applyCheckedFilter(expenseLines)
    }

    var filteredSavingLines: [BudgetLine] {
        applyCheckedFilter(savingLines)
    }

    /// Combines checked filter + search filter for free transactions in a single pass
    func combinedFilteredFreeTransactions(searchText: String) -> [Transaction] {
        var result = freeTransactions

        if isShowingOnlyUnchecked {
            result = result.filter { $0.checkedAt == nil }
        }

        guard !searchText.isEmpty else { return result }
        return result.filter {
            $0.name.localizedStandardContains(searchText) ||
                "\($0.amount)".contains(searchText)
        }
    }

    private var displayBudgetLines: [BudgetLine] {
        BudgetFormulas.displayBudgetLines(base: budgetLines, budget: budget)
    }

    var realizedMetrics: BudgetFormulas.RealizedMetrics {
        cachedRealizedMetrics ?? BudgetFormulas.calculateRealizedMetrics(
            budgetLines: displayBudgetLines,
            transactions: transactions
        )
    }

    var rolloverInfo: (amount: Decimal, previousBudgetId: String?)? {
        guard let budget, let rollover = budget.rollover, rollover != 0 else {
            return nil
        }
        return (amount: rollover, previousBudgetId: budget.previousBudgetId)
    }

    /// Filters budget lines by name or by linked transaction names (accent and case insensitive)
    /// Performance: O(n+m) with Dictionary indexing instead of O(n×m) nested loops
    func filteredLines(_ lines: [BudgetLine], searchText: String) -> [BudgetLine] {
        guard !searchText.isEmpty else { return lines }

        // Pre-index transactions by budgetLineId for O(1) lookups - O(m)
        let transactionsByLineId = Dictionary(
            grouping: transactions,
            by: { $0.budgetLineId ?? "" }
        )

        // Filter lines with O(1) transaction lookups - O(n)
        return lines.filter { line in
            line.name.localizedStandardContains(searchText) ||
                "\(line.amount)".contains(searchText) ||
                (transactionsByLineId[line.id]?.contains {
                    $0.name.localizedStandardContains(searchText) ||
                        "\($0.amount)".contains(searchText)
                } ?? false)
        }
    }

    /// Full load: fetches budget details AND all budgets list (for month navigation)
    /// Use for: initial load (force=false), pull-to-refresh (force=true)
    func loadDetails(force: Bool = false) async {
        // If cache already pre-populated data, skip fetch (unless forced by pull-to-refresh)
        if !force, budget != nil, !allBudgets.isEmpty, cache.get(budgetId: budgetId) != nil {
            return
        }

        let showsSkeleton = budget == nil
        isLoading = true
        error = nil
        let loadStart = ContinuousClock.now
        defer { isLoading = false }

        do {
            async let detailsTask = budgetService.getBudgetWithDetails(id: budgetId)
            async let budgetsTask = budgetService.getBudgetsSparse(fields: "month,year")

            let (details, budgets) = try await (detailsTask, budgetsTask)

            if showsSkeleton {
                try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)
            }

            applyDetails(details)
            allBudgets = budgets
            cache.storeAllBudgets(budgets)
        } catch is CancellationError {
            // Task was cancelled, don't update error state
        } catch {
            self.error = error
        }
    }

    /// Light reload: fetches only current budget details (no allBudgets)
    /// Use for: after toggle, update, or month navigation
    func reloadCurrentBudget() async {
        isLoading = budget == nil
        error = nil
        defer { isLoading = false }

        do {
            let details = try await budgetService.getBudgetWithDetails(id: budgetId)
            applyDetails(details)
        } catch is CancellationError {
            // Task was cancelled, don't update error state
        } catch {
            self.error = error
        }
    }

    private func updateAdjacentBudgets() {
        guard let currentBudget = budget else {
            previousBudgetId = nil
            nextBudgetId = nil
            return
        }

        // Sort budgets chronologically
        let sorted = allBudgets.sorted { lhs, rhs in
            let lhsYear = lhs.year ?? 0
            let rhsYear = rhs.year ?? 0
            if lhsYear != rhsYear { return lhsYear < rhsYear }
            return (lhs.month ?? 0) < (rhs.month ?? 0)
        }

        guard let currentIndex = sorted.firstIndex(where: { $0.id == currentBudget.id }) else {
            previousBudgetId = nil
            nextBudgetId = nil
            return
        }

        previousBudgetId = currentIndex > 0 ? sorted[currentIndex - 1].id : nil
        nextBudgetId = currentIndex < sorted.count - 1 ? sorted[currentIndex + 1].id : nil
    }

    func toggleBudgetLine(_ line: BudgetLine) async -> Bool {
        guard !(line.isRollover ?? false) else { return false }
        guard !syncingBudgetLineIds.contains(line.id) else { return false }

        let wasUnchecked = !line.isChecked

        // If checking and there are unchecked transactions, show alert
        if wasUnchecked {
            let hasUnchecked = transactions.contains {
                $0.budgetLineId == line.id && !$0.isChecked
            }
            if hasUnchecked {
                budgetLineToCheckAll = line
                showCheckAllTransactionsAlert = true
                return false
            }
        }

        return await performToggleBudgetLine(line)
    }

    /// Confirms toggle after user answers the alert. Returns true if toggle succeeded.
    @discardableResult
    func confirmToggle(for line: BudgetLine, checkAll: Bool) async -> Bool {
        defer { resetCheckAllState() }

        let succeeded = await performToggleBudgetLine(line)
        if succeeded, checkAll {
            await checkAllAllocatedTransactions(for: line.id)
        }
        return succeeded
    }

    func resetCheckAllState() {
        budgetLineToCheckAll = nil
        showCheckAllTransactionsAlert = false
    }

    @discardableResult
    func performToggleBudgetLine(_ line: BudgetLine) async -> Bool {
        guard !syncingBudgetLineIds.contains(line.id) else { return false }

        syncingBudgetLineIds.insert(line.id)
        defer { syncingBudgetLineIds.remove(line.id) }

        let originalLines = budgetLines
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line.toggled()
            recomputeMetrics()
            syncCache()
            invalidateAdjacentCache()
        }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            return true
        } catch {
            budgetLines = originalLines
            recomputeMetrics()
            syncCache()
            self.error = error
            return false
        }
    }

    func showCheckToastIfNeeded(for line: BudgetLine, toastManager: ToastManager, amountsHidden: Bool = false) {
        guard !line.isChecked, line.kind.isOutflow else { return }

        let consumed = transactions
            .filter { $0.budgetLineId == line.id && $0.isChecked && $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }
        let effective = max(line.amount, consumed)

        if amountsHidden {
            toastManager.show("Pointé")
        } else if effective > consumed, consumed > 0 {
            toastManager.show("Pointé · \(consumed.asCHF) — \(effective.asCHF) prévus")
            ProductTips.pessimisticCheckSeen = true
            ProductTips.pessimisticCheck.invalidate(reason: .actionPerformed)
        } else {
            toastManager.show("Pointé · \(effective.asCHF)")
        }
    }

    // MARK: - Mutations

    /// Toggle all unchecked transactions for a budget line in parallel
    /// Performance: O(1) latency instead of O(n) sequential network calls
    func checkAllAllocatedTransactions(for budgetLineId: String) async {
        let unchecked = transactions.filter {
            $0.budgetLineId == budgetLineId && !$0.isChecked
        }

        guard !unchecked.isEmpty else { return }

        // Mark all as syncing
        for tx in unchecked {
            syncingTransactionIds.insert(tx.id)
        }

        // Optimistic update all at once
        for tx in unchecked {
            if let index = transactions.firstIndex(where: { $0.id == tx.id }) {
                transactions[index] = tx.toggled()
            }
        }
        recomputeMetrics()

        // Parallel API calls — track failures
        var hadFailure = false
        await withTaskGroup(of: (String, Bool).self) { group in
            for tx in unchecked {
                group.addTask {
                    do {
                        _ = try await self.transactionService.toggleCheck(id: tx.id)
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

        // Clear syncing state
        for tx in unchecked {
            syncingTransactionIds.remove(tx.id)
        }
        syncCache()

        // Only reload to reconcile if some calls failed
        if hadFailure {
            await reloadCurrentBudget()
        }
    }

    func toggleTransaction(_ transaction: Transaction) async {
        guard !syncingTransactionIds.contains(transaction.id) else { return }

        syncingTransactionIds.insert(transaction.id)

        let originalTransactions = transactions
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction.toggled()
            recomputeMetrics()
            syncCache()
            invalidateAdjacentCache()
        }

        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
        } catch {
            transactions = originalTransactions
            recomputeMetrics()
            syncCache()
            self.error = error
        }

        syncingTransactionIds.remove(transaction.id)
    }

    /// Soft delete with undo support - removes from UI immediately but delays API call
    /// Returns an undo closure that restores the transaction if called before commit
    func softDeleteTransaction(_ transaction: Transaction, toastManager: ToastManager) {
        // Cancel any pending delete for the same ID
        pendingDeleteTasks[transaction.id]?.cancel()

        // Remove from UI immediately (optimistic)
        transactions.removeAll { $0.id == transaction.id }
        recomputeMetrics()
        syncCache()
        invalidateAdjacentCache()

        // Show undo toast - actual deletion happens when toast dismisses
        toastManager.showWithUndo("Transaction supprimée") { [weak self] in
            guard let self else { return }
            self.pendingDeleteTasks[transaction.id]?.cancel()
            self.pendingDeleteTasks[transaction.id] = nil
            guard !self.transactions.contains(where: { $0.id == transaction.id }) else { return }
            self.transactions.append(transaction)
            self.recomputeMetrics()
            self.syncCache()
        }

        // Schedule actual deletion after toast timeout
        pendingDeleteTasks[transaction.id] = Task {
            defer { pendingDeleteTasks[transaction.id] = nil }
            try? await Task.sleep(for: .seconds(3.5))
            guard !Task.isCancelled else { return }
            // If transaction is still removed (not restored via undo), commit deletion
            guard !(self.transactions.contains { $0.id == transaction.id }) else { return }
            await self.commitDeleteTransaction(transaction)
        }
    }

    /// Actually delete the transaction from the server
    private func commitDeleteTransaction(_ transaction: Transaction) async {
        do {
            try await transactionService.deleteTransaction(id: transaction.id)
        } catch {
            // Restore on error
            transactions.append(transaction)
            recomputeMetrics()
            syncCache()
            self.error = error
        }
    }

    func deleteTransaction(_ transaction: Transaction) async {
        // Optimistic update
        let originalTransactions = transactions
        transactions.removeAll { $0.id == transaction.id }
        recomputeMetrics()
        syncCache()
        invalidateAdjacentCache()

        do {
            try await transactionService.deleteTransaction(id: transaction.id)
        } catch {
            transactions = originalTransactions
            recomputeMetrics()
            syncCache()
            self.error = error
        }
    }

    func addTransaction(_ transaction: Transaction) {
        transactions.append(transaction)
        recomputeMetrics()
        syncCache()
        invalidateAdjacentCache()
    }

    func addBudgetLine(_ budgetLine: BudgetLine) {
        budgetLines.append(budgetLine)
        recomputeMetrics()
        syncCache()
        invalidateAdjacentCache()
    }

    /// Soft delete with undo support - removes from UI immediately but delays API call
    func softDeleteBudgetLine(_ line: BudgetLine, toastManager: ToastManager) {
        guard !(line.isRollover ?? false) else { return }

        // Cancel any pending delete for the same ID
        pendingDeleteTasks[line.id]?.cancel()

        // Remove from UI immediately (optimistic)
        budgetLines.removeAll { $0.id == line.id }
        recomputeMetrics()
        syncCache()
        invalidateAdjacentCache()

        // Show undo toast
        toastManager.showWithUndo("Prévision supprimée") { [weak self] in
            guard let self else { return }
            self.pendingDeleteTasks[line.id]?.cancel()
            self.pendingDeleteTasks[line.id] = nil
            guard !self.budgetLines.contains(where: { $0.id == line.id }) else { return }
            self.budgetLines.append(line)
            self.recomputeMetrics()
            self.syncCache()
        }

        // Schedule actual deletion after toast timeout
        pendingDeleteTasks[line.id] = Task {
            defer { pendingDeleteTasks[line.id] = nil }
            try? await Task.sleep(for: .seconds(3.5))
            guard !Task.isCancelled else { return }
            // If budget line is still removed (not restored via undo), commit deletion
            guard !(self.budgetLines.contains { $0.id == line.id }) else { return }
            await self.commitDeleteBudgetLine(line)
        }
    }

    /// Actually delete the budget line from the server
    private func commitDeleteBudgetLine(_ line: BudgetLine) async {
        do {
            try await budgetLineService.deleteBudgetLine(id: line.id)
        } catch {
            // Restore on error
            budgetLines.append(line)
            recomputeMetrics()
            syncCache()
            self.error = error
        }
    }

    func deleteBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        // Optimistic update
        let originalLines = budgetLines
        budgetLines.removeAll { $0.id == line.id }
        recomputeMetrics()
        syncCache()
        invalidateAdjacentCache()

        do {
            try await budgetLineService.deleteBudgetLine(id: line.id)
        } catch {
            budgetLines = originalLines
            recomputeMetrics()
            syncCache()
            self.error = error
        }
    }

    func updateBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        // Optimistic update
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line
            recomputeMetrics()
            syncCache()
            invalidateAdjacentCache()
        }

        // Reload to sync with server
        await reloadCurrentBudget()
    }

    func updateTransaction(_ transaction: Transaction) async {
        // Optimistic update
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
            recomputeMetrics()
            syncCache()
            invalidateAdjacentCache()
        }

        // Reload to sync with server
        await reloadCurrentBudget()
    }
}
