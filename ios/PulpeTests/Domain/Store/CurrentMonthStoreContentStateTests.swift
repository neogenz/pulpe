import Foundation
@testable import Pulpe
import Testing

/// Tests for the `ContentState` enum state machine in `CurrentMonthStore`.
/// Verifies state transitions, computed property derivation, and reset behavior.
@MainActor
struct CurrentMonthStoreContentStateTests {
    // MARK: - Initial State

    @Test func initialState_isIdle() {
        let store = CurrentMonthStore()

        #expect(store.contentState == .idle)
        #expect(store.budget == nil)
        #expect(store.isLoading == false)
        #expect(store.hasError == false)
        #expect(store.error == nil)
    }

    // MARK: - populateForTesting

    @Test func populateForTesting_withBudget_setsLoaded() {
        let store = CurrentMonthStore()

        store.populateForTesting(
            budget: TestDataFactory.createBudget()
        )

        #expect(store.contentState == .loaded)
        #expect(store.budget != nil)
    }

    @Test func populateForTesting_withoutBudget_setsEmpty() {
        let store = CurrentMonthStore()

        store.populateForTesting(budget: nil)

        #expect(store.contentState == .empty)
        #expect(store.budget == nil)
    }

    // MARK: - Computed Properties

    @Test func isLoading_derivesFromContentState() {
        let store = CurrentMonthStore()

        // .idle → not loading
        #expect(store.isLoading == false)

        // .loaded → not loading
        store.populateForTesting(budget: TestDataFactory.createBudget())
        #expect(store.isLoading == false)

        // .empty → not loading
        store.populateForTesting(budget: nil)
        #expect(store.isLoading == false)
    }

    @Test func hasError_trueOnlyWhenFailed() {
        let store = CurrentMonthStore()

        // .idle → no error
        #expect(store.hasError == false)

        // .loaded → no error (even if mutation sets store.error)
        store.populateForTesting(budget: TestDataFactory.createBudget())
        #expect(store.hasError == false)

        // .empty → no error
        store.populateForTesting(budget: nil)
        #expect(store.hasError == false)
    }

    // MARK: - Reset

    @Test func reset_returnsToIdle() {
        let store = CurrentMonthStore()

        store.populateForTesting(
            budget: TestDataFactory.createBudget(),
            budgetLines: [TestDataFactory.createBudgetLine()],
            transactions: [TestDataFactory.createTransaction()]
        )
        #expect(store.contentState == .loaded)

        store.reset()

        #expect(store.contentState == .idle)
        #expect(store.budget == nil)
        #expect(store.budgetLines.isEmpty)
        #expect(store.transactions.isEmpty)
        #expect(store.error == nil)
        #expect(store.isLoading == false)
        #expect(store.hasError == false)
    }

    @Test func reset_fromEmpty_returnsToIdle() {
        let store = CurrentMonthStore()

        store.populateForTesting(budget: nil)
        #expect(store.contentState == .empty)

        store.reset()

        #expect(store.contentState == .idle)
    }

    // MARK: - Error Path (no backend → .failed)

    @Test func forceRefresh_withoutBackend_transitionsToFailed() async {
        let store = CurrentMonthStore()

        #expect(store.contentState == .idle)

        await store.forceRefresh()

        #expect(store.contentState == .failed)
        #expect(store.error != nil)
        #expect(store.hasError == true)
        #expect(store.isLoading == false)
    }

    @Test func loadBudgetSummary_withoutBackend_transitionsToFailed() async {
        let store = CurrentMonthStore()

        #expect(store.contentState == .idle)

        await store.loadBudgetSummary()

        #expect(store.contentState == .failed)
        #expect(store.error != nil)
        #expect(store.hasError == true)
    }

    @Test func forceRefresh_afterPopulatedWithBudget_staysLoaded() async {
        let store = CurrentMonthStore()
        store.populateForTesting(budget: TestDataFactory.createBudget())

        #expect(store.contentState == .loaded)

        // forceRefresh with no backend — but budget exists, so stays .loaded
        await store.forceRefresh()

        #expect(store.contentState == .loaded)
        #expect(store.error != nil, "Error set from failed API call")
        #expect(store.hasError == false, "hasError false because contentState is .loaded, not .failed")
    }

    // MARK: - ContentState Equatable

    @Test("ContentState enum is Equatable", arguments: [
        (CurrentMonthStore.ContentState.idle, CurrentMonthStore.ContentState.idle, true),
        (CurrentMonthStore.ContentState.loading, CurrentMonthStore.ContentState.loading, true),
        (CurrentMonthStore.ContentState.loaded, CurrentMonthStore.ContentState.loaded, true),
        (CurrentMonthStore.ContentState.empty, CurrentMonthStore.ContentState.empty, true),
        (CurrentMonthStore.ContentState.failed, CurrentMonthStore.ContentState.failed, true),
        (CurrentMonthStore.ContentState.idle, CurrentMonthStore.ContentState.loading, false),
        (CurrentMonthStore.ContentState.loaded, CurrentMonthStore.ContentState.empty, false),
        (CurrentMonthStore.ContentState.loaded, CurrentMonthStore.ContentState.failed, false),
    ])
    func contentState_equatable(
        lhs: CurrentMonthStore.ContentState,
        rhs: CurrentMonthStore.ContentState,
        expected: Bool
    ) {
        #expect((lhs == rhs) == expected)
    }
}
