import Foundation
@testable import Pulpe
import Testing

@MainActor
struct CurrentMonthCheckingTests {
    @Test func historyReordersForecastsAndResetClearsIt() throws {
        let store = CurrentMonthStore()
        let lines = [
            TestDataFactory.createBudgetLine(id: "salary", kind: .income),
            TestDataFactory.createBudgetLine(id: "rent", kind: .expense)
        ]
        store.populateForTesting(
            budget: TestDataFactory.createBudget(), budgetLines: lines,
            transactions: [TestDataFactory.createTransaction(id: "real")],
            checkingDays: ["rent": 1, "salary": 31]
        )
        #expect(store.uncheckedItems.map(\.id) == ["tx-real", "bl-rent", "bl-salary"])
        #expect(store.uncheckedCount == 3)
        // A check (and undo) arrives through the same shared snapshot as the budget page.
        let budget = try #require(store.budget)
        BudgetDetailCache.shared.store(
            budgetId: budget.id, budget: budget,
            budgetLines: [lines[0], lines[1].toggled()], transactions: []
        )
        #expect(store.adoptSharedSnapshotIfFresh())
        #expect(store.uncheckedItems.map(\.id) == ["bl-salary"])
        BudgetDetailCache.shared.store(budgetId: budget.id, budget: budget, budgetLines: lines, transactions: [])
        #expect(store.adoptSharedSnapshotIfFresh())
        #expect(store.uncheckedItems.map(\.id) == ["bl-rent", "bl-salary"])
        store.reset()
        store.populateForTesting(budgetLines: lines)
        #expect(store.uncheckedItems.map(\.id) == ["bl-salary", "bl-rent"])
    }
}
