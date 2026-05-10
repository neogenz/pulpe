import Foundation
import SwiftUI

/// Source of truth for the BudgetDetails screen's data — current budget,
/// budget lines, transactions, the full month list, adjacent budget ids,
/// cached metrics, and rollover info.
///
/// Owns the cache writes that keep `BudgetDetailCache.shared` in sync after
/// optimistic mutations. Owns every `BudgetFormulas.*` invocation that the
/// projector eventually consumes — the lint rule `no_formula_in_view_body`
/// excludes `State/*.swift` so this is the legitimate home for derivation
/// of metrics, sorted budgets, and display lines.
///
/// Mutated exclusively by `BudgetDetailsCoordinator`; views never write here.
@Observable @MainActor
final class BudgetDataStore {
    // MARK: - Identity

    private(set) var budgetId: String

    // MARK: - Source state

    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var allBudgets: [BudgetSparse] = []
    private(set) var previousBudgetId: String?
    private(set) var nextBudgetId: String?

    // MARK: - Caches

    @ObservationIgnored private var sortedBudgetsCache: [BudgetSparse] = []
    @ObservationIgnored private var cachedMetrics: BudgetFormulas.Metrics?
    @ObservationIgnored private var cachedRealizedMetrics: BudgetFormulas.RealizedMetrics?

    private let cache: BudgetDetailCache

    init(budgetId: String, cache: BudgetDetailCache = .shared) {
        self.budgetId = budgetId
        self.cache = cache

        // Pre-populate from cache to avoid skeleton on revisit.
        if let cached = cache.get(budgetId: budgetId) {
            self.budget = cached.budget
            self.budgetLines = cached.budgetLines
            self.transactions = cached.transactions
            recomputeMetrics()
        }
        if let cachedBudgets = cache.getAllBudgets() {
            self.allBudgets = cachedBudgets
            recomputeSortedBudgets()
            updateAdjacentBudgets()
        }
    }

    // MARK: - Read-only derivations

    var hasPreviousBudget: Bool { previousBudgetId != nil }
    var hasNextBudget: Bool { nextBudgetId != nil }

    /// Pre-sorted, null-safe view of `allBudgets` shared by `pagerMonths` and
    /// `updateAdjacentBudgets`. Recomputed only when `allBudgets` changes —
    /// avoids re-sorting on every body re-eval of the sticky pager.
    var pagerMonths: [BudgetSparse] { sortedBudgetsCache }

    var freeTransactions: [Transaction] { transactions.unallocated }

