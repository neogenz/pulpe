import XCTest
@testable import Pulpe

/// Tests for BudgetDetailsViewModel filter behavior
/// These are behavioral tests focusing on WHAT the filter does, not HOW it's implemented
@MainActor
final class BudgetDetailsViewModelFilterTests: XCTestCase {

    private var viewModel: BudgetDetailsViewModel!

    override func setUp() async throws {
        // Clear UserDefaults to ensure consistent test state
        UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked")
        viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
    }

    override func tearDown() async throws {
        UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked")
        viewModel = nil
    }

    // MARK: - Default Filter Behavior

    func testDefaultFilter_showsOnlyUncheckedItems() {
        // Given: A new ViewModel with default state

        // When: We check the default filter

        // Then: It should default to showing only unchecked items
        XCTAssertTrue(viewModel.isShowingOnlyUnchecked)
        XCTAssertEqual(viewModel.checkedFilter, .unchecked)
    }

    // MARK: - Filter Persistence

    func testFilterPreference_persistsToUserDefaults() {
        // Given: A ViewModel with default filter

        // When: User changes filter to "all"
        viewModel.checkedFilter = .all

        // Then: The preference should be persisted
        let persistedValue = UserDefaults.standard.bool(forKey: "pulpe-budget-show-only-unchecked")
        XCTAssertFalse(persistedValue, "Filter preference should be saved as false when showing all")
    }

    func testFilterPreference_restoredOnInit() {
        // Given: A persisted preference to show all items
        UserDefaults.standard.set(false, forKey: "pulpe-budget-show-only-unchecked")

        // When: A new ViewModel is created
        let newViewModel = BudgetDetailsViewModel(budgetId: "test-budget")

        // Then: It should restore the "all" filter
        XCTAssertEqual(newViewModel.checkedFilter, .all)
        XCTAssertFalse(newViewModel.isShowingOnlyUnchecked)
    }

    // MARK: - Filter Toggle Behavior

    func testToggleFilter_switchesBetweenModes() {
        // Given: Default filter (unchecked only)
        XCTAssertEqual(viewModel.checkedFilter, .unchecked)

        // When: User switches to all
        viewModel.checkedFilter = .all

        // Then: Filter should show all items
        XCTAssertEqual(viewModel.checkedFilter, .all)
        XCTAssertFalse(viewModel.isShowingOnlyUnchecked)

        // When: User switches back to unchecked
        viewModel.checkedFilter = .unchecked

        // Then: Filter should show only unchecked items
        XCTAssertEqual(viewModel.checkedFilter, .unchecked)
        XCTAssertTrue(viewModel.isShowingOnlyUnchecked)
    }
}

// MARK: - Filter Logic Tests

/// Tests for the filtering logic using test data
/// These tests verify the business rules for filtering budget items
@MainActor
final class BudgetDetailsFilterLogicTests: XCTestCase {

    // MARK: - Budget Line Filter Rules

    func testFilteredIncomeLines_whenUncheckedFilter_excludesCheckedItems() {
        // Given: Budget lines with mixed checked states
        let uncheckedLine = makeBudgetLine(id: "1", kind: .income, checkedAt: nil)
        let checkedLine = makeBudgetLine(id: "2", kind: .income, checkedAt: Date())

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([uncheckedLine, checkedLine], showOnlyUnchecked: true)

        // Then: Only unchecked items should be returned
        XCTAssertEqual(filtered.count, 1)
        XCTAssertEqual(filtered.first?.id, "1")
    }

    func testFilteredIncomeLines_whenAllFilter_includesAllItems() {
        // Given: Budget lines with mixed checked states
        let uncheckedLine = makeBudgetLine(id: "1", kind: .income, checkedAt: nil)
        let checkedLine = makeBudgetLine(id: "2", kind: .income, checkedAt: Date())

        // When: Applying "all" filter
        let filtered = applyCheckedFilter([uncheckedLine, checkedLine], showOnlyUnchecked: false)

        // Then: All items should be returned
        XCTAssertEqual(filtered.count, 2)
    }

    func testFilteredExpenseLines_whenUncheckedFilter_excludesCheckedItems() {
        // Given: Expense lines with mixed checked states
        let unchecked1 = makeBudgetLine(id: "1", kind: .expense, checkedAt: nil)
        let unchecked2 = makeBudgetLine(id: "2", kind: .expense, checkedAt: nil)
        let checked = makeBudgetLine(id: "3", kind: .expense, checkedAt: Date())

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([unchecked1, unchecked2, checked], showOnlyUnchecked: true)

        // Then: Only unchecked items should be returned
        XCTAssertEqual(filtered.count, 2)
        XCTAssertTrue(filtered.allSatisfy { $0.checkedAt == nil })
    }

