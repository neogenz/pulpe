import Foundation
@testable import Pulpe
import Testing

@Suite("BudgetListStore Year Helpers")
@MainActor
struct BudgetListStoreYearTests {
    // MARK: - Helpers

    private func makeStore(budgets: [BudgetSparse]) -> BudgetListStore {
        BudgetListStore(initialBudgets: budgets)
    }

    // MARK: - availableYears

    @Test func availableYears_empty_returnsEmpty() {
        let store = makeStore(budgets: [])
        #expect(store.availableYears.isEmpty)
    }

    @Test func availableYears_singleYear_returnsThatYear() {
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "1", month: 1, year: 2026),
            TestDataFactory.createBudgetSparse(id: "2", month: 2, year: 2026),
        ])
        #expect(store.availableYears == [2026])
    }

    @Test func availableYears_multipleYears_sortedAscending() {
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "1", month: 6, year: 2025),
            TestDataFactory.createBudgetSparse(id: "2", month: 1, year: 2027),
            TestDataFactory.createBudgetSparse(id: "3", month: 3, year: 2026),
        ])
        #expect(store.availableYears == [2025, 2026, 2027])
    }

    // MARK: - budgets(forYear:)

    @Test func budgetsForYear_matchingYear_returnsBudgetsSortedByMonth() {
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "mar", month: 3, year: 2026),
            TestDataFactory.createBudgetSparse(id: "jan", month: 1, year: 2026),
            TestDataFactory.createBudgetSparse(id: "feb", month: 2, year: 2026),
        ])

        let result = store.budgets(forYear: 2026)
        #expect(result.count == 3)
        #expect(result[0].month == 1)
        #expect(result[1].month == 2)
        #expect(result[2].month == 3)
    }

    @Test func budgetsForYear_noMatch_returnsEmpty() {
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "1", month: 1, year: 2025),
        ])
        #expect(store.budgets(forYear: 2026).isEmpty)
    }

    @Test func budgetsForYear_filtersOtherYears() {
        let store = makeStore(budgets: [
            TestDataFactory.createBudgetSparse(id: "a", month: 6, year: 2025),
            TestDataFactory.createBudgetSparse(id: "b", month: 1, year: 2026),
            TestDataFactory.createBudgetSparse(id: "c", month: 7, year: 2025),
        ])

        let result = store.budgets(forYear: 2025)
        #expect(result.count == 2)
        #expect(result.allSatisfy { $0.year == 2025 })
    }
}
