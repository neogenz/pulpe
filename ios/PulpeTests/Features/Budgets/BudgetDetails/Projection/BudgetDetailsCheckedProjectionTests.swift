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
}
