import Foundation
@testable import Pulpe
import Testing

/// Pure-function tests for `BudgetDetailsProjector.project(...)`.
///
/// These verify the contract of `BudgetDetailsScreenState`: canonical section
/// order, search filtering, pre-computed indices, pager month sort, free
/// transactions partition. No UI involvement, no Observation tracking — just
/// the static derivation function.
///
/// `.serialized` because the stores read `UserDefaults` filter prefs and
/// pre-populate from the shared `BudgetDetailCache.shared` singleton; we
/// reset both before each test so cases don't bleed.
@Suite(.serialized)
@MainActor
struct BudgetDetailsScreenStateProjectionTests {
    private static let typeFilterKey = "pulpe-budget-line-type-filter"
    private static let checkedFilterKey = "pulpe-budget-checked-filter"
    private static let legacyShowOnlyUncheckedKey = "pulpe-budget-show-only-unchecked"

    private func resetEnvironment() {
        UserDefaults.standard.removeObject(forKey: Self.typeFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.checkedFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.legacyShowOnlyUncheckedKey)
        BudgetDetailCache.shared.invalidateAll()
    }

    /// Builds a fresh stack of stores. Default checked filter is `.all` so
    /// the projector returns every kind unless the test changes filters.
    /// Bundle of stores returned by `makeStores`. Avoids the 3-tuple
    /// (banned by SwiftLint's `large_tuple`).
    private struct StoreStack {
        let data: BudgetDataStore
        let filters: FiltersStore
        let sync: SyncStateStore
    }

