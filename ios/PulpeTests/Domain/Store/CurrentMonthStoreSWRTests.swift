import Foundation
@testable import Pulpe
import Testing

// MARK: - Pure Logic Tests

/// Tests the SWR cache validity algorithm in isolation.
/// Mirrors `CurrentMonthStore.isCacheValid` logic without requiring API calls.
struct CurrentMonthStoreCacheLogicTests {
    struct CacheTestCase: Sendable, CustomTestStringConvertible {
        let offset: TimeInterval?
        let expected: Bool
        let label: String

        init(_ offset: TimeInterval?, expected: Bool, _ label: String) {
            self.offset = offset
            self.expected = expected
            self.label = label
        }

        var testDescription: String {
            let offsetStr = offset.map { String(format: "%.1f", $0) } ?? "nil"
            return "\(label) (offset: \(offsetStr)s → \(expected))"
        }
    }

    static let cases: [CacheTestCase] = [
        CacheTestCase(nil, expected: false, "nil lastLoadTime"),
        CacheTestCase(-5, expected: true, "5s ago (recent)"),
        CacheTestCase(-31, expected: false, "31s ago (stale)"),
        CacheTestCase(-30, expected: false, "exactly 30s (threshold, strict <)"),
        CacheTestCase(-29, expected: true, "29s ago (just before threshold)"),
        CacheTestCase(-29.9, expected: true, "29.9s ago (edge valid)"),
        CacheTestCase(-30.1, expected: false, "30.1s ago (edge invalid)"),
        CacheTestCase(-1, expected: true, "1s ago (recent)"),
    ]

    @Test("cache validity boundary conditions", arguments: cases)
    func cacheValidity(testCase: CacheTestCase) {
        let lastLoadTime = testCase.offset.map { Date().addingTimeInterval($0) }
        #expect(Self.isCacheValid(lastLoadTime: lastLoadTime) == testCase.expected)
    }

    // MARK: - Helper

    /// Mirrors CurrentMonthStore.isCacheValid logic
    private static func isCacheValid(
        lastLoadTime: Date?,
        cacheValidity: TimeInterval = AppConfiguration.shortCacheValidity
    ) -> Bool {
        guard let lastLoad = lastLoadTime else { return false }
        return Date().timeIntervalSince(lastLoad) < cacheValidity
    }
}

// MARK: - Integration Tests

/// Tests actual `CurrentMonthStore` behavior.
/// Since `BudgetService` is a concrete actor that can't be mocked, these tests
/// exercise the store against the real (unavailable) backend. We verify loading
/// state transitions and error handling.
@Suite(.serialized)
@MainActor
struct CurrentMonthStoreSWRIntegrationTests {
    @Test func store_initialState_hasNoCacheAndNoError() {
        let store = CurrentMonthStore()

        #expect(store.budget == nil, "Initial budget should be nil")
        #expect(store.budgetLines.isEmpty, "Initial budgetLines should be empty")
        #expect(store.transactions.isEmpty, "Initial transactions should be empty")
        #expect(store.error == nil, "Initial error should be nil")
        #expect(store.isLoading == false, "Initial isLoading should be false")
    }

    @Test func loadIfNeeded_withoutCache_triggersLoad() async {
        let store = CurrentMonthStore()

        #expect(store.isLoading == false, "Initial state should not be loading")

        await store.loadIfNeeded()

        #expect(store.isLoading == false, "After completion, isLoading should be false")
        // Without a running backend, an error is expected
        #expect(store.error != nil, "Without backend, loadIfNeeded should set an error")
    }

    @Test func forceRefresh_setsErrorOnApiFailure() async {
        let store = CurrentMonthStore()

        #expect(store.error == nil, "Initial state should have no error")

        await store.forceRefresh()

        #expect(store.error != nil, "forceRefresh without backend should set error")
        #expect(store.isLoading == false, "isLoading should be reset after completion")
    }

    @Test func forceRefresh_completesWithIsLoadingFalse() async {
        let store = CurrentMonthStore()

        #expect(store.isLoading == false, "Initial state should not be loading")

        await store.forceRefresh()

        #expect(store.isLoading == false, "After completion, isLoading should be false")
    }

    @Test func forceRefresh_concurrentCalls_completeWithConsistentState() async {
        let store = CurrentMonthStore()

        // Launch two concurrent forceRefresh calls
        async let refresh1: Void = store.forceRefresh()
        async let refresh2: Void = store.forceRefresh()

        _ = await (refresh1, refresh2)

        #expect(store.isLoading == false, "After concurrent forceRefresh calls, isLoading should be false")
        #expect(store.error != nil, "Without backend, concurrent refreshes should produce an error")
    }

    @Test func loadIfNeeded_calledTwice_bothCompleteWithError() async throws {
        let store = CurrentMonthStore()

        // First load (without backend, sets error)
        await store.forceRefresh()
        try #require(store.error != nil, "Setup: first load should set error without backend")

        // Second load via loadIfNeeded
        await store.loadIfNeeded()
        #expect(store.error != nil, "Second load should also have error without backend")
        #expect(store.isLoading == false, "isLoading should be false after both loads complete")
    }
}
