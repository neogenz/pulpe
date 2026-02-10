import XCTest
@testable import Pulpe

/// Tests for BudgetDetailsViewModel filter behavior
/// These are behavioral tests focusing on WHAT the filter does, not HOW it's implemented
@MainActor
final class BudgetDetailsViewModelFilterTests: XCTestCase {

    private var viewModel: BudgetDetailsViewModel!

    override func setUp() {
        // Clear UserDefaults to ensure consistent test state
        UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked")
        viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
    }

    override func tearDown() {
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
final class BudgetDetailsFilterLogicTests: XCTestCase {

    // MARK: - Budget Line Filter Rules

    func testFilteredIncomeLines_whenUncheckedFilter_excludesCheckedItems() {
        // Given: Budget lines with mixed checked states
        let uncheckedLine = TestDataFactory.createBudgetLine(id: "1", kind: .income)
        let checkedLine = TestDataFactory.createBudgetLine(id: "2", kind: .income, isChecked: true)

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([uncheckedLine, checkedLine], showOnlyUnchecked: true)

        // Then: Only unchecked items should be returned
        XCTAssertEqual(filtered.count, 1)
        XCTAssertEqual(filtered.first?.id, "1")
    }

    func testFilteredIncomeLines_whenAllFilter_includesAllItems() {
        // Given: Budget lines with mixed checked states
        let uncheckedLine = TestDataFactory.createBudgetLine(id: "1", kind: .income)
        let checkedLine = TestDataFactory.createBudgetLine(id: "2", kind: .income, isChecked: true)

        // When: Applying "all" filter
        let filtered = applyCheckedFilter([uncheckedLine, checkedLine], showOnlyUnchecked: false)

        // Then: All items should be returned
        XCTAssertEqual(filtered.count, 2)
    }

    func testFilteredExpenseLines_whenUncheckedFilter_excludesCheckedItems() {
        // Given: Expense lines with mixed checked states
        let unchecked1 = TestDataFactory.createBudgetLine(id: "1", kind: .expense)
        let unchecked2 = TestDataFactory.createBudgetLine(id: "2", kind: .expense)
        let checked = TestDataFactory.createBudgetLine(id: "3", kind: .expense, isChecked: true)

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([unchecked1, unchecked2, checked], showOnlyUnchecked: true)

        // Then: Only unchecked items should be returned
        XCTAssertEqual(filtered.count, 2)
        XCTAssertTrue(filtered.allSatisfy { $0.checkedAt == nil })
    }

    func testFilteredSavingLines_whenUncheckedFilter_excludesCheckedItems() {
        // Given: Saving lines with mixed checked states
        let unchecked = TestDataFactory.createBudgetLine(id: "1", kind: .saving)
        let checked = TestDataFactory.createBudgetLine(id: "2", kind: .saving, isChecked: true)

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([unchecked, checked], showOnlyUnchecked: true)

        // Then: Only unchecked items should be returned
        XCTAssertEqual(filtered.count, 1)
        XCTAssertNil(filtered.first?.checkedAt)
    }

    // MARK: - Free Transaction Filter Rules

    func testFilteredFreeTransactions_whenUncheckedFilter_excludesCheckedTransactions() {
        // Given: Free transactions with mixed checked states
        let uncheckedTx = TestDataFactory.createTransaction(id: "1")
        let checkedTx = TestDataFactory.createTransaction(id: "2", isChecked: true)

        // When: Applying unchecked filter
        let filtered = applyCheckedFilterToTransactions([uncheckedTx, checkedTx], showOnlyUnchecked: true)

        // Then: Only unchecked transactions should be returned
        XCTAssertEqual(filtered.count, 1)
        XCTAssertNil(filtered.first?.checkedAt)
    }

    func testFilteredFreeTransactions_whenAllFilter_includesAllTransactions() {
        // Given: Free transactions with mixed checked states
        let uncheckedTx = TestDataFactory.createTransaction(id: "1")
        let checkedTx = TestDataFactory.createTransaction(id: "2", isChecked: true)

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
        let line1 = TestDataFactory.createBudgetLine(id: "1", kind: .expense)
        let line2 = TestDataFactory.createBudgetLine(id: "2", kind: .expense)
        let line3 = TestDataFactory.createBudgetLine(id: "3", kind: .expense)

        // When: Applying unchecked filter
        let filtered = applyCheckedFilter([line1, line2, line3], showOnlyUnchecked: true)

        // Then: All items should be returned
        XCTAssertEqual(filtered.count, 3)
    }

    func testFilter_withAllChecked_returnsEmptyList() {
        // Given: All lines are checked
        let line1 = TestDataFactory.createBudgetLine(id: "1", kind: .expense, isChecked: true)
        let line2 = TestDataFactory.createBudgetLine(id: "2", kind: .expense, isChecked: true)

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

}

// MARK: - Search Filter Tests

/// Tests for search filtering on budget lines and free transactions
/// Verifies that search matches by name (partial, case-insensitive) and by amount
final class BudgetDetailsSearchFilterTests: XCTestCase {

    // MARK: - Test Data

    private let loyer = TestDataFactory.createBudgetLine(
        id: "line-1", name: "Loyer appartement", amount: 1500, kind: .expense
    )
    private let courses = TestDataFactory.createBudgetLine(
        id: "line-2", name: "Courses alimentaires", amount: 350, kind: .expense
    )
    private let salaire = TestDataFactory.createBudgetLine(
        id: "line-3", name: "Salaire mensuel", amount: 5000, kind: .income
    )
    private let epargne = TestDataFactory.createBudgetLine(
        id: "line-4", name: "Épargne retraite", amount: 200, kind: .saving
    )

    private lazy var allLines: [BudgetLine] = [loyer, courses, salaire, epargne]

    private let txCoop = TestDataFactory.createTransaction(
        id: "tx-1", name: "Coop Pronto", amount: 45
    )
    private let txMigros = TestDataFactory.createTransaction(
        id: "tx-2", name: "Migros Zürich", amount: 150
    )
    private let txSbb = TestDataFactory.createTransaction(
        id: "tx-3", name: "CFF abonnement", amount: 340
    )

    private lazy var allFreeTransactions: [Transaction] = [txCoop, txMigros, txSbb]

    // MARK: - CA7: Empty search returns all items

    func testSearchBudgetLines_emptyText_returnsAll() {
        // Given: Budget lines and empty search text

        // When: Filtering with empty search
        let result = filterLines(allLines, searchText: "", transactions: [])

        // Then: All lines are returned
        XCTAssertEqual(result.count, allLines.count)
    }

    func testSearchFreeTransactions_emptyText_returnsAll() {
        // Given: Free transactions and empty search text

        // When: Filtering with empty search
        let result = filterFreeTransactions(allFreeTransactions, searchText: "")

        // Then: All transactions are returned
        XCTAssertEqual(result.count, allFreeTransactions.count)
    }

    // MARK: - CA3: Name matching (partial, case-insensitive)

    func testSearchBudgetLines_partialName_matchesSubstring() {
        // Given: Lines including "Loyer appartement"

        // When: Searching for partial name "loy"
        let result = filterLines(allLines, searchText: "loy", transactions: [])

        // Then: Only loyer is matched
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "line-1")
    }

    func testSearchBudgetLines_caseInsensitive_matchesRegardlessOfCase() {
        // Given: Lines including "Salaire mensuel"

        // When: Searching with different case "SALAIRE"
        let result = filterLines(allLines, searchText: "SALAIRE", transactions: [])

        // Then: Salaire line is matched
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "line-3")
    }

    func testSearchBudgetLines_accentInsensitive_matchesWithoutAccent() {
        // Given: Lines including "Épargne retraite"

        // When: Searching without accent "epargne"
        let result = filterLines(allLines, searchText: "epargne", transactions: [])

        // Then: Epargne line is matched
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "line-4")
    }