    private func makeStores(
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

    // MARK: - Basic shape

    @Test
    func project_emptyBudget_producesEmptyState() {
        let stack = makeStores()

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        #expect(state.sections.isEmpty)
        #expect(state.free.isEmpty)
        #expect(state.kindCounts.all == 0)
        #expect(state.firstSectionKind == nil)
        #expect(state.consumptionByLineId.isEmpty)
        #expect(state.transactionsByLineId.isEmpty)
    }

    @Test
    func project_threeKinds_producesCanonicalOrder() {
        let stack = makeStores()
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense))
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "income-1", kind: .income))
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving))

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        let kinds = state.sections.map(\.kind)
        #expect(kinds == [.income, .saving, .expense])
        #expect(state.firstSectionKind == .income)
    }

    // MARK: - Filters

    @Test
    func project_typeFilterIncome_dropsOtherKinds() {
        let stack = makeStores()
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "income-1", kind: .income))
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense))
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving))
        stack.filters.setTypeFilter(.income)

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        #expect(state.sections.count == 1)
        #expect(state.sections.first?.kind == .income)

        #expect(state.kindCounts.income == 1)
        #expect(state.kindCounts.saving == 1)
        #expect(state.kindCounts.expense == 1)
        #expect(state.kindCounts.all == 3)
    }

    @Test
    func project_checkedFilterUnchecked_dropsCheckedItems() {
        let stack = makeStores(checkedFilter: .unchecked)
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "checked", kind: .expense, isChecked: true))
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "unchecked", kind: .expense, isChecked: false))

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        let visibleIds = state.sections.flatMap { section in section.items.map(\.line.id) }
        #expect(visibleIds == ["unchecked"])

        #expect(state.checkedCounts.unchecked == 1)
        #expect(state.checkedCounts.checked == 1)
        #expect(state.checkedCounts.all == 2)
    }

    // MARK: - Search

    @Test
    func project_searchByLineName_filtersSections() {
        let stack = makeStores()
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "rent", name: "Loyer", kind: .expense))
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "phone", name: "Téléphone", kind: .expense))

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: "loyer"
        )

        let visibleIds = state.sections.flatMap { section in section.items.map(\.line.id) }
        #expect(visibleIds == ["rent"])
    }

    @Test
    func project_searchByTransactionAmount_keepsLineWithMatchingTransaction() {
        let stack = makeStores()
        let line = TestDataFactory.createBudgetLine(id: "groceries", name: "Courses", kind: .expense)
        stack.data.appendBudgetLine(line)
        stack.data.appendTransaction(
            TestDataFactory.createTransaction(
                id: "tx-1", budgetLineId: "groceries", name: "Migros", amount: 42
            )
        )

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: "42"
        )

        let visibleIds = state.sections.flatMap { section in section.items.map(\.line.id) }
        #expect(visibleIds == ["groceries"])
    }

    // MARK: - Indexed lookups

    @Test
    func project_consumptionByLineId_preComputed() {
        let stack = makeStores()
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense))
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-2", amount: 500, kind: .income))
        stack.data.appendTransaction(
            TestDataFactory.createTransaction(
                id: "tx-1", budgetLineId: "line-1", amount: 250, kind: .expense
            )
        )

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        #expect(state.consumptionByLineId["line-1"]?.allocated == 250)
        #expect(state.consumptionByLineId["line-1"]?.available == 750)
        #expect(state.consumptionByLineId["line-2"]?.allocated == 0)
        #expect(state.consumptionByLineId["line-2"]?.available == 500)
    }

    @Test
    func project_transactionsByLineId_sortedDescByDate() throws {
        let stack = makeStores()
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1"))

        let older = Transaction(
            id: "old",
            budgetId: "test-budget",
            budgetLineId: "line-1",
            name: "Old",
            amount: 10,
            kind: .expense,
            transactionDate: Date(timeIntervalSince1970: 1_700_000_000),
            category: nil,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        let newer = Transaction(
            id: "new",
            budgetId: "test-budget",
            budgetLineId: "line-1",
            name: "New",
            amount: 20,
            kind: .expense,
            transactionDate: Date(timeIntervalSince1970: 1_710_000_000),
            category: nil,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        stack.data.appendTransaction(older)
        stack.data.appendTransaction(newer)

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        let txs = try #require(state.transactionsByLineId["line-1"])
        #expect(txs.map(\.id) == ["new", "old"])
    }

    // MARK: - Pager

    @Test
    func project_pagerMonths_sortedAndDropsNilMonth() {
        // Reset env to clean slate, then populate cache *after* reset so the
        // store init reads it. We can't use `makeStores()` because that one
        // also wipes the cache.
        UserDefaults.standard.removeObject(forKey: Self.typeFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.checkedFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.legacyShowOnlyUncheckedKey)
        BudgetDetailCache.shared.invalidateAll()

        BudgetDetailCache.shared.storeAllBudgets([
            TestDataFactory.createBudgetSparse(id: "b3", month: 3, year: 2026),
            TestDataFactory.createBudgetSparse(id: "b1", month: 12, year: 2025),
            TestDataFactory.createBudgetSparse(id: "bnil", month: nil, year: 2026),
            TestDataFactory.createBudgetSparse(id: "b2", month: 1, year: 2026),
        ])

        let dataStore = BudgetDataStore(budgetId: "test-budget")
        let filtersStore = FiltersStore()
        filtersStore.setCheckedFilter(.all)
        let syncStore = SyncStateStore()

        let state = BudgetDetailsProjector.project(
            dataStore: dataStore,
            filtersStore: filtersStore,
            syncStore: syncStore,
            searchText: ""
        )

        #expect(state.pagerMonths.map(\.id) == ["b1", "b2", "b3"])
        #expect(state.pagerMonths.contains { $0.id == "bnil" } == false)

        BudgetDetailCache.shared.invalidateAll()
        UserDefaults.standard.removeObject(forKey: Self.typeFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.checkedFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.legacyShowOnlyUncheckedKey)
    }

    // MARK: - Free transactions

    @Test
    func project_freeTransactions_excludesAllocated() {
        let stack = makeStores()
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1"))
        stack.data.appendTransaction(
            TestDataFactory.createTransaction(
                id: "allocated", budgetLineId: "line-1", name: "Allocated"
            )
        )
        stack.data.appendTransaction(
            TestDataFactory.createTransaction(
                id: "free", budgetLineId: nil, name: "Free"
            )
        )

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        #expect(state.free.map(\.transaction.id) == ["free"])
        #expect(state.transactionsByLineId["line-1"]?.map(\.id) == ["allocated"])
    }
}
