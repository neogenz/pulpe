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

        // loadDetailsIfNeeded should be a no-op while cache is valid
        // (it won't clear the error because it short-circuits)
        await store.loadDetailsIfNeeded()
        #expect(store.error != nil, "Cache valid: loadDetailsIfNeeded should skip fetch")

        // Invalidate cache
        store.invalidateCache()

        // Now loadDetailsIfNeeded should actually attempt a fetch again.
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

// MARK: - BudgetDetails Adjacent Cache Invalidation

@Suite(.serialized)
@MainActor
struct BudgetDetailsAdjacentCacheTests {
    private let cache = BudgetDetailCache.shared

    /// Sets up a coordinator with 3 budgets (prev, current, next) and pre-populates cache for adjacent months.
    private func makeCoordinatorWithAdjacentCache() -> BudgetDetailsCoordinator {
        cache.invalidateAll()

        let currentBudget = TestDataFactory.createBudget(
            id: "budget-current", month: 2, year: 2025, previousBudgetId: "budget-prev"
        )

        let sparseBudgets = [
            TestDataFactory.createBudgetSparse(id: "budget-prev", month: 1, year: 2025),
            TestDataFactory.createBudgetSparse(id: "budget-current", month: 2, year: 2025),
            TestDataFactory.createBudgetSparse(id: "budget-next", month: 3, year: 2025),
        ]

        cache.store(
            budgetId: "budget-current",
            budget: currentBudget,
            budgetLines: [],
            transactions: []
        )
        cache.storeAllBudgets(sparseBudgets)

        let coord = BudgetDetailsCoordinator(budgetId: "budget-current")

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

        assert(coord.dataStore.previousBudgetId == "budget-prev")
        assert(coord.dataStore.nextBudgetId == "budget-next")
        assert(cache.get(budgetId: "budget-prev") != nil)
        assert(cache.get(budgetId: "budget-next") != nil)

        return coord
    }

    @Test
    func addTransaction_invalidatesAdjacentCache() async {
        let coord = makeCoordinatorWithAdjacentCache()

        let tx = TestDataFactory.createTransaction(id: "new-tx", budgetId: "budget-current")
        await coord.dispatch(.addTransaction(tx))

        #expect(cache.get(budgetId: "budget-prev") == nil, "Previous month cache should be invalidated")
        #expect(cache.get(budgetId: "budget-next") == nil, "Next month cache should be invalidated")
        #expect(cache.get(budgetId: "budget-current") != nil, "Current month cache should remain valid")
    }

    @Test
    func addBudgetLine_invalidatesAdjacentCache() async {
        let coord = makeCoordinatorWithAdjacentCache()

        let line = TestDataFactory.createBudgetLine(id: "new-line", budgetId: "budget-current")
        await coord.dispatch(.addBudgetLine(line))

        #expect(cache.get(budgetId: "budget-prev") == nil, "Previous month cache should be invalidated")
        #expect(cache.get(budgetId: "budget-next") == nil, "Next month cache should be invalidated")
    }

    @Test
    func softDeleteTransaction_invalidatesAdjacentCache() async {
        let coord = makeCoordinatorWithAdjacentCache()

        let tx = TestDataFactory.createTransaction(id: "to-delete", budgetId: "budget-current")
        await coord.dispatch(.addTransaction(tx))

        let prevBudget = TestDataFactory.createBudget(id: "budget-prev", month: 1, year: 2025)
        cache.store(budgetId: "budget-prev", budget: prevBudget, budgetLines: [], transactions: [])
        let nextBudget = TestDataFactory.createBudget(id: "budget-next", month: 3, year: 2025)
        cache.store(budgetId: "budget-next", budget: nextBudget, budgetLines: [], transactions: [])

        let toastManager = ToastManager()
        let ctx = ToastContext(toastManager: toastManager, presentationCurrency: .chf)
        await coord.dispatch(.softDeleteTransaction(tx, ctx))

        #expect(cache.get(budgetId: "budget-prev") == nil)
        #expect(cache.get(budgetId: "budget-next") == nil)
    }

    @Test
    func deleteTransaction_invalidatesAdjacentCache() async {
        let coord = makeCoordinatorWithAdjacentCache()

        let tx = TestDataFactory.createTransaction(id: "to-delete", budgetId: "budget-current")
        await coord.dispatch(.addTransaction(tx))

        let prevBudget = TestDataFactory.createBudget(id: "budget-prev", month: 1, year: 2025)
        cache.store(budgetId: "budget-prev", budget: prevBudget, budgetLines: [], transactions: [])
        let nextBudget = TestDataFactory.createBudget(id: "budget-next", month: 3, year: 2025)
        cache.store(budgetId: "budget-next", budget: nextBudget, budgetLines: [], transactions: [])

        await coord.dispatch(.deleteTransaction(tx))

        #expect(cache.get(budgetId: "budget-prev") == nil)
        #expect(cache.get(budgetId: "budget-next") == nil)
    }
}

// MARK: - BudgetDataStore prepareNavigation

@Suite(.serialized)
@MainActor
struct BudgetDataStorePrepareNavigationTests {
    private let cache = BudgetDetailCache.shared

    @Test
    func prepareNavigation_clearsStateOnCacheMiss() {
        cache.invalidateAll()

        let dataStore = BudgetDataStore(budgetId: "initial-budget")
        dataStore.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1"))
        dataStore.appendTransaction(TestDataFactory.createTransaction(id: "tx-1"))

        #expect(!dataStore.budgetLines.isEmpty, "Setup: should have budget lines")
        #expect(!dataStore.transactions.isEmpty, "Setup: should have transactions")

        dataStore.prepareNavigation(to: "nonexistent-budget")

        #expect(dataStore.budget == nil)
        #expect(dataStore.budgetLines.isEmpty)
        #expect(dataStore.transactions.isEmpty)
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

        let dataStore = BudgetDataStore(budgetId: "initial-budget")
        dataStore.prepareNavigation(to: "target-budget")

        #expect(dataStore.budget?.id == "target-budget")
        #expect(dataStore.budgetLines.count == 1)
        #expect(dataStore.budgetLines.first?.id == "cached-line")
        #expect(dataStore.transactions.count == 1)
        #expect(dataStore.transactions.first?.id == "cached-tx")
    }
}
