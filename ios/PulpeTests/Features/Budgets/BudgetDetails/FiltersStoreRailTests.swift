import Foundation
@testable import Pulpe
import Testing

@Suite
@MainActor
struct FiltersStoreRailTests {
    private func isolatedDefaults() throws -> UserDefaults {
        let suite = "FiltersStoreRailTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

    // MARK: - Hidden rail, restored « Pointé », « Dépassées »

    @Test
    func hiddenRail_showsEverythingWithoutForgettingTheSavedFilter() throws {
        let store = FiltersStore(defaults: try isolatedDefaults())

        store.setRailHidden(true)
        #expect(store.checkedFilter == .all)
        store.setRailHidden(false)
        #expect(store.checkedFilter == .unchecked)
    }

    @Test
    func restoredCheckedFilter_fallsBackToAllBecauseTheRailHasNoChipForIt() throws {
        let defaults = try isolatedDefaults()
        defaults.set("checked", forKey: "pulpe-budget-checked-filter")

        #expect(FiltersStore(defaults: defaults).checkedFilter == .all)
    }

    @Test
    func overFilter_countsOnlyExpensesOverBudget() {
        let expense = TestDataFactory.createBudgetLine(id: "e", kind: .expense)
        let saving = TestDataFactory.createBudgetLine(id: "s", kind: .saving)
        let over = BudgetFormulas.Consumption(allocated: 150, available: -50, percentage: 150)
        let consumption = [expense.id: over, saving.id: over]

        let lines = FiltersStore.applyCheckedFilter([expense, saving], filter: .over, consumptionByLineId: consumption)

        #expect(lines.map(\.id) == ["e"])
    }
}
