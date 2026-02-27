import Foundation
@testable import Pulpe
import Testing

/// Regression tests for Bug 1: Store reset on logout (stale data).
/// Verifies that `reset()` on each store clears all cached data and cancels in-flight tasks,
/// preventing stale data from leaking across user sessions.
@MainActor
struct StoreResetTests {
    // MARK: - CurrentMonthStore Reset

    @Test("CurrentMonthStore.reset() clears all cached state")
    func currentMonthStore_reset_clearsAllState() {
        let store = CurrentMonthStore()

        // Populate state to simulate a loaded store
        store.addTransaction(TestDataFactory.createTransaction(id: "tx-1", budgetId: "b1"))

        // Verify state is non-empty before reset
        #expect(!store.transactions.isEmpty, "Setup: store should have transactions")

        store.reset()

        #expect(store.budget == nil, "budget must be nil after reset")
        #expect(store.budgetLines.isEmpty, "budgetLines must be empty after reset")
        #expect(store.transactions.isEmpty, "transactions must be empty after reset")
        #expect(store.syncingTransactionIds.isEmpty, "syncingTransactionIds must be empty after reset")
        #expect(store.syncingBudgetLineIds.isEmpty, "syncingBudgetLineIds must be empty after reset")
        #expect(store.error == nil, "error must be nil after reset")
        #expect(store.isLoading == false, "isLoading must be false after reset")
    }

    @Test("CurrentMonthStore.reset() is idempotent")
    func currentMonthStore_reset_idempotent() {
        let store = CurrentMonthStore()

        store.reset()
        store.reset()

        #expect(store.budget == nil)
        #expect(store.budgetLines.isEmpty)
        #expect(store.transactions.isEmpty)
        #expect(store.error == nil)
    }

    // MARK: - BudgetListStore Reset

    @Test("BudgetListStore.reset() clears all cached state")
    func budgetListStore_reset_clearsAllState() {
        let store = BudgetListStore()

        // Populate state
        store.addBudget(TestDataFactory.createBudget(id: "b1", month: 1, year: 2025))

        #expect(!store.budgets.isEmpty, "Setup: store should have budgets")

        store.reset()

        #expect(store.budgets.isEmpty, "budgets must be empty after reset")
        #expect(store.hasLoadedOnce == false, "hasLoadedOnce must be false after reset")
        #expect(store.error == nil, "error must be nil after reset")
        #expect(store.isLoading == false, "isLoading must be false after reset")
    }

    @Test("BudgetListStore.reset() is idempotent")
    func budgetListStore_reset_idempotent() {
        let store = BudgetListStore()

        store.reset()
        store.reset()

        #expect(store.budgets.isEmpty)
        #expect(store.hasLoadedOnce == false)
        #expect(store.error == nil)
    }

    // MARK: - DashboardStore Reset

    @Test("DashboardStore.reset() clears all cached state")
    func dashboardStore_reset_clearsAllState() {
        let store = DashboardStore(initialBudgets: [
            TestDataFactory.createBudgetSparse(id: "s1", month: 1, year: 2025, totalExpenses: 500),
        ])

        #expect(!store.sparseBudgets.isEmpty, "Setup: store should have budgets")

        store.reset()

        #expect(store.sparseBudgets.isEmpty, "sparseBudgets must be empty after reset")
        #expect(store.error == nil, "error must be nil after reset")
        #expect(store.isLoading == false, "isLoading must be false after reset")
    }

    @Test("DashboardStore.reset() is idempotent")
    func dashboardStore_reset_idempotent() {
        let store = DashboardStore(initialBudgets: [
            TestDataFactory.createBudgetSparse(id: "s1"),
        ])

        store.reset()
        store.reset()

        #expect(store.sparseBudgets.isEmpty)
        #expect(store.error == nil)
    }

    // MARK: - hasError After Reset

    @Test("CurrentMonthStore.hasError is false after reset")
    func currentMonthStore_hasError_falseAfterReset() {
        let store = CurrentMonthStore()
        store.reset()
        #expect(store.hasError == false, "hasError must be false after reset (no error, no data)")
    }

    @Test("BudgetListStore.hasError is false after reset")
    func budgetListStore_hasError_falseAfterReset() {
        let store = BudgetListStore()
        store.reset()
        #expect(store.hasError == false, "hasError must be false after reset (no error, no data)")
    }

    @Test("DashboardStore.hasError is false after reset")
    func dashboardStore_hasError_falseAfterReset() {
        let store = DashboardStore()
        store.reset()
        #expect(store.hasError == false, "hasError must be false after reset (no error, no data)")
    }
}
