import Foundation
@testable import Pulpe
import Testing

/// Pure-function tests for `BudgetDetailsProjector.project(...)`, split out of
/// `BudgetDetailsScreenStateProjectionTests` for the pointage-specific surface: the
/// list-animation tick hash, and the "Tout est pointé" completion state under the
/// unchecked filter.
///
/// `.serialized` for the same reason as its sibling: the stores read `UserDefaults`
/// filter prefs and pre-populate from the shared `BudgetDetailCache.shared` singleton,
/// reset via `ProjectionTestStack` before each test.
@Suite("BudgetDetailsProjector — checked projection", .serialized)
@MainActor
struct BudgetDetailsCheckedProjectionTests {
    // MARK: - Checked tick hash

    @Test
    func checkedTickHash_reprojectedWithSameSource_staysStable() {
        let stack = ProjectionTestStack.makeStores()
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", isChecked: true))
        stack.data.appendTransaction(TestDataFactory.createTransaction(id: "tx-1", isChecked: false))

        let first = ProjectionTestStack.checkedTickHash(for: stack)
        let second = ProjectionTestStack.checkedTickHash(for: stack)
        #expect(first == second)
    }

    @Test
    func checkedTickHash_budgetLineCheckFlips_changes() {
        let unchecked = ProjectionTestStack.makeStores()
        unchecked.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", isChecked: false))

        let checked = ProjectionTestStack.makeStores()
        checked.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", isChecked: true))

        let uncheckedHash = ProjectionTestStack.checkedTickHash(for: unchecked)
        let checkedHash = ProjectionTestStack.checkedTickHash(for: checked)
        #expect(uncheckedHash != checkedHash)
    }

    @Test
    func checkedTickHash_transactionCheckFlips_changes() {
        let unchecked = ProjectionTestStack.makeStores()
        unchecked.data.appendTransaction(TestDataFactory.createTransaction(id: "tx-1", isChecked: false))

        let checked = ProjectionTestStack.makeStores()
        checked.data.appendTransaction(TestDataFactory.createTransaction(id: "tx-1", isChecked: true))

        let uncheckedHash = ProjectionTestStack.checkedTickHash(for: unchecked)
        let checkedHash = ProjectionTestStack.checkedTickHash(for: checked)
        #expect(uncheckedHash != checkedHash)
    }

    @Test
    func checkedTickHash_nonCheckedFieldChanges_staysStable() {
        let base = ProjectionTestStack.makeStores()
        base.data.appendBudgetLine(
            TestDataFactory.createBudgetLine(id: "line-1", name: "Loyer", amount: 1000, isChecked: false)
        )

        // Same id + same isChecked, but name and amount differ — hash must ignore them.
        let edited = ProjectionTestStack.makeStores()
        edited.data.appendBudgetLine(
            TestDataFactory.createBudgetLine(id: "line-1", name: "Loyer révisé", amount: 1200, isChecked: false)
        )

        let baseHash = ProjectionTestStack.checkedTickHash(for: base)
        let editedHash = ProjectionTestStack.checkedTickHash(for: edited)
        #expect(baseHash == editedHash)
    }

    // MARK: - "Tout est pointé" completion state

    @Test
    func project_uncheckedFilterAllChecked_showsEmptyChecked() {
        let stack = ProjectionTestStack.makeStores(checkedFilter: .unchecked)
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", isChecked: true))
        stack.data.appendTransaction(TestDataFactory.createTransaction(id: "tx-1", isChecked: true))

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        #expect(state.canShowEmptyChecked)
    }

    @Test
    func project_uncheckedFilterEmptyBudget_hidesEmptyChecked() {
        // A budget with nothing at all must not celebrate a completion.
        let stack = ProjectionTestStack.makeStores(checkedFilter: .unchecked)

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        #expect(!state.canShowEmptyChecked)
    }

    @Test
    func project_uncheckedFilterOneRemaining_hidesEmptyChecked() {
        let stack = ProjectionTestStack.makeStores(checkedFilter: .unchecked)
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", isChecked: true))
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-2", isChecked: false))

        let state = BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        )

        #expect(!state.canShowEmptyChecked)
    }

    // MARK: - "Plus rien ne dépasse" state under « Dépassées »

    @Test
    func project_overFilterNoOverrun_showsEmptyOver() {
        let stack = ProjectionTestStack.makeStores(checkedFilter: .over)
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", amount: 100))

        #expect(Self.project(stack).canShowEmptyOver)
    }

    @Test
    func project_overFilterEmptyMonth_hidesEmptyOver() {
        // Without prévision the add row stays: nothing to celebrate.
        let stack = ProjectionTestStack.makeStores(checkedFilter: .over)

        #expect(!Self.project(stack).canShowEmptyOver)
    }

    @Test
    func project_overFilterOneOverrun_hidesEmptyOver() {
        let stack = ProjectionTestStack.makeStores(checkedFilter: .over)
        Self.appendOverrunExpense(to: stack)

        #expect(!Self.project(stack).canShowEmptyOver)
    }

    @Test
    func project_overFilterIncomeTypeFilterHidesOverrun_hidesEmptyOver() {
        // The type filter hides the overrun, but the month still has one.
        let stack = ProjectionTestStack.makeStores(checkedFilter: .over)
        stack.filters.setTypeFilter(.income)
        Self.appendOverrunExpense(to: stack)

        let state = Self.project(stack)
        #expect(state.sections.isEmpty)
        #expect(!state.canShowEmptyOver)
    }

    @Test
    func project_overFilterNoOverrunWithSearch_hidesEmptyOver() {
        let stack = ProjectionTestStack.makeStores(checkedFilter: .over)
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", amount: 100))

        #expect(!Self.project(stack, searchText: "Loyer").canShowEmptyOver)
    }

    @Test
    func project_overFilterSavedRailHidden_hidesEmptyOver() {
        let stack = ProjectionTestStack.makeStores(checkedFilter: .over)
        stack.filters.setRailHidden(true)
        stack.data.appendBudgetLine(TestDataFactory.createBudgetLine(id: "line-1", amount: 100))

        #expect(!Self.project(stack).canShowEmptyOver)
    }

    private static func appendOverrunExpense(to stack: ProjectionTestStack.StoreStack) {
        stack.data.appendBudgetLine(
            TestDataFactory.createBudgetLine(id: "line-1", amount: 100, kind: .expense)
        )
        stack.data.appendTransaction(
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "line-1", amount: 150, kind: .expense)
        )
    }

    private static func project(
        _ stack: ProjectionTestStack.StoreStack,
        searchText: String = ""
    ) -> BudgetDetailsScreenState {
        BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: searchText
        )
    }
}
