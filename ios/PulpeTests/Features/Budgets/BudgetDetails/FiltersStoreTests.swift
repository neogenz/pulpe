import Foundation
@testable import Pulpe
import Testing

/// Clear both the legacy Bool key and the post-Wave-A String rawValue key so
/// `.checked` state from one test cannot bleed into the next via UserDefaults.
private func clearFilterPrefs() {
    UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked")
    UserDefaults.standard.removeObject(forKey: "pulpe-budget-checked-filter")
    UserDefaults.standard.removeObject(forKey: "pulpe-budget-line-type-filter")
}

@Suite(.serialized)
@MainActor
struct FiltersStoreTests {
    // MARK: - Default filter behavior

    @Test
    func defaultFilter_showsOnlyUncheckedItems() {
        clearFilterPrefs()
        let store = FiltersStore()
        defer { clearFilterPrefs() }

        #expect(store.isShowingOnlyUnchecked)
        #expect(store.checkedFilter == .unchecked)
    }

    // MARK: - Filter persistence

    @Test
    func filterPreference_persistsToUserDefaults() {
        clearFilterPrefs()
        let store = FiltersStore()
        defer { clearFilterPrefs() }

        store.setCheckedFilter(.all)

        let persistedValue = UserDefaults.standard.bool(forKey: "pulpe-budget-show-only-unchecked")
        #expect(!persistedValue)
    }

    @Test
    func filterPreference_restoredOnInit() {
        defer { clearFilterPrefs() }
        UserDefaults.standard.set(false, forKey: "pulpe-budget-show-only-unchecked")
        let store = FiltersStore()

        #expect(store.checkedFilter == .all)
        #expect(!store.isShowingOnlyUnchecked)
    }

    @Test
    func toggleFilter_switchesBetweenModes() {
        clearFilterPrefs()
        let store = FiltersStore()
        defer { clearFilterPrefs() }

        #expect(store.checkedFilter == .unchecked)

        store.setCheckedFilter(.all)
        #expect(store.checkedFilter == .all)
        #expect(!store.isShowingOnlyUnchecked)

        store.setCheckedFilter(.unchecked)
        #expect(store.checkedFilter == .unchecked)
        #expect(store.isShowingOnlyUnchecked)
    }

    // MARK: - Type filter persistence

    @Test
    func setTypeFilter_persistsAcrossInit() {
        clearFilterPrefs()
        defer { clearFilterPrefs() }

        let first = FiltersStore()
        first.setTypeFilter(.income)

        let recreated = FiltersStore()
        #expect(recreated.typeFilter == .income)
    }

    /// Regression test: the `.checked` raw value must survive a relaunch.
    /// The earlier persistence path relied on a legacy Bool key that collapsed
    /// `.checked` onto `.all`, dropping the third state on restore.
    @Test
    func setCheckedFilter_persistsRawValue_acrossInit() {
        clearFilterPrefs()
        defer { clearFilterPrefs() }

        let first = FiltersStore()
        first.setCheckedFilter(.checked)

        let recreated = FiltersStore()
        #expect(recreated.checkedFilter == .checked)
    }
}

// MARK: - Pure derivations

@Suite(.serialized)
@MainActor
struct FiltersStorePureTests {
    // MARK: - Budget Line Filter Rules

    @Test
    func applyCheckedFilter_unchecked_excludesCheckedItems() {
        let unchecked = TestDataFactory.createBudgetLine(id: "1", kind: .income)
        let checked = TestDataFactory.createBudgetLine(id: "2", kind: .income, isChecked: true)

        let filtered = FiltersStore.applyCheckedFilter([unchecked, checked], filter: .unchecked)

        #expect(filtered.count == 1)
        #expect(filtered.first?.id == "1")
    }

    @Test
    func applyCheckedFilter_all_includesAllItems() {
        let unchecked = TestDataFactory.createBudgetLine(id: "1", kind: .income)
        let checked = TestDataFactory.createBudgetLine(id: "2", kind: .income, isChecked: true)

        let filtered = FiltersStore.applyCheckedFilter([unchecked, checked], filter: .all)

        #expect(filtered.count == 2)
    }

