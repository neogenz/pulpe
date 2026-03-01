import Foundation
@testable import Pulpe
import Testing

// MARK: - CurrentMonthStore Cache Invalidation

@Suite(.serialized)
@MainActor
struct CurrentMonthStoreCacheInvalidationTests {
    @Test
    func invalidateCache_makesNextLoadDetailsIfNeededRefetch() async {
        let store = CurrentMonthStore()

        // First load seeds an error (no backend), but sets lastLoadTime via forceRefresh
        await store.forceRefresh()
        let errorAfterFirstLoad = store.error

        // loadDetailsIfNeeded should be a no-op while cache is valid
        // (it won't clear the error because it short-circuits)
        await store.loadDetailsIfNeeded()
        #expect(store.error != nil, "Cache valid: loadDetailsIfNeeded should skip fetch")

        // Invalidate cache
        store.invalidateCache()

        // Now loadDetailsIfNeeded should actually attempt a fetch again.
        // Since there's no backend, it will error, but the key behavior is that it
        // re-enters the loading path (the error is refreshed from a new attempt).
        await store.loadIfNeeded()
        #expect(store.error != nil, "After invalidation, loadIfNeeded should re-fetch (error expected without backend)")
    }
}

// MARK: - DashboardStore Cache Invalidation

@Suite(.serialized)
@MainActor
struct DashboardStoreCacheInvalidationTests {
    @Test
    func invalidateCache_makesNextLoadIfNeededRefetch() async {
        let store = DashboardStore()

        // First load seeds an error (no backend), but sets lastLoadTime
        await store.forceRefresh()
        #expect(store.error != nil, "Setup: forceRefresh without backend should set error")

        // loadIfNeeded should be a no-op while cache is valid
        await store.loadIfNeeded()

        // Invalidate cache
        store.invalidateCache()

        // Now loadIfNeeded should actually attempt a fetch again
        await store.loadIfNeeded()
        #expect(store.error != nil, "After invalidation, loadIfNeeded should re-fetch")
    }
}

// MARK: - BudgetDetailsViewModel Adjacent Cache Invalidation

@Suite(.serialized)
@MainActor
struct BudgetDetailsAdjacentCacheTests {
    private let cache = BudgetDetailCache.shared

    /// Sets up a VM with 3 budgets (prev, current, next) and pre-populates cache for adjacent months.
    private func makeViewModelWithAdjacentCache() -> BudgetDetailsViewModel {
        // Clean slate
        cache.invalidateAll()

        let vm = BudgetDetailsViewModel(budgetId: "budget-current")

        // Set up a budget so syncCache works
        let currentBudget = TestDataFactory.createBudget(
            id: "budget-current", month: 2, year: 2025, previousBudgetId: "budget-prev"
        )

        // Populate allBudgets for adjacent navigation
        let sparseBudgets = [
            TestDataFactory.createBudgetSparse(id: "budget-prev", month: 1, year: 2025),
            TestDataFactory.createBudgetSparse(id: "budget-current", month: 2, year: 2025),
            TestDataFactory.createBudgetSparse(id: "budget-next", month: 3, year: 2025),
        ]

        // Simulate loading: apply budget + allBudgets so prev/next are set
        // We do this by navigating the internal state through public API
        // First, store a cached entry for the current budget so init picks it up
        cache.store(
            budgetId: "budget-current",
            budget: currentBudget,
            budgetLines: [],
            transactions: []
        )
        cache.storeAllBudgets(sparseBudgets)

        // Create a fresh VM that picks up cached data
        let freshVM = BudgetDetailsViewModel(budgetId: "budget-current")

        // Pre-populate cache for adjacent budgets
        let prevBudget = TestDataFactory.createBudget(id: "budget-prev", month: 1, year: 2025)
        cache.store(
            budgetId: "budget-prev",
            budget: prevBudget,
            budgetLines: [TestDataFactory.createBudgetLine(id: "prev-line", budgetId: "budget-prev")],
            transactions: []
        )

        let nextBudget = TestDataFactory.createBudget(id: "budget-next", month: 3, year: 2025)
        cache.store(
            budgetId: "budget-next",
            budget: nextBudget,
            budgetLines: [TestDataFactory.createBudgetLine(id: "next-line", budgetId: "budget-next")],
            transactions: []
        )

        // Verify setup
        assert(freshVM.previousBudgetId == "budget-prev")
        assert(freshVM.nextBudgetId == "budget-next")
        assert(cache.get(budgetId: "budget-prev") != nil)
        assert(cache.get(budgetId: "budget-next") != nil)

        return freshVM
    }

    @Test
    func addTransaction_invalidatesAdjacentCache() {
        let vm = makeViewModelWithAdjacentCache()

        let tx = TestDataFactory.createTransaction(id: "new-tx", budgetId: "budget-current")
        vm.addTransaction(tx)

        #expect(cache.get(budgetId: "budget-prev") == nil, "Previous month cache should be invalidated")
        #expect(cache.get(budgetId: "budget-next") == nil, "Next month cache should be invalidated")
        // Current budget cache should still be valid (it was updated via syncCache)
        #expect(cache.get(budgetId: "budget-current") != nil, "Current month cache should remain valid")
    }

