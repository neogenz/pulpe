import Foundation
@testable import Pulpe
import Testing

@Suite
@MainActor
struct WithdrawalRealizationProjectionTests {
    @Test("A realized goal withdrawal leaves the to-point filter")
    func uncheckedFilter_dropsAFullyRealizedGoalWithdrawalForecast() throws {
        let defaultsName = "WithdrawalRealizationProjectionTests"
        let defaults = try #require(UserDefaults(suiteName: defaultsName))
        defaults.removePersistentDomain(forName: defaultsName)
        defer { defaults.removePersistentDomain(forName: defaultsName) }

        let dataStore = BudgetDataStore(budgetId: "withdrawal-filter-budget")
        let filtersStore = FiltersStore(defaults: defaults)
        filtersStore.setCheckedFilter(.unchecked)
        let line = BudgetLine(
            id: "withdrawal-line",
            budgetId: "withdrawal-filter-budget",
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Apport cuisine",
            amount: 500,
            kind: .income,
            recurrence: .oneOff,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate,
            sourceSavingsGoalId: "goal-1",
            sourceSavingsGoalName: "Voyage"
        )
        dataStore.appendBudgetLine(line)
        dataStore.appendTransaction(TestDataFactory.createTransaction(
            budgetId: "withdrawal-filter-budget",
            budgetLineId: line.id,
            amount: 500,
            kind: .income
        ))

        let state = BudgetDetailsProjector.project(
            dataStore: dataStore,
            filtersStore: filtersStore,
            syncStore: SyncStateStore(),
            searchText: ""
        )

        #expect(state.sections.isEmpty)
    }
}
