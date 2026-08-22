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
        mockService.stubbedSparse = sparseBudgets(september: "-4199.78", october: "-2096.80")
        let listStore = BudgetListStore(budgetService: mockService)
        await listStore.forceRefresh()
        #expect(mockService.getBudgetsSparseCallCount == 1, "Setup: initial list load")

        // User opens detail and mutates (optimistic apply ends in syncCache())
        let currentBudget = TestDataFactory.createBudget(id: "budget-september", month: 9, year: 2026)
        cache.store(budgetId: currentBudget.id, budget: currentBudget, budgetLines: [], transactions: [])
        // Dashboard store loaded too (300s TTL, projects the same sparse aggregates)
        let dashboardMock = MockBudgetService()
        let dashboardStore = DashboardStore(budgetService: dashboardMock)
        await dashboardStore.forceRefresh()
        let dashboardBaseline = dashboardMock.getBudgetsSparseCallCount

        let coordinator = BudgetDetailsCoordinator(budgetId: currentBudget.id)
        // CurrentMonthStore (concrete service, not mock-injectable) backs the
        // CurrentMonth tab; bind() must wire it into the same onMutation closure
        // whose execution the list + dashboard assertions below already prove.
        let currentMonthStore = CurrentMonthStore()
        // Goals read the same budget lines: a linked saving moves the plan, and
        // realizing an announced withdrawal (PUL-329 v2) moves the balance itself.
        let goalService = MockSavingsGoalService()
        let savingsGoalStore = SavingsGoalStore(service: goalService)
        await savingsGoalStore.forceRefresh()
        let goalBaseline = goalService.getAllCallCount
        // mirrors BudgetDetailsView's .task — wires every app-scoped store
        coordinator.bind(
            budgetListStore: listStore,
            dashboardStore: dashboardStore,
            currentMonthStore: currentMonthStore,
            savingsGoalStore: savingsGoalStore
        )
        let tx = TestDataFactory.createTransaction(id: "new-tx", budgetId: currentBudget.id)
        await coordinator.dispatch(.addTransaction(tx))

        mockService.stubbedSparse = sparseBudgets(september: "-2096.80", october: "39.18")

        if BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 1, to: 0, selectedTab: .budgets) {
            await listStore.loadIfNeeded()
        }
        #expect(
            mockService.getBudgetsSparseCallCount == 2,
            "A detail mutation must invalidate the list TTL so pop-back refetches the aggregates (PUL-270)"
        )
        assertBalances(listStore.budgets, september: "-2096.80", october: "39.18")

        // Same mutation must also mark the dashboard stale (trend chart)
        await dashboardStore.loadIfNeeded()
        #expect(
            dashboardMock.getBudgetsSparseCallCount > dashboardBaseline,
            "A detail mutation must invalidate the dashboard TTL too (PUL-270)"
        )

        // …and the goals, whose balances the same lines feed (PUL-329 v2)
        await savingsGoalStore.loadIfNeeded()
        #expect(
            goalService.getAllCallCount > goalBaseline,
            "A detail mutation must invalidate the savings-goal TTL too (PUL-270)"
        )
    }

    @Test
    func invalidationAfterVisibleReturn_refetchesListAggregates() async {
        let mockService = MockBudgetService()
        mockService.stubbedSparse = sparseBudgets(september: "-4199.78", october: "-2096.80")
        let store = BudgetListStore(budgetService: mockService)
        await store.forceRefresh()
        #expect(store.invalidationGeneration == 0)

        if BudgetListRefreshPolicy.shouldLoadAfterPathChange(from: 1, to: 0, selectedTab: .budgets) {
            await store.loadIfNeeded()
        }
        #expect(mockService.getBudgetsSparseCallCount == 1, "Visible return precedes the late invalidation")

        mockService.stubbedSparse = sparseBudgets(september: "-2096.80", october: "39.18")
        store.invalidateCache()
        #expect(store.invalidationGeneration == 1)
        if BudgetListRefreshPolicy.shouldLoadAfterInvalidation(selectedTab: .budgets, pathCount: 0) {
            await store.loadIfNeeded()
        }

        #expect(mockService.getBudgetsSparseCallCount == 2)
        assertBalances(store.budgets, september: "-2096.80", october: "39.18")
    }

    private func sparseBudgets(september: String, october: String) -> [BudgetSparse] {
        [
            TestDataFactory.createBudgetSparse(
                id: "budget-september",
                month: 9,
                year: 2026,
                remaining: Decimal(string: september)
            ),
            TestDataFactory.createBudgetSparse(
                id: "budget-october",
                month: 10,
                year: 2026,
                remaining: Decimal(string: october)
            )
        ]
    }

    private func assertBalances(_ budgets: [BudgetSparse], september: String, october: String) {
        #expect(budgets.first { $0.id == "budget-september" }?.remaining == Decimal(string: september))
        #expect(budgets.first { $0.id == "budget-october" }?.remaining == Decimal(string: october))
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

    @Test
    func invalidateCache_duringLoad_doesNotRestoreStaleTTL() async {
        let mockService = MockBudgetService()
        let stale = TestDataFactory.createBudgetSparse(id: "stale", remaining: 1)
        let fresh = TestDataFactory.createBudgetSparse(id: "fresh", remaining: 2)
        mockService.stubbedSparse = [stale]
        mockService.gateSparse()
        let store = BudgetListStore(budgetService: mockService)
        let staleLoad = Task { await store.forceRefresh() }

        await waitForCondition(timeout: .seconds(1), "sparse fetch must enter gate") {
            mockService.didEnterSparse
        }
        store.invalidateCache()
        mockService.stubbedSparse = [fresh]
        mockService.releaseSparse()
        await staleLoad.value

        await store.loadIfNeeded()

        #expect(mockService.getBudgetsSparseCallCount == 2)
        #expect(store.budgets.first?.id == fresh.id)
    }
}

