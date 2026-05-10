import Foundation
@testable import Pulpe
import Testing

/// Pure-function tests for `BudgetDetailsProjector.project(from:searchText:)`.
///
/// These verify the contract of `BudgetDetailsScreenState`: canonical section
/// order, search filtering, pre-computed indices, pager month sort, free
/// transactions partition. No UI involvement, no Observation tracking — just
/// the static derivation function.
///
/// `.serialized` because the VM init reads `UserDefaults` filter prefs and
/// pre-populates from the shared `BudgetDetailCache.shared` singleton; we
/// reset both before each test so cases don't bleed.
@Suite(.serialized)
@MainActor
struct BudgetDetailsScreenStateProjectionTests {
    // MARK: - Filter pref keys (mirror BudgetDetailsViewModel)

    private static let typeFilterKey = "pulpe-budget-line-type-filter"
    private static let checkedFilterKey = "pulpe-budget-checked-filter"
    private static let legacyShowOnlyUncheckedKey = "pulpe-budget-show-only-unchecked"

    private func resetEnvironment() {
        UserDefaults.standard.removeObject(forKey: Self.typeFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.checkedFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.legacyShowOnlyUncheckedKey)
        BudgetDetailCache.shared.invalidateAll()
    }

    /// Builds a fresh VM with `.all` filters (so the projector returns every
    /// kind unless the test changes filters). The VM defaults to
    /// `.unchecked` checked filter — the empty-state test wants that default,
    /// every other test flips to `.all`.
    private func makeViewModel(checkedFilter: CheckedFilterOption = .all) -> BudgetDetailsViewModel {
        resetEnvironment()
        let vm = BudgetDetailsViewModel(budgetId: "test-budget")
        vm.setCheckedFilter(checkedFilter)
        return vm
    }

    // MARK: - Basic shape

    @Test
    func project_emptyBudget_producesEmptyState() {
        let vm = makeViewModel()

        let state = BudgetDetailsProjector.project(from: vm, searchText: "")

        #expect(state.sections.isEmpty)
        #expect(state.free.isEmpty)
        #expect(state.kindCounts.all == 0)
        #expect(state.firstSectionKind == nil)
        #expect(state.consumptionByLineId.isEmpty)
        #expect(state.transactionsByLineId.isEmpty)
    }

