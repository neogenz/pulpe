import Foundation
@testable import Pulpe

/// Shared setup for `BudgetDetailsProjector` tests: resets the `UserDefaults` filter
/// keys and the `BudgetDetailCache` singleton before building a fresh store stack, so
/// cases in either suite can't bleed into each other. `.serialized` on both suites is
/// what makes that reset safe against parallel execution.
@MainActor
enum ProjectionTestStack {
    private static let typeFilterKey = "pulpe-budget-line-type-filter"
    private static let checkedFilterKey = "pulpe-budget-checked-filter"
    private static let legacyShowOnlyUncheckedKey = "pulpe-budget-show-only-unchecked"

    /// Bundle of stores returned by `makeStores`. Avoids the 3-tuple
    /// (banned by SwiftLint's `large_tuple`).
    struct StoreStack {
        let data: BudgetDataStore
        let filters: FiltersStore
        let sync: SyncStateStore
    }

    static func resetEnvironment() {
        UserDefaults.standard.removeObject(forKey: typeFilterKey)
        UserDefaults.standard.removeObject(forKey: checkedFilterKey)
        UserDefaults.standard.removeObject(forKey: legacyShowOnlyUncheckedKey)
        BudgetDetailCache.shared.invalidateAll()
    }

    /// Builds a fresh stack of stores. Default checked filter is `.all` so
    /// the projector returns every kind unless the test changes filters.
    static func makeStores(
        budgetId: String = "test-budget",
        checkedFilter: CheckedFilterOption = .all
    ) -> StoreStack {
        resetEnvironment()
        let dataStore = BudgetDataStore(budgetId: budgetId)
        let filtersStore = FiltersStore()
        filtersStore.setCheckedFilter(checkedFilter)
        let syncStore = SyncStateStore()
        return StoreStack(data: dataStore, filters: filtersStore, sync: syncStore)
    }

    /// `checkedTickHash` is the `value:` of the list-level `.animation(_:value:)`
    /// in `BudgetDetailsView`. Its contract: change if-and-only-if some item's
    /// `isChecked` flag flips. A hash that never changes silently kills pointage
    /// animations; one that changes on unrelated edits thrashes them.
    static func checkedTickHash(for stack: StoreStack) -> Int {
        BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        ).checkedTickHash
    }
}