    var metrics: BudgetFormulas.Metrics {
        cachedMetrics ?? BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    /// Lazy realized metrics — computed on first access and cached.
    /// Invalidate via `invalidateRealizedMetrics()` after mutations.
    var realizedMetrics: BudgetFormulas.RealizedMetrics {
        if let cached = cachedRealizedMetrics { return cached }
        let computed = BudgetFormulas.calculateRealizedMetrics(
            budgetLines: displayBudgetLines,
            transactions: transactions
        )
        cachedRealizedMetrics = computed
        return computed
    }

    var rolloverInfo: (amount: Decimal, previousBudgetId: String?)? {
        guard let budget, let rollover = budget.rollover, rollover != 0 else {
            return nil
        }
        return (amount: rollover, previousBudgetId: budget.previousBudgetId)
    }

    /// Localized month name of the rollover source budget (e.g. "mars"). Nil
    /// if there is no rollover source or the previous budget hasn't been
    /// loaded yet.
    var previousBudgetMonth: String? {
        guard let previousId = budget?.previousBudgetId,
              let previous = allBudgets.first(where: { $0.id == previousId }),
              let month = previous.month else {
            return nil
        }
        return Formatters.monthName(for: month).lowercased()
    }

    var displayBudgetLines: [BudgetLine] {
        BudgetFormulas.displayBudgetLines(base: budgetLines, budget: budget)
    }

    // MARK: - Mutations (called by coordinator only)

    func setBudgetId(_ id: String) {
        budgetId = id
    }

    /// Apply fetched details to local state, recompute metrics, and update cache.
    func applyDetails(_ details: BudgetDetails) {
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

    func applyAllBudgets(_ budgets: [BudgetSparse]) {
        allBudgets = budgets
        recomputeSortedBudgets()
        updateAdjacentBudgets()
        cache.storeAllBudgets(budgets)
    }

    /// Prepare navigation by swapping `budgetId` synchronously. Pre-populates
    /// from cache if available, otherwise clears stale data so skeleton shows
    /// while loading.
    func prepareNavigation(to id: String) {
        budgetId = id
        if let cached = cache.get(budgetId: id) {
            budget = cached.budget
            budgetLines = cached.budgetLines
            transactions = cached.transactions
            recomputeMetrics()
            updateAdjacentBudgets()
        } else {
            budget = nil
            budgetLines = []
            transactions = []
            cachedMetrics = nil
            cachedRealizedMetrics = nil
        }
    }

    // Budget line collection mutations
    func appendBudgetLine(_ line: BudgetLine) {
        budgetLines.append(line)
    }

    func updateBudgetLine(_ line: BudgetLine) {
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line
        }
    }

    func removeBudgetLine(id: String) {
        budgetLines.removeAll { $0.id == id }
    }

    func setBudgetLines(_ lines: [BudgetLine]) {
        budgetLines = lines
    }

    // Transaction collection mutations
    func appendTransaction(_ tx: Transaction) {
        transactions.append(tx)
    }

    func updateTransaction(_ tx: Transaction) {
        if let index = transactions.firstIndex(where: { $0.id == tx.id }) {
            transactions[index] = tx
        }
    }

    func removeTransaction(id: String) {
        transactions.removeAll { $0.id == id }
    }

    func setTransactions(_ txs: [Transaction]) {
        transactions = txs
    }

    func setBudget(_ value: Budget?) {
        budget = value
    }

    // MARK: - Cache + metric helpers

    func recomputeMetrics() {
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

    func invalidateRealizedMetrics() {
        cachedRealizedMetrics = nil
    }

    /// Sync current in-memory state to the detail cache so popping back and
    /// re-entering doesn't flash stale data after an optimistic mutation.
    func syncCache() {
        guard let budget else { return }
        cache.store(budgetId: budgetId, budget: budget, budgetLines: budgetLines, transactions: transactions)
    }

    /// Invalidate cached data for adjacent months so rollover values are
    /// re-fetched when the user navigates to them.
    func invalidateAdjacentCache() {
        if let prevId = previousBudgetId { cache.invalidate(budgetId: prevId) }
        if let nextId = nextBudgetId { cache.invalidate(budgetId: nextId) }
    }

    /// Drop the current budget id from the cache. Used when prefetched data
    /// is known stale (e.g. after a server reload error path).
    func clearCacheBudgetEntry() {
        cache.invalidate(budgetId: budgetId)
    }

    // MARK: - Private helpers

    /// Recomputes the chronological view of `allBudgets`, dropping entries
    /// with a missing month or year. Call after every assignment to `allBudgets`.
    private func recomputeSortedBudgets() {
        sortedBudgetsCache = allBudgets
            .filter { $0.month != nil && $0.year != nil }
            .sorted { lhs, rhs in
                let lhsYear = lhs.year ?? 0
                let rhsYear = rhs.year ?? 0
                if lhsYear != rhsYear { return lhsYear < rhsYear }
                return (lhs.month ?? 0) < (rhs.month ?? 0)
            }
    }

    private func updateAdjacentBudgets() {
        guard let currentBudget = budget else {
            previousBudgetId = nil
            nextBudgetId = nil
            return
        }

        let sorted = sortedBudgetsCache
        guard let currentIndex = sorted.firstIndex(where: { $0.id == currentBudget.id }) else {
            previousBudgetId = nil
            nextBudgetId = nil
            return
        }

        previousBudgetId = currentIndex > 0 ? sorted[currentIndex - 1].id : nil
        nextBudgetId = currentIndex < sorted.count - 1 ? sorted[currentIndex + 1].id : nil
    }
}