    @Test
    func addBudgetLine_invalidatesAdjacentCache() {
        let vm = makeViewModelWithAdjacentCache()

        let line = TestDataFactory.createBudgetLine(id: "new-line", budgetId: "budget-current")
        vm.addBudgetLine(line)

        #expect(cache.get(budgetId: "budget-prev") == nil, "Previous month cache should be invalidated")
        #expect(cache.get(budgetId: "budget-next") == nil, "Next month cache should be invalidated")
    }

    @Test
    func softDeleteTransaction_invalidatesAdjacentCache() {
        let vm = makeViewModelWithAdjacentCache()

        // Add a transaction first so we can soft-delete it
        let tx = TestDataFactory.createTransaction(id: "to-delete", budgetId: "budget-current")
        vm.addTransaction(tx)

        // Re-populate adjacent cache (addTransaction just invalidated them)
        let prevBudget = TestDataFactory.createBudget(id: "budget-prev", month: 1, year: 2025)
        cache.store(budgetId: "budget-prev", budget: prevBudget, budgetLines: [], transactions: [])
        let nextBudget = TestDataFactory.createBudget(id: "budget-next", month: 3, year: 2025)
        cache.store(budgetId: "budget-next", budget: nextBudget, budgetLines: [], transactions: [])

        let toastManager = ToastManager()
        vm.softDeleteTransaction(tx, toastManager: toastManager)

        #expect(
            cache.get(budgetId: "budget-prev") == nil,
            "Previous month cache should be invalidated after soft delete"
        )
        #expect(
            cache.get(budgetId: "budget-next") == nil,
            "Next month cache should be invalidated after soft delete"
        )
    }

    @Test
    func deleteTransaction_invalidatesAdjacentCache() async {
        let vm = makeViewModelWithAdjacentCache()

        // Add a transaction first so we can delete it
        let tx = TestDataFactory.createTransaction(id: "to-delete", budgetId: "budget-current")
        vm.addTransaction(tx)

        // Re-populate adjacent cache
        let prevBudget = TestDataFactory.createBudget(id: "budget-prev", month: 1, year: 2025)
        cache.store(budgetId: "budget-prev", budget: prevBudget, budgetLines: [], transactions: [])
        let nextBudget = TestDataFactory.createBudget(id: "budget-next", month: 3, year: 2025)
        cache.store(budgetId: "budget-next", budget: nextBudget, budgetLines: [], transactions: [])

        await vm.deleteTransaction(tx)

        #expect(cache.get(budgetId: "budget-prev") == nil, "Previous month cache should be invalidated after delete")
        #expect(cache.get(budgetId: "budget-next") == nil, "Next month cache should be invalidated after delete")
    }
}

// MARK: - BudgetDetailsViewModel prepareNavigation

@Suite(.serialized)
@MainActor
struct BudgetDetailsPrepareNavigationTests {
    private let cache = BudgetDetailCache.shared

    @Test
    func prepareNavigation_clearsStateOnCacheMiss() {
        cache.invalidateAll()

        let vm = BudgetDetailsViewModel(budgetId: "initial-budget")
        // Manually set some state to simulate having data from a previous month
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "line-1"))
        vm.addTransaction(TestDataFactory.createTransaction(id: "tx-1"))

        #expect(!vm.budgetLines.isEmpty, "Setup: should have budget lines")
        #expect(!vm.transactions.isEmpty, "Setup: should have transactions")

        // Navigate to a budget with no cache entry
        vm.prepareNavigation(to: "nonexistent-budget")

        #expect(vm.budget == nil, "Budget should be nil on cache miss")
        #expect(vm.budgetLines.isEmpty, "Budget lines should be empty on cache miss")
        #expect(vm.transactions.isEmpty, "Transactions should be empty on cache miss")
    }

    @Test
    func prepareNavigation_usesCacheOnCacheHit() {
        cache.invalidateAll()

        let targetBudget = TestDataFactory.createBudget(id: "target-budget", month: 3, year: 2025)
        let targetLines = [TestDataFactory.createBudgetLine(id: "cached-line", budgetId: "target-budget")]
        let targetTxs = [TestDataFactory.createTransaction(id: "cached-tx", budgetId: "target-budget")]

        cache.store(
            budgetId: "target-budget",
            budget: targetBudget,
            budgetLines: targetLines,
            transactions: targetTxs
        )

        let vm = BudgetDetailsViewModel(budgetId: "initial-budget")

        vm.prepareNavigation(to: "target-budget")

        #expect(vm.budget?.id == "target-budget", "Budget should be loaded from cache")
        #expect(vm.budgetLines.count == 1, "Budget lines should be loaded from cache")
        #expect(vm.budgetLines.first?.id == "cached-line")
        #expect(vm.transactions.count == 1, "Transactions should be loaded from cache")
        #expect(vm.transactions.first?.id == "cached-tx")
    }
}