    @Test
    func project_threeKinds_producesCanonicalOrder() {
        let vm = makeViewModel()
        // Add expenses first to verify the projector imposes the canonical
        // income → saving → expense order regardless of insertion order.
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense))
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "income-1", kind: .income))
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving))

        let state = BudgetDetailsProjector.project(from: vm, searchText: "")

        let kinds = state.sections.map(\.kind)
        #expect(kinds == [.income, .saving, .expense])
        #expect(state.firstSectionKind == .income)
    }

    // MARK: - Filters

    @Test
    func project_typeFilterIncome_dropsOtherKinds() {
        let vm = makeViewModel()
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "income-1", kind: .income))
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense))
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving))
        vm.setTypeFilter(.income)

        let state = BudgetDetailsProjector.project(from: vm, searchText: "")

        // Sections reflect the active type filter…
        #expect(state.sections.count == 1)
        #expect(state.sections.first?.kind == .income)

        // …while the kind counts cover every kind so the filter pill chips
        // show "what tapping this would show" against the active checked filter.
        #expect(state.kindCounts.income == 1)
        #expect(state.kindCounts.saving == 1)
        #expect(state.kindCounts.expense == 1)
        #expect(state.kindCounts.all == 3)
    }

    @Test
    func project_checkedFilterUnchecked_dropsCheckedItems() {
        let vm = makeViewModel(checkedFilter: .unchecked)
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "checked", kind: .expense, isChecked: true))
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "unchecked", kind: .expense, isChecked: false))

        let state = BudgetDetailsProjector.project(from: vm, searchText: "")

        let visibleIds = state.sections.flatMap { section in section.items.map(\.line.id) }
        #expect(visibleIds == ["unchecked"])

        // Counts reflect totals (per type), unaffected by the active checked filter
        // for the type axis the user is on.
        #expect(state.checkedCounts.unchecked == 1)
        #expect(state.checkedCounts.checked == 1)
        #expect(state.checkedCounts.all == 2)
    }

    // MARK: - Search

    @Test
    func project_searchByLineName_filtersSections() {
        let vm = makeViewModel()
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "rent", name: "Loyer", kind: .expense))
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "phone", name: "Téléphone", kind: .expense))

        let state = BudgetDetailsProjector.project(from: vm, searchText: "loyer")

        let visibleIds = state.sections.flatMap { section in section.items.map(\.line.id) }
        #expect(visibleIds == ["rent"])
    }

    @Test
    func project_searchByTransactionAmount_keepsLineWithMatchingTransaction() {
        let vm = makeViewModel()
        let line = TestDataFactory.createBudgetLine(id: "groceries", name: "Courses", kind: .expense)
        vm.addBudgetLine(line)
        // Transaction amount string "42" should match the line via the linked-tx
        // search rule (name OR amount of any linked transaction).
        vm.addTransaction(
            TestDataFactory.createTransaction(
                id: "tx-1", budgetLineId: "groceries", name: "Migros", amount: 42
            )
        )

        let state = BudgetDetailsProjector.project(from: vm, searchText: "42")

        let visibleIds = state.sections.flatMap { section in section.items.map(\.line.id) }
        #expect(visibleIds == ["groceries"])
    }

    // MARK: - Indexed lookups

    @Test
    func project_consumptionByLineId_preComputed() {
        let vm = makeViewModel()
        let line1 = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let line2 = TestDataFactory.createBudgetLine(id: "line-2", amount: 500, kind: .income)
        vm.addBudgetLine(line1)
        vm.addBudgetLine(line2)
        vm.addTransaction(
            TestDataFactory.createTransaction(
                id: "tx-1", budgetLineId: "line-1", amount: 250, kind: .expense
            )
        )

        let state = BudgetDetailsProjector.project(from: vm, searchText: "")

        // Every line in source state has a consumption entry.
        #expect(state.consumptionByLineId["line-1"]?.allocated == 250)
        #expect(state.consumptionByLineId["line-1"]?.available == 750)
        #expect(state.consumptionByLineId["line-2"]?.allocated == 0)
        #expect(state.consumptionByLineId["line-2"]?.available == 500)
    }

    @Test
    func project_transactionsByLineId_sortedDescByDate() throws {
        let vm = makeViewModel()
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "line-1"))

        // Two allocated transactions — older one first in insertion order so we
        // can detect that the projector imposes newest-first.
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
        vm.addTransaction(older)
        vm.addTransaction(newer)

        let state = BudgetDetailsProjector.project(from: vm, searchText: "")

        let txs = try #require(state.transactionsByLineId["line-1"])
        #expect(txs.map(\.id) == ["new", "old"])
    }

    // MARK: - Pager

    @Test
    func project_pagerMonths_sortedAndDropsNilMonth() {
        let vm = makeViewModel()
        // Pre-populate the shared cache so VM init seeds `allBudgets` from it
        // (without going through the network). Adjacent budget order is set
        // intentionally out-of-order to verify the projector emits chronological
        // PagerMonth entries.
        BudgetDetailCache.shared.storeAllBudgets([
            TestDataFactory.createBudgetSparse(id: "b3", month: 3, year: 2026),
            TestDataFactory.createBudgetSparse(id: "b1", month: 12, year: 2025),
            TestDataFactory.createBudgetSparse(id: "bnil", month: nil, year: 2026),
            TestDataFactory.createBudgetSparse(id: "b2", month: 1, year: 2026),
        ])
        // VM seeds from cache during init.
        let seeded = BudgetDetailsViewModel(budgetId: "test-budget")
        seeded.setCheckedFilter(.all)

        let state = BudgetDetailsProjector.project(from: seeded, searchText: "")

        #expect(state.pagerMonths.map(\.id) == ["b1", "b2", "b3"])
        // Nil-month entry dropped.
        #expect(state.pagerMonths.contains { $0.id == "bnil" } == false)
    }

    // MARK: - Free transactions

    @Test
    func project_freeTransactions_excludesAllocated() {
        let vm = makeViewModel()
        vm.addBudgetLine(TestDataFactory.createBudgetLine(id: "line-1"))
        vm.addTransaction(
            TestDataFactory.createTransaction(
                id: "allocated", budgetLineId: "line-1", name: "Allocated"
            )
        )
        vm.addTransaction(
            TestDataFactory.createTransaction(
                id: "free", budgetLineId: nil, name: "Free"
            )
        )

        let state = BudgetDetailsProjector.project(from: vm, searchText: "")

        // Only the unallocated transaction surfaces in `free`.
        #expect(state.free.map(\.transaction.id) == ["free"])
        // The allocated tx contributes to `transactionsByLineId` instead.
        #expect(state.transactionsByLineId["line-1"]?.map(\.id) == ["allocated"])
    }
}