    func testFilteredSavingLines_whenUncheckedFilter_excludesCheckedItems() {
        // Given: Saving lines with mixed checked states
        let unchecked = makeBudgetLine(id: "1", kind: .saving, checkedAt: nil)
        let checked = makeBudgetLine(id: "2", kind: .saving, checkedAt: Date())

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([unchecked, checked], showOnlyUnchecked: true)

        // Then: Only unchecked items should be returned
        XCTAssertEqual(filtered.count, 1)
        XCTAssertNil(filtered.first?.checkedAt)
    }

    // MARK: - Free Transaction Filter Rules

    func testFilteredFreeTransactions_whenUncheckedFilter_excludesCheckedTransactions() {
        // Given: Free transactions with mixed checked states
        let uncheckedTx = makeTransaction(id: "1", budgetLineId: nil, checkedAt: nil)
        let checkedTx = makeTransaction(id: "2", budgetLineId: nil, checkedAt: Date())

        // When: Applying unchecked filter
        let filtered = applyCheckedFilterToTransactions([uncheckedTx, checkedTx], showOnlyUnchecked: true)

        // Then: Only unchecked transactions should be returned
        XCTAssertEqual(filtered.count, 1)
        XCTAssertNil(filtered.first?.checkedAt)
    }

    func testFilteredFreeTransactions_whenAllFilter_includesAllTransactions() {
        // Given: Free transactions with mixed checked states
        let uncheckedTx = makeTransaction(id: "1", budgetLineId: nil, checkedAt: nil)
        let checkedTx = makeTransaction(id: "2", budgetLineId: nil, checkedAt: Date())

        // When: Applying "all" filter
        let filtered = applyCheckedFilterToTransactions([uncheckedTx, checkedTx], showOnlyUnchecked: false)

        // Then: All transactions should be returned
        XCTAssertEqual(filtered.count, 2)
    }

    // MARK: - Edge Cases

    func testFilter_withEmptyList_returnsEmptyList() {
        // Given: Empty budget lines
        let emptyLines: [BudgetLine] = []

        // When: Applying filter
        let filtered = applyCheckedFilter(emptyLines, showOnlyUnchecked: true)

        // Then: Should return empty array
        XCTAssertTrue(filtered.isEmpty)
    }

    func testFilter_withAllUnchecked_returnsAllItems() {
        // Given: All lines are unchecked
        let line1 = makeBudgetLine(id: "1", kind: .expense, checkedAt: nil)
        let line2 = makeBudgetLine(id: "2", kind: .expense, checkedAt: nil)
        let line3 = makeBudgetLine(id: "3", kind: .expense, checkedAt: nil)

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([line1, line2, line3], showOnlyUnchecked: true)

        // Then: All items should be returned
        XCTAssertEqual(filtered.count, 3)
    }

    func testFilter_withAllChecked_returnsEmptyList() {
        // Given: All lines are checked
        let line1 = makeBudgetLine(id: "1", kind: .expense, checkedAt: Date())
        let line2 = makeBudgetLine(id: "2", kind: .expense, checkedAt: Date())

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([line1, line2], showOnlyUnchecked: true)

        // Then: No items should be returned
        XCTAssertTrue(filtered.isEmpty)
    }

    // MARK: - Test Helpers

    /// Simulates the filter logic from BudgetDetailsViewModel
    private func applyCheckedFilter(_ lines: [BudgetLine], showOnlyUnchecked: Bool) -> [BudgetLine] {
        guard showOnlyUnchecked else { return lines }
        return lines.filter { $0.checkedAt == nil }
    }

    private func applyCheckedFilterToTransactions(_ transactions: [Transaction], showOnlyUnchecked: Bool) -> [Transaction] {
        guard showOnlyUnchecked else { return transactions }
        return transactions.filter { $0.checkedAt == nil }
    }

    private func makeBudgetLine(id: String, kind: TransactionKind, checkedAt: Date?) -> BudgetLine {
        BudgetLine(
            id: id,
            budgetId: "test-budget",
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Test Line",
            amount: 100,
            kind: kind,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: checkedAt,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func makeTransaction(id: String, budgetLineId: String?, checkedAt: Date?) -> Transaction {
        Transaction(
            id: id,
            budgetId: "test-budget",
            budgetLineId: budgetLineId,
            name: "Test Transaction",
            amount: 50,
            kind: .expense,
            transactionDate: Date(),
            category: nil,
            checkedAt: checkedAt,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}