    @Test
    func applyCheckedFilter_checked_returnsOnlyChecked() {
        let unchecked = TestDataFactory.createBudgetLine(id: "1", kind: .expense)
        let checked = TestDataFactory.createBudgetLine(id: "2", kind: .expense, isChecked: true)

        let filtered = FiltersStore.applyCheckedFilter([unchecked, checked], filter: .checked)

        #expect(filtered.count == 1)
        #expect(filtered.first?.id == "2")
    }

    @Test
    func applyCheckedFilter_emptyList_returnsEmptyList() {
        let filtered = FiltersStore.applyCheckedFilter([], filter: .unchecked)
        #expect(filtered.isEmpty)
    }

    // MARK: - Displayed sections

    @Test
    func displayedSections_typeFilterAll_returnsAllKindsInOrder() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense),
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income),
            TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving),
        ]

        let sections = FiltersStore.displayedSections(
            for: lines,
            typeFilter: .all,
            checkedFilter: .all
        )

        #expect(sections.count == 3)
        #expect(sections.map(\.kind) == [.income, .saving, .expense])
    }

    @Test
    func displayedSections_typeFilterIncome_returnsOnlyIncome() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income),
            TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense),
            TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving),
        ]

        let sections = FiltersStore.displayedSections(
            for: lines,
            typeFilter: .income,
            checkedFilter: .all
        )

        #expect(sections.count == 1)
        #expect(sections.first?.kind == .income)
        #expect(sections.first?.items.map(\.id) == ["income-1"])
    }

    @Test
    func displayedSections_emptyKind_isOmitted() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income),
            TestDataFactory.createBudgetLine(id: "income-2", kind: .income),
        ]

        let sections = FiltersStore.displayedSections(
            for: lines,
            typeFilter: .all,
            checkedFilter: .all
        )

        #expect(sections.count == 1)
        #expect(sections.first?.kind == .income)
        #expect(sections.first?.items.count == 2)
    }

    // MARK: - kindCounts

    @Test
    func kindCounts_dynamic_reflectsCheckedFilter() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income),
            TestDataFactory.createBudgetLine(id: "income-2", kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense),
            TestDataFactory.createBudgetLine(id: "expense-2", kind: .expense),
            TestDataFactory.createBudgetLine(id: "expense-3", kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving, isChecked: true),
        ]

        let counts = FiltersStore.kindCounts(for: lines, checkedFilter: .unchecked)

        #expect(counts.income == 1)
        #expect(counts.expense == 2)
        #expect(counts.saving == 0)
        #expect(counts.all == 3)
    }

    // MARK: - checkedCounts

    @Test
    func checkedCounts_withTypeFilterAll_returnsTotals() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "i1", kind: .income),
            TestDataFactory.createBudgetLine(id: "i2", kind: .income),
            TestDataFactory.createBudgetLine(id: "i3", kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "e1", kind: .expense),
            TestDataFactory.createBudgetLine(id: "e2", kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "e3", kind: .expense, isChecked: true),
        ]

        let counts = FiltersStore.checkedCounts(for: lines, typeFilter: .all)

        #expect(counts.unchecked == 3)
        #expect(counts.checked == 3)
        #expect(counts.all == 6)
    }

    @Test
    func checkedCounts_withTypeFilterIncome_countsOnlyIncomeLines() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "i1", kind: .income),
            TestDataFactory.createBudgetLine(id: "i2", kind: .income),
            TestDataFactory.createBudgetLine(id: "i3", kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "e1", kind: .expense),
            TestDataFactory.createBudgetLine(id: "e2", kind: .expense, isChecked: true),
        ]

        let counts = FiltersStore.checkedCounts(for: lines, typeFilter: .income)

        #expect(counts.unchecked == 2)
        #expect(counts.checked == 1)
        #expect(counts.all == 3)
    }

    @Test
    func checkedCounts_zero_whenNoLinesMatchType() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "e1", kind: .expense),
            TestDataFactory.createBudgetLine(id: "e2", kind: .expense, isChecked: true),
        ]

        let counts = FiltersStore.checkedCounts(for: lines, typeFilter: .income)

        #expect(counts == .zero)
    }

    // MARK: - combinedFilteredFreeTransactions

    @Test
    func combinedFilteredFreeTransactions_uncheckedFilter_hidesChecked() {
        let txs = [
            TestDataFactory.createTransaction(id: "tx-1", name: "Coop"),
            TestDataFactory.createTransaction(id: "tx-2", name: "Migros", isChecked: true),
        ]

        let result = FiltersStore.combinedFilteredFreeTransactions(
            txs,
            searchText: "",
            checkedFilter: .unchecked
        )

        #expect(result.count == 1)
        #expect(result.first?.id == "tx-1")
    }

    @Test
    func combinedFilteredFreeTransactions_searchFilter_matchesName() {
        let txs = [
            TestDataFactory.createTransaction(id: "tx-1", name: "Coop Pronto", amount: 45),
            TestDataFactory.createTransaction(id: "tx-2", name: "Migros Zürich", amount: 150),
        ]

        let result = FiltersStore.combinedFilteredFreeTransactions(
            txs,
            searchText: "migros",
            checkedFilter: .all
        )

        #expect(result.count == 1)
        #expect(result.first?.id == "tx-2")
    }

    @Test
    func combinedFilteredFreeTransactions_bothFilters() {
        let txs = [
            TestDataFactory.createTransaction(id: "tx-1", name: "Coop Pronto", amount: 45),
            TestDataFactory.createTransaction(id: "tx-2", name: "Coop Lausanne", amount: 60, isChecked: true),
            TestDataFactory.createTransaction(id: "tx-3", name: "Migros Zürich", amount: 150),
        ]

        let result = FiltersStore.combinedFilteredFreeTransactions(
            txs,
            searchText: "Coop",
            checkedFilter: .unchecked
        )

        #expect(result.count == 1)
        #expect(result.first?.id == "tx-1")
    }

    // MARK: - Search filter (filteredLines)

    @Test
    func filteredLines_emptyText_returnsAll() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", name: "Loyer"),
            TestDataFactory.createBudgetLine(id: "2", name: "Salaire"),
        ]

        let result = FiltersStore.filteredLines(lines, searchText: "", transactions: [])

        #expect(result.count == 2)
    }

    @Test
    func filteredLines_partialName_matchesSubstring() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", name: "Loyer appartement"),
            TestDataFactory.createBudgetLine(id: "2", name: "Salaire"),
        ]

        let result = FiltersStore.filteredLines(lines, searchText: "loy", transactions: [])

        #expect(result.count == 1)
        #expect(result.first?.id == "1")
    }

    @Test
    func filteredLines_caseInsensitive_matchesRegardlessOfCase() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", name: "Salaire mensuel"),
        ]

        let result = FiltersStore.filteredLines(lines, searchText: "SALAIRE", transactions: [])

        #expect(result.count == 1)
    }

    @Test
    func filteredLines_accentInsensitive_matchesWithoutAccent() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", name: "Épargne retraite"),
        ]

        let result = FiltersStore.filteredLines(lines, searchText: "epargne", transactions: [])

        #expect(result.count == 1)
    }

    @Test
    func filteredLines_amount_matchesExactAmount() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", name: "Loyer", amount: 1500),
            TestDataFactory.createBudgetLine(id: "2", name: "Café", amount: 5),
        ]

        let result = FiltersStore.filteredLines(lines, searchText: "1500", transactions: [])

        #expect(result.count == 1)
        #expect(result.first?.id == "1")
    }

    @Test
    func filteredLines_matchesLinkedTransactionName() {
        let line = TestDataFactory.createBudgetLine(id: "line-x", name: "Courses", amount: 300)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-linked",
            budgetLineId: "line-x",
            name: "Migros Lausanne",
            amount: 55
        )

        let result = FiltersStore.filteredLines([line], searchText: "Migros", transactions: [linkedTx])

        #expect(result.count == 1)
        #expect(result.first?.id == "line-x")
    }

    @Test
    func filteredLines_noMatch_returnsEmpty() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", name: "Loyer"),
        ]

        let result = FiltersStore.filteredLines(lines, searchText: "xyz", transactions: [])

        #expect(result.isEmpty)
    }
}
