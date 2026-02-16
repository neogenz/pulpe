import Foundation
import Testing
@testable import Pulpe

@Suite(.serialized)
@MainActor
struct BudgetDetailsViewModelFilterTests {

    // MARK: - Default Filter Behavior

    @Test
    func defaultFilter_showsOnlyUncheckedItems() {
        UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked")
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        defer { UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked") }

        #expect(viewModel.isShowingOnlyUnchecked)
        #expect(viewModel.checkedFilter == .unchecked)
    }

    // MARK: - Filter Persistence

    @Test
    func filterPreference_persistsToUserDefaults() {
        UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked")
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        defer { UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked") }

        viewModel.checkedFilter = .all

        let persistedValue = UserDefaults.standard.bool(forKey: "pulpe-budget-show-only-unchecked")
        #expect(!persistedValue)
    }

    @Test
    func filterPreference_restoredOnInit() {
        defer { UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked") }
        UserDefaults.standard.set(false, forKey: "pulpe-budget-show-only-unchecked")
        let newViewModel = BudgetDetailsViewModel(budgetId: "test-budget")

        #expect(newViewModel.checkedFilter == .all)
        #expect(!newViewModel.isShowingOnlyUnchecked)
    }

    // MARK: - Filter Toggle Behavior

    @Test
    func toggleFilter_switchesBetweenModes() {
        UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked")
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        defer { UserDefaults.standard.removeObject(forKey: "pulpe-budget-show-only-unchecked") }

        #expect(viewModel.checkedFilter == .unchecked)

        viewModel.checkedFilter = .all

        #expect(viewModel.checkedFilter == .all)
        #expect(!viewModel.isShowingOnlyUnchecked)

        viewModel.checkedFilter = .unchecked

        #expect(viewModel.checkedFilter == .unchecked)
        #expect(viewModel.isShowingOnlyUnchecked)
    }
}

// MARK: - Filter Logic Tests

struct BudgetDetailsFilterLogicTests {

    // MARK: - Budget Line Filter Rules

    @Test
    func filteredIncomeLines_whenUncheckedFilter_excludesCheckedItems() {
        let uncheckedLine = TestDataFactory.createBudgetLine(id: "1", kind: .income)
        let checkedLine = TestDataFactory.createBudgetLine(id: "2", kind: .income, isChecked: true)

        let filtered = applyCheckedFilter([uncheckedLine, checkedLine], showOnlyUnchecked: true)

        #expect(filtered.count == 1)
        #expect(filtered.first?.id == "1")
    }

    @Test
    func filteredIncomeLines_whenAllFilter_includesAllItems() {
        let uncheckedLine = TestDataFactory.createBudgetLine(id: "1", kind: .income)
        let checkedLine = TestDataFactory.createBudgetLine(id: "2", kind: .income, isChecked: true)

        let filtered = applyCheckedFilter([uncheckedLine, checkedLine], showOnlyUnchecked: false)

        #expect(filtered.count == 2)
    }

    @Test
    func filteredExpenseLines_whenUncheckedFilter_excludesCheckedItems() {
        let unchecked1 = TestDataFactory.createBudgetLine(id: "1", kind: .expense)
        let unchecked2 = TestDataFactory.createBudgetLine(id: "2", kind: .expense)
        let checked = TestDataFactory.createBudgetLine(id: "3", kind: .expense, isChecked: true)

        let filtered = applyCheckedFilter([unchecked1, unchecked2, checked], showOnlyUnchecked: true)

        #expect(filtered.count == 2)
        #expect(filtered.allSatisfy { $0.checkedAt == nil })
    }

    @Test
    func filteredSavingLines_whenUncheckedFilter_excludesCheckedItems() {
        let unchecked = TestDataFactory.createBudgetLine(id: "1", kind: .saving)
        let checked = TestDataFactory.createBudgetLine(id: "2", kind: .saving, isChecked: true)

        let filtered = applyCheckedFilter([unchecked, checked], showOnlyUnchecked: true)

        #expect(filtered.count == 1)
        #expect(filtered.first?.checkedAt == nil)
    }

    // MARK: - Free Transaction Filter Rules

    @Test
    func filteredFreeTransactions_whenUncheckedFilter_excludesCheckedTransactions() {
        let uncheckedTx = TestDataFactory.createTransaction(id: "1")
        let checkedTx = TestDataFactory.createTransaction(id: "2", isChecked: true)

        let filtered = applyCheckedFilterToTransactions([uncheckedTx, checkedTx], showOnlyUnchecked: true)

        #expect(filtered.count == 1)
        #expect(filtered.first?.checkedAt == nil)
    }

    @Test
    func filteredFreeTransactions_whenAllFilter_includesAllTransactions() {
        let uncheckedTx = TestDataFactory.createTransaction(id: "1")
        let checkedTx = TestDataFactory.createTransaction(id: "2", isChecked: true)

        let filtered = applyCheckedFilterToTransactions([uncheckedTx, checkedTx], showOnlyUnchecked: false)

        #expect(filtered.count == 2)
    }

    // MARK: - Edge Cases

    @Test
    func filter_withEmptyList_returnsEmptyList() {
        let emptyLines: [BudgetLine] = []

        let filtered = applyCheckedFilter(emptyLines, showOnlyUnchecked: true)

        #expect(filtered.isEmpty)
    }

    @Test
    func filter_withAllUnchecked_returnsAllItems() {
        let line1 = TestDataFactory.createBudgetLine(id: "1", kind: .expense)
        let line2 = TestDataFactory.createBudgetLine(id: "2", kind: .expense)
        let line3 = TestDataFactory.createBudgetLine(id: "3", kind: .expense)

        let filtered = applyCheckedFilter([line1, line2, line3], showOnlyUnchecked: true)

        #expect(filtered.count == 3)
    }

    @Test
    func filter_withAllChecked_returnsEmptyList() {
        let line1 = TestDataFactory.createBudgetLine(id: "1", kind: .expense, isChecked: true)
        let line2 = TestDataFactory.createBudgetLine(id: "2", kind: .expense, isChecked: true)

        let filtered = applyCheckedFilter([line1, line2], showOnlyUnchecked: true)

        #expect(filtered.isEmpty)
    }

    // MARK: - Test Helpers

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

struct BudgetDetailsSearchFilterTests {

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

    private var allLines: [BudgetLine] {
        [loyer, courses, salaire, epargne]
    }

    private let txCoop = TestDataFactory.createTransaction(
        id: "tx-1", name: "Coop Pronto", amount: 45
    )
    private let txMigros = TestDataFactory.createTransaction(
        id: "tx-2", name: "Migros Zürich", amount: 150
    )
    private let txSbb = TestDataFactory.createTransaction(
        id: "tx-3", name: "CFF abonnement", amount: 340
    )

    private var allFreeTransactions: [Transaction] {
        [txCoop, txMigros, txSbb]
    }

    // MARK: - CA7: Empty search returns all items

    @Test
    func searchBudgetLines_emptyText_returnsAll() {
        let result = filterLines(allLines, searchText: "", transactions: [])

        #expect(result.count == allLines.count)
    }

    @Test
    func searchFreeTransactions_emptyText_returnsAll() {
        let result = filterFreeTransactions(allFreeTransactions, searchText: "")

        #expect(result.count == allFreeTransactions.count)
    }

    // MARK: - CA3: Name matching (partial, case-insensitive)

    @Test
    func searchBudgetLines_partialName_matchesSubstring() {
        let result = filterLines(allLines, searchText: "loy", transactions: [])

        #expect(result.count == 1)
        #expect(result.first?.id == "line-1")
    }

    @Test
    func searchBudgetLines_caseInsensitive_matchesRegardlessOfCase() {
        let result = filterLines(allLines, searchText: "SALAIRE", transactions: [])

        #expect(result.count == 1)
        #expect(result.first?.id == "line-3")
    }

    /// Verifies accent-insensitive search: "epargne" matches "Épargne".
    /// Relies on `localizedStandardContains` which performs locale-aware, diacritic-insensitive comparison.
    @Test
    func searchBudgetLines_accentInsensitive_matchesWithoutAccent() {
        let result = filterLines(allLines, searchText: "epargne", transactions: [])

        #expect(result.count == 1)
        #expect(result.first?.id == "line-4")
    }

    @Test
    func searchFreeTransactions_partialName_matchesSubstring() {
        let result = filterFreeTransactions(allFreeTransactions, searchText: "migros")

        #expect(result.count == 1)
        #expect(result.first?.id == "tx-2")
    }

    // MARK: - CA4: Amount matching

    @Test
    func searchBudgetLines_amount_matchesExactAmount() {
        let result = filterLines(allLines, searchText: "1500", transactions: [])

        #expect(result.count == 1)
        #expect(result.first?.id == "line-1")
    }

    @Test
    func searchBudgetLines_partialAmount_matchesContainedDigits() {
        let result = filterLines(allLines, searchText: "50", transactions: [])

        #expect(result.contains { $0.id == "line-1" })
        #expect(result.contains { $0.id == "line-2" })
        #expect(result.contains { $0.id == "line-3" })
    }

    @Test
    func searchFreeTransactions_amount_matchesExactAmount() {
        let result = filterFreeTransactions(allFreeTransactions, searchText: "150")

        #expect(result.count == 1)
        #expect(result.first?.id == "tx-2")
    }

    @Test
    func searchFreeTransactions_partialAmount_matchesContainedDigits() {
        let result = filterFreeTransactions(allFreeTransactions, searchText: "4")

        #expect(result.contains { $0.id == "tx-1" })
        #expect(result.contains { $0.id == "tx-3" })
    }

    // MARK: - CA4: Linked transaction name matching

    @Test
    func searchBudgetLines_matchesLinkedTransactionName() {
        let line = TestDataFactory.createBudgetLine(id: "line-x", name: "Courses", amount: 300)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-linked", budgetLineId: "line-x", name: "Migros Lausanne", amount: 55
        )

        let result = filterLines([line], searchText: "Migros", transactions: [linkedTx])

        #expect(result.count == 1)
        #expect(result.first?.id == "line-x")
    }

    @Test
    func searchBudgetLines_matchesLinkedTransactionAmount() {
        let line = TestDataFactory.createBudgetLine(id: "line-x", name: "Courses", amount: 300)
        let linkedTx = TestDataFactory.createTransaction(
            id: "tx-linked", budgetLineId: "line-x", name: "Migros Lausanne", amount: 55
        )

        let result = filterLines([line], searchText: "55", transactions: [linkedTx])

        #expect(result.count == 1)
        #expect(result.first?.id == "line-x")
    }

    // MARK: - CA6: No match returns empty

    @Test
    func searchBudgetLines_noMatch_returnsEmpty() {
        let result = filterLines(allLines, searchText: "xyz", transactions: [])

        #expect(result.isEmpty)
    }

    @Test
    func searchFreeTransactions_noMatch_returnsEmpty() {
        let result = filterFreeTransactions(allFreeTransactions, searchText: "zzz999")

        #expect(result.isEmpty)
    }

    // MARK: - Test Helpers

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