    func testSearchFreeTransactions_partialName_matchesSubstring() {
        // Given: Transactions including "Migros Zürich"

        // When: Searching for "migros"
        let result = filterFreeTransactions(allFreeTransactions, searchText: "migros")

        // Then: Migros transaction is matched
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "tx-2")
    }

    // MARK: - CA4: Amount matching

    func testSearchBudgetLines_amount_matchesExactAmount() {
        // Given: Lines with various amounts (1500, 350, 5000, 200)

        // When: Searching for "1500"
        let result = filterLines(allLines, searchText: "1500", transactions: [])

        // Then: Loyer (amount 1500) is matched
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "line-1")
    }

    func testSearchBudgetLines_partialAmount_matchesContainedDigits() {
        // Given: Lines with amounts 1500, 350, 5000, 200

        // When: Searching for "50" (contained in 1500, 350, 5000)
        let result = filterLines(allLines, searchText: "50", transactions: [])

        // Then: Lines with "50" in their amount string are matched
        XCTAssertTrue(result.contains { $0.id == "line-1" }, "1500 contains '50'")
        XCTAssertTrue(result.contains { $0.id == "line-2" }, "350 contains '50'")
        XCTAssertTrue(result.contains { $0.id == "line-3" }, "5000 contains '50'")
    }

    func testSearchFreeTransactions_amount_matchesExactAmount() {
        // Given: Transactions with amounts 45, 150, 340

        // When: Searching for "150"
        let result = filterFreeTransactions(allFreeTransactions, searchText: "150")

        // Then: Migros transaction (amount 150) is matched
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "tx-2")
    }

    func testSearchFreeTransactions_partialAmount_matchesContainedDigits() {
        // Given: Transactions with amounts 45, 150, 340

        // When: Searching for "4" (contained in 45 and 340)
        let result = filterFreeTransactions(allFreeTransactions, searchText: "4")

        // Then: Transactions with "4" in amount are matched
        XCTAssertTrue(result.contains { $0.id == "tx-1" }, "45 contains '4'")
        XCTAssertTrue(result.contains { $0.id == "tx-3" }, "340 contains '4'")
    }

    // MARK: - CA4: Linked transaction name matching

    func testSearchBudgetLines_matchesLinkedTransactionName() {
        // Given: A budget line with a linked transaction
        let line = TestDataFactory.createBudgetLine(id: "line-x", name: "Courses", amount: 300)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-linked", budgetLineId: "line-x", name: "Migros Lausanne", amount: 55
        )

        // When: Searching for the transaction name "Migros"
        let result = filterLines([line], searchText: "Migros", transactions: [linkedTx])

        // Then: The parent line is matched via its linked transaction
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "line-x")
    }

    func testSearchBudgetLines_matchesLinkedTransactionAmount() {
        // Given: A budget line with a linked transaction whose amount doesn't match the line
        let line = TestDataFactory.createBudgetLine(id: "line-x", name: "Courses", amount: 300)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-linked", budgetLineId: "line-x", name: "Migros Lausanne", amount: 55
        )

        // When: Searching for the transaction amount "55"
        let result = filterLines([line], searchText: "55", transactions: [linkedTx])

        // Then: The parent line is matched via its linked transaction amount
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "line-x")
    }

    // MARK: - CA6: No match returns empty

    func testSearchBudgetLines_noMatch_returnsEmpty() {
        // Given: Lines with names and amounts that don't contain "xyz"

        // When: Searching for "xyz"
        let result = filterLines(allLines, searchText: "xyz", transactions: [])

        // Then: No results
        XCTAssertTrue(result.isEmpty)
    }

    func testSearchFreeTransactions_noMatch_returnsEmpty() {
        // Given: Transactions that don't match "zzz999"

        // When: Searching for "zzz999"
        let result = filterFreeTransactions(allFreeTransactions, searchText: "zzz999")

        // Then: No results
        XCTAssertTrue(result.isEmpty)
    }

    // MARK: - Test Helpers

    /// Replicates BudgetDetailsViewModel.filteredLines(_:searchText:)
    private func filterLines(
        _ lines: [BudgetLine],
        searchText: String,
        transactions: [Transaction]
    ) -> [BudgetLine] {
        guard !searchText.isEmpty else { return lines }
        return lines.filter { line in
            line.name.localizedStandardContains(searchText) ||
                "\(line.amount)".contains(searchText) ||
                transactions.contains {
                    $0.budgetLineId == line.id &&
                        ($0.name.localizedStandardContains(searchText) ||
                         "\($0.amount)".contains(searchText))
                }
        }
    }

    /// Replicates BudgetDetailsViewModel.filteredFreeTransactions(searchText:)
    private func filterFreeTransactions(
        _ transactions: [Transaction],
        searchText: String
    ) -> [Transaction] {
        guard !searchText.isEmpty else { return transactions }
        return transactions.filter {
            $0.name.localizedStandardContains(searchText) ||
                "\($0.amount)".contains(searchText)
        }
    }
}
