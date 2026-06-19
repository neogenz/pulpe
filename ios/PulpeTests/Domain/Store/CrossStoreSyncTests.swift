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

// MARK: - BudgetListStore Cache Invalidation (PUL-270)

@Suite(.serialized)
@MainActor
struct BudgetListStoreCacheInvalidationTests {
    private let cache = BudgetDetailCache.shared

    @Test
    func detailMutation_thenPopBack_refetchesListAggregates() async {
        cache.invalidateAll()

        // List screen loaded → TTL fresh
        let mockService = MockBudgetService()
        mockService.stubbedSparse = [
            TestDataFactory.createBudgetSparse(id: "budget-current", month: 2, year: 2025)
        ]
        let listStore = BudgetListStore(budgetService: mockService)
        await listStore.forceRefresh()
        #expect(mockService.getBudgetsSparseCallCount == 1, "Setup: initial list load")

        // User opens detail and mutates (optimistic apply ends in syncCache())
        let currentBudget = TestDataFactory.createBudget(id: "budget-current", month: 2, year: 2025)
        cache.store(budgetId: "budget-current", budget: currentBudget, budgetLines: [], transactions: [])
        // Dashboard store loaded too (300s TTL, projects the same sparse aggregates)
        let dashboardMock = MockBudgetService()
        let dashboardStore = DashboardStore(budgetService: dashboardMock)
        await dashboardStore.forceRefresh()
        let dashboardBaseline = dashboardMock.getBudgetsSparseCallCount

        let coordinator = BudgetDetailsCoordinator(budgetId: "budget-current")
        // mirrors BudgetDetailsView's .task
        coordinator.bind(budgetListStore: listStore, dashboardStore: dashboardStore)
        let tx = TestDataFactory.createTransaction(id: "new-tx", budgetId: "budget-current")
        await coordinator.dispatch(.addTransaction(tx))

        // Pop back within the 30s TTL: BudgetListView's .task re-fires loadIfNeeded()
        await listStore.loadIfNeeded()
        #expect(
            mockService.getBudgetsSparseCallCount == 2,
            "A detail mutation must invalidate the list TTL so pop-back refetches the aggregates (PUL-270)"
        )

        // Same mutation must also mark the dashboard stale (trend chart)
        await dashboardStore.loadIfNeeded()
        #expect(
            dashboardMock.getBudgetsSparseCallCount > dashboardBaseline,
            "A detail mutation must invalidate the dashboard TTL too (PUL-270)"
        )
    }

    @Test
    func invalidateCache_makesNextLoadIfNeededRefetch() async {
        let mockService = MockBudgetService()
        let store = BudgetListStore(budgetService: mockService)

        await store.forceRefresh()
        #expect(mockService.getBudgetsSparseCallCount == 1, "Setup: initial load")

        // Cache valid: loadIfNeeded must skip the fetch (TTL gate — the bug's mechanism)
        await store.loadIfNeeded()
        #expect(mockService.getBudgetsSparseCallCount == 1, "Cache valid: loadIfNeeded should skip fetch")

        store.invalidateCache()

        await store.loadIfNeeded()
        #expect(mockService.getBudgetsSparseCallCount == 2, "After invalidation, loadIfNeeded should re-fetch")
    }
}

// MARK: - CurrentMonthStore Mutation Seam (PUL-270)

@Suite(.serialized)
@MainActor
struct CurrentMonthStoreMutationSeamTests {
    @Test
    func addTransaction_firesOnMutation() {
        let store = CurrentMonthStore()
        nonisolated(unsafe) var fired = 0
        store.onMutation = { fired += 1 }

        store.addTransaction(TestDataFactory.createTransaction(id: "tx-seam"))

        #expect(fired == 1, "Amount-changing dashboard mutation must fire onMutation")
    }

    @Test
    func loadPath_doesNotFireOnMutation() async {
        let store = CurrentMonthStore()
        nonisolated(unsafe) var fired = 0
        store.onMutation = { fired += 1 }

        await store.forceRefresh()

        #expect(fired == 0, "Loads must not fire onMutation (no over-invalidation)")
    }
}

// MARK: - BudgetDataStore Mutation Seam (PUL-270)

@Suite(.serialized)
@MainActor
struct BudgetDataStoreMutationSeamTests {
    private let cache = BudgetDetailCache.shared

    @Test
    func syncCache_firesOnMutation_butLoadApplyDoesNot() {
        cache.invalidateAll()

        let budget = TestDataFactory.createBudget(id: "budget-seam", month: 2, year: 2025)
        cache.store(budgetId: "budget-seam", budget: budget, budgetLines: [], transactions: [])
        let dataStore = BudgetDataStore(budgetId: "budget-seam")

        nonisolated(unsafe) var fired = 0
        dataStore.onMutation = { fired += 1 }

        // Mutation path: syncCache fires the seam exactly once
        dataStore.syncCache()
        #expect(fired == 1, "syncCache (mutation choke point) must fire onMutation")

        // Load path: applying a server snapshot must NOT fire it (no over-invalidation)
        let details = BudgetDetails(budget: budget, transactions: [], budgetLines: [])
        dataStore.applyDetails(details, ifGenerationMatches: dataStore.mutationGeneration)
        #expect(fired == 1, "applyDetails (load path) must not fire onMutation")
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
