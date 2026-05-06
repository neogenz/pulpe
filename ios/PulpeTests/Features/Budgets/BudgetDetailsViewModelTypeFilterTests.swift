import Foundation
@testable import Pulpe
import Testing

/// Tests for the type filter (`Tout / Revenus / Épargne / Dépenses`) added in PUL-209,
/// the dynamic `kindCounts`, and the `.checked` persistence regression fix.
///
/// `.serialized` is required because every test mutates `UserDefaults.standard`
/// for the `pulpe-budget-line-type-filter` and `pulpe-budget-checked-filter` keys.
@Suite(.serialized)
@MainActor
struct BudgetDetailsViewModelTypeFilterTests {
    // MARK: - UserDefaults Keys (mirror BudgetDetailsViewModel)

    private static let typeFilterKey = "pulpe-budget-line-type-filter"
    private static let checkedFilterKey = "pulpe-budget-checked-filter"
    private static let legacyShowOnlyUncheckedKey = "pulpe-budget-show-only-unchecked"

    private func clearFilterDefaults() {
        UserDefaults.standard.removeObject(forKey: Self.typeFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.checkedFilterKey)
        UserDefaults.standard.removeObject(forKey: Self.legacyShowOnlyUncheckedKey)
    }

    // MARK: - Type Filter Persistence

    @Test
    func setTypeFilter_persistsAcrossInit_writesUserDefaults() {
        clearFilterDefaults()
        defer { clearFilterDefaults() }

        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        viewModel.setTypeFilter(.income)

        let recreated = BudgetDetailsViewModel(budgetId: "test-budget")

        #expect(recreated.typeFilter == .income)
    }

    // MARK: - Displayed Sections

    @Test
    func displayedSections_typeFilterAll_returnsAllKindsInOrder() {
        clearFilterDefaults()
        defer { clearFilterDefaults() }

        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        viewModel.setCheckedFilter(.all)
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving)
        )

        let sections = viewModel.displayedSections

        #expect(sections.count == 3)
        #expect(sections.map(\.kind) == [.income, .saving, .expense])
    }

    @Test
    func displayedSections_typeFilterIncome_returnsOnlyIncome() {
        clearFilterDefaults()
        defer { clearFilterDefaults() }

        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        viewModel.setCheckedFilter(.all)
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving)
        )
        viewModel.setTypeFilter(.income)

        let sections = viewModel.displayedSections

        #expect(sections.count == 1)
        #expect(sections.first?.kind == .income)
        #expect(sections.first?.items.map(\.id) == ["income-1"])
    }

    @Test
    func displayedSections_emptyKind_isOmitted() {
        clearFilterDefaults()
        defer { clearFilterDefaults() }

        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        viewModel.setCheckedFilter(.all)
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "income-2", kind: .income)
        )

        let sections = viewModel.displayedSections

        #expect(sections.count == 1)
        #expect(sections.first?.kind == .income)
        #expect(sections.first?.items.count == 2)
    }

    // MARK: - kindCounts (dynamic vs checked filter)

    @Test
    func kindCounts_dynamic_reflectsCheckedFilter() {
        clearFilterDefaults()
        defer { clearFilterDefaults() }

        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        // Income: 1 unchecked, 1 checked
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "income-2", kind: .income, isChecked: true)
        )
        // Expense: 2 unchecked, 1 checked
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "expense-2", kind: .expense)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "expense-3", kind: .expense, isChecked: true)
        )
        // Saving: 1 checked only
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "saving-1", kind: .saving, isChecked: true)
        )

        viewModel.setCheckedFilter(.unchecked)
        let counts = viewModel.kindCounts

        // Only unchecked lines should be counted: 1 income, 2 expense, 0 saving.
        #expect(counts.income == 1)
        #expect(counts.expense == 2)
        #expect(counts.saving == 0)
        #expect(counts.all == 3)
    }

    // MARK: - applyCheckedFilter via displayedSections

    @Test
    func applyCheckedFilter_checked_returnsOnlyChecked() {
        clearFilterDefaults()
        defer { clearFilterDefaults() }

        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "income-1", kind: .income, isChecked: true)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "income-2", kind: .income)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "expense-1", kind: .expense, isChecked: true)
        )
        viewModel.addBudgetLine(
            TestDataFactory.createBudgetLine(id: "expense-2", kind: .expense)
        )

        viewModel.setCheckedFilter(.checked)

        let sections = viewModel.displayedSections
        let allItems = sections.flatMap(\.items)

        #expect(allItems.count == 2)
        #expect(allItems.allSatisfy { $0.checkedAt != nil })
        #expect(Set(allItems.map(\.id)) == ["income-1", "expense-1"])
    }

    // MARK: - Checked Filter Persistence Regression

    /// Regression test: the `.checked` raw value must survive a relaunch.
    /// The earlier persistence path relied on a legacy Bool key that collapsed
    /// `.checked` onto `.all`, dropping the third state on restore.
    @Test
    func setCheckedFilter_persistsRawValue_acrossInit() {
        clearFilterDefaults()
        defer { clearFilterDefaults() }

        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        viewModel.setCheckedFilter(.checked)

        let recreated = BudgetDetailsViewModel(budgetId: "test-budget")

        #expect(recreated.checkedFilter == .checked)
    }
}
