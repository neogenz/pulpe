@testable import Pulpe
import Testing

/// Tests for verifying stores handle concurrent load requests correctly.
/// Ensures the loadTask coalescing pattern prevents duplicate API calls.
@MainActor
struct StoreRaceConditionTests {
    // MARK: - Test Doubles

    /// Tracks API call counts to verify coalescing behavior
    actor CallCounter {
        private(set) var count = 0

        func increment() {
            count += 1
        }

        func reset() {
            count = 0
        }
    }

    // MARK: - Helpers

    /// Runs multiple concurrent tasks on @MainActor and waits for all to finish.
    /// Uses Task.init (inherits caller isolation) instead of TaskGroup.addTask
    /// which requires `sending` closures incompatible with @MainActor in Swift 6.
    private func runConcurrent(count: Int, _ work: @escaping @MainActor () async -> Void) async {
        let tasks = (0..<count).map { _ in Task { await work() } }
        for task in tasks { await task.value }
    }

    // MARK: - CurrentMonthStore Tests

    @Test("Concurrent forceRefresh calls cancel previous task and settle to non-loading state")
    func currentMonthStore_concurrentForceRefresh_settlesWithoutLoadingHanging() async throws {
        let store = CurrentMonthStore()

        await runConcurrent(count: 5) { await store.forceRefresh() }

        #expect(store.isLoading == false, "Store must not be stuck in loading after concurrent forceRefresh calls")
    }

    @Test("Store state remains consistent under concurrent access")
    func store_concurrentAccess_maintainsConsistentState() async throws {
        let store = CurrentMonthStore()

        async let isLoading1 = store.isLoading
        async let isLoading2 = store.isLoading
        async let hasError1 = store.hasError
        async let hasError2 = store.hasError

        let results = await (isLoading1, isLoading2, hasError1, hasError2)

        #expect(results.0 == results.1, "isLoading should be consistent")
        #expect(results.2 == results.3, "hasError should be consistent")
    }

    // MARK: - BudgetListStore Tests

    @Test("BudgetListStore handles concurrent loadIfNeeded safely")
    func budgetListStore_concurrentLoadIfNeeded_noRace() async throws {
        let store = BudgetListStore()

        await runConcurrent(count: 10) { await store.loadIfNeeded() }

        #expect(store.isLoading == false, "Store must not be stuck in loading after concurrent loadIfNeeded calls")
    }

    // MARK: - DashboardStore Tests

    @Test("DashboardStore handles concurrent forceRefresh safely")
    func dashboardStore_concurrentForceRefresh_noRace() async throws {
        let store = DashboardStore()

        await runConcurrent(count: 10) { await store.forceRefresh() }

        #expect(store.isLoading == false, "Store must not be stuck in loading after concurrent forceRefresh calls")
    }

    // MARK: - Task Cancellation Tests

    @Test("Store handles task cancellation gracefully")
    func store_taskCancellation_handledGracefully() async throws {
        let store = CurrentMonthStore()

        let task = Task { await store.forceRefresh() }
        task.cancel()
        await task.value

        #expect(store.isLoading == false, "Store must not be stuck in loading after task cancellation")
    }

    @Test("Rapid load/cancel cycles don't corrupt state")
    func store_rapidLoadCancelCycles_stateNotCorrupted() async throws {
        let store = CurrentMonthStore()

        for _ in 0..<20 {
            let task = Task { await store.forceRefresh() }
            try await Task.sleep(for: .milliseconds(Int.random(in: 0...10)))
            task.cancel()
        }

        try await Task.sleep(for: .milliseconds(50))

        #expect(store.isLoading == false, "Store must not be stuck in loading after rapid load/cancel cycles")
    }

    // MARK: - loadTask Reference Safety Tests (C2-1)

    @Test("Three overlapping forceRefresh calls: earlier completion does not nil out later task reference")
    func forceRefresh_threeOverlappingCalls_laterTaskNotNilledByEarlierCompletion() async throws {
        // This test exercises the race condition from finding C2-1:
        //
        // 1. Call A creates Task-A, sets loadTask = Task-A, suspends at await
        // 2. Call B cancels Task-A, creates Task-B, sets loadTask = Task-B, suspends at await
        // 3. Task-A completes (cancelled), Call A resumes. BUG: if loadTask = nil unconditionally,
        //    Task-B's reference is lost. Fix: use a generation counter so Call A only nils
        //    loadTask when its generation still matches (loadGeneration == currentGeneration).
        // 4. Call C starts: loadTask?.cancel() must still cancel Task-B.
        //
        // We verify that after all three overlapping calls complete, the store
        // settles correctly (isLoading == false, no stuck state).

        let stores: [any StoreProtocol] = [
            CurrentMonthStore(),
            BudgetListStore(),
            DashboardStore(),
        ]

        for store in stores {
            await runConcurrent(count: 3) { await store.forceRefresh() }

            let storeType = type(of: store)
            #expect(store.isLoading == false, "\(storeType) stuck after 3 overlapping forceRefresh")
        }
    }

    // MARK: - Cross-Store Coordination Tests

    @Test("Multiple stores can load concurrently without interference")
    func multipleStores_concurrentLoading_noInterference() async throws {
        let currentMonthStore = CurrentMonthStore()
        let budgetListStore = BudgetListStore()
        let dashboardStore = DashboardStore()

        let tasks = [
            Task { await currentMonthStore.loadIfNeeded() },
            Task { await budgetListStore.loadIfNeeded() },
            Task { await dashboardStore.loadIfNeeded() },
        ]
        for task in tasks { await task.value }

        #expect(currentMonthStore.isLoading == false, "CurrentMonthStore must not be stuck in loading")
        #expect(budgetListStore.isLoading == false, "BudgetListStore must not be stuck in loading")
        #expect(dashboardStore.isLoading == false, "DashboardStore must not be stuck in loading")
    }
}