// MARK: - CurrentMonthStore Mutation Seam (PUL-270)

@Suite(.serialized)
@MainActor
struct CurrentMonthStoreMutationSeamTests {
    @Test
    func addTransaction_onlyAppendsToMatchingBudget_andFiresOnMutation() {
        let store = CurrentMonthStore()
        nonisolated(unsafe) var fired = 0
        store.onMutation = { fired += 1 }
        store.addTransaction(TestDataFactory.createTransaction(id: "without-budget"))
        #expect(store.transactions.isEmpty)
        let budget = TestDataFactory.createBudget(id: "current")
        store.populateForTesting(budget: budget)
        store.addTransaction(TestDataFactory.createTransaction(id: "other", budgetId: "other"))
        #expect(store.transactions.isEmpty)
        store.addTransaction(TestDataFactory.createTransaction(id: "matching", budgetId: budget.id))
        store.addTransaction(TestDataFactory.createTransaction(id: "matching", budgetId: budget.id))
        #expect(store.transactions.map(\.id) == ["matching"])
        #expect(fired == 4, "Every confirmed mutation must invalidate sibling projections")
    }
    @Test
    func deepLinkQuickAdd_seamInvalidatesListAndDashboard() async {
        let listService = MockBudgetService()
        let dashboardService = MockBudgetService()
        let listStore = BudgetListStore(budgetService: listService)
        let dashboardStore = DashboardStore(budgetService: dashboardService)
        await listStore.forceRefresh()
        await dashboardStore.forceRefresh()
        let dashboardFetchBaseline = dashboardService.getBudgetsSparseCallCount
        let currentMonthStore = CurrentMonthStore()
        currentMonthStore.onMutation = { [listStore, dashboardStore] in
            listStore.invalidateCache()
            dashboardStore.invalidateCache()
        }
        let transaction = TestDataFactory.createTransaction(id: "deep-link-quick-add")
        currentMonthStore.populateForTesting(budget: TestDataFactory.createBudget(id: transaction.budgetId))
        currentMonthStore.addTransaction(transaction)
        let containsTransaction = currentMonthStore.transactions.contains { $0.id == transaction.id }
        #expect(containsTransaction)
        #expect(listStore.invalidationGeneration == 1)
        await listStore.loadIfNeeded()
        await dashboardStore.loadIfNeeded()
        #expect(listService.getBudgetsSparseCallCount == 2)
        #expect(
            dashboardService.getBudgetsSparseCallCount == dashboardFetchBaseline + 2,
            "Dashboard invalidation must trigger one refresh (current year + recent history)"
        )
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
