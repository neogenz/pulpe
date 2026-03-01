import Foundation
@testable import Pulpe
import Testing

@Suite("PreviousBudgetSheetViewModel Tests")
@MainActor
struct PreviousBudgetSheetViewModelTests {
    // MARK: - Initialization

    @Test
    func init_storesBudgetId() {
        let viewModel = PreviousBudgetSheetViewModel(budgetId: "prev-budget-123")

        #expect(viewModel.budgetId == "prev-budget-123")
    }

    @Test
    func init_startsInLoadingState_whenNoCachedData() {
        let viewModel = PreviousBudgetSheetViewModel(budgetId: "test")

        #expect(viewModel.isLoading == true)
        #expect(viewModel.budget == nil)
        #expect(viewModel.budgetLines.isEmpty)
        #expect(viewModel.transactions.isEmpty)
        #expect(viewModel.error == nil)
    }

    @Test
    func init_prePopulatesFromCache_whenCachedDataExists() {
        let budget = TestDataFactory.createBudget(id: "cached-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", kind: .expense)
        let tx = TestDataFactory.createTransaction(id: "tx-1")

        BudgetDetailCache.shared.store(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [line],
            transactions: [tx]
        )
        defer { BudgetDetailCache.shared.invalidate(budgetId: budget.id) }

        let viewModel = PreviousBudgetSheetViewModel(budgetId: budget.id)

        #expect(viewModel.isLoading == false)
        #expect(viewModel.budget != nil)
        #expect(viewModel.budgetLines.count == 1)
        #expect(viewModel.transactions.count == 1)
    }

    // MARK: - Line Categorization

    @Test
    func incomeLines_returnsOnlyIncomeKind() {
        let income = TestDataFactory.createBudgetLine(id: "inc-1", kind: .income)
        let expense = TestDataFactory.createBudgetLine(id: "exp-1", kind: .expense)
        let saving = TestDataFactory.createBudgetLine(id: "sav-1", kind: .saving)
        let budget = TestDataFactory.createBudget()

        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [income, expense, saving],
            transactions: []
        )

        #expect(viewModel.incomeLines.count == 1)
        #expect(viewModel.incomeLines.first?.id == "inc-1")
    }

    @Test
    func expenseLines_returnsOnlyExpenseKind() {
        let income = TestDataFactory.createBudgetLine(id: "inc-1", kind: .income)
        let expense1 = TestDataFactory.createBudgetLine(id: "exp-1", kind: .expense)
        let expense2 = TestDataFactory.createBudgetLine(id: "exp-2", kind: .expense)
        let budget = TestDataFactory.createBudget()

        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [income, expense1, expense2],
            transactions: []
        )

        #expect(viewModel.expenseLines.count == 2)
        #expect(viewModel.expenseLines.allSatisfy { $0.kind == .expense })
    }

    @Test
    func savingLines_returnsOnlySavingKind() {
        let saving = TestDataFactory.createBudgetLine(id: "sav-1", kind: .saving)
        let expense = TestDataFactory.createBudgetLine(id: "exp-1", kind: .expense)
        let budget = TestDataFactory.createBudget()

        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [saving, expense],
            transactions: []
        )

        #expect(viewModel.savingLines.count == 1)
        #expect(viewModel.savingLines.first?.id == "sav-1")
    }

    @Test
    func categorizedLines_withEmptyData_allReturnEmpty() {
        let budget = TestDataFactory.createBudget()
        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [],
            transactions: []
        )

        #expect(viewModel.incomeLines.isEmpty)
        #expect(viewModel.expenseLines.isEmpty)
        #expect(viewModel.savingLines.isEmpty)
    }

    // MARK: - Free Transactions

    @Test
    func freeTransactions_returnsOnlyUnlinkedTransactions() {
        let freeTx = TestDataFactory.createTransaction(id: "tx-free", budgetLineId: nil)
        let linkedTx = TestDataFactory.createTransaction(id: "tx-linked", budgetLineId: "line-1")
        let budget = TestDataFactory.createBudget()

        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [],
            transactions: [freeTx, linkedTx]
        )

        #expect(viewModel.freeTransactions.count == 1)
        #expect(viewModel.freeTransactions.first?.id == "tx-free")
    }

    @Test
    func freeTransactions_whenAllLinked_returnsEmpty() {
        let linkedTx1 = TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "line-1")
        let linkedTx2 = TestDataFactory.createTransaction(id: "tx-2", budgetLineId: "line-2")
        let budget = TestDataFactory.createBudget()

        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [],
            transactions: [linkedTx1, linkedTx2]
        )

        #expect(viewModel.freeTransactions.isEmpty)
    }

    // MARK: - Rollover Info

    @Test
    func rolloverInfo_whenBudgetIsNil_returnsNil() {
        let viewModel = PreviousBudgetSheetViewModel(budgetId: "test")

        #expect(viewModel.rolloverInfo == nil)
    }

    @Test
    func rolloverInfo_whenRolloverIsZero_returnsNil() {
        let budget = TestDataFactory.createBudget(rollover: 0)
        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [],
            transactions: []
        )

        #expect(viewModel.rolloverInfo == nil)
    }

    @Test
    func rolloverInfo_whenRolloverIsPositive_returnsAmountAndPreviousBudgetId() {
        let budget = TestDataFactory.createBudget(
            rollover: 250,
            previousBudgetId: "prev-budget-456"
        )
        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [],
            transactions: []
        )

        let info = viewModel.rolloverInfo
        #expect(info != nil)
        #expect(info?.amount == 250)
        #expect(info?.previousBudgetId == "prev-budget-456")
    }

    @Test
    func rolloverInfo_whenRolloverIsNegative_returnsInfo() {
        let budget = TestDataFactory.createBudget(
            rollover: -100,
            previousBudgetId: nil
        )
        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [],
            transactions: []
        )

        let info = viewModel.rolloverInfo
        #expect(info != nil)
        #expect(info?.amount == -100)
        #expect(info?.previousBudgetId == nil)
    }

    // MARK: - Metrics

    @Test
    func metrics_withEmptyData_returnsZeroedValues() {
        let budget = TestDataFactory.createBudget()
        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [],
            transactions: []
        )

        let metrics = viewModel.metrics
        #expect(metrics.totalIncome == 0)
        #expect(metrics.totalExpenses == 0)
        #expect(metrics.totalSavings == 0)
    }

    @Test
    func metrics_reflectsBudgetLinesAndRollover() {
        let income = TestDataFactory.createBudgetLine(id: "inc-1", amount: 5000, kind: .income)
        let expense = TestDataFactory.createBudgetLine(id: "exp-1", amount: 2000, kind: .expense)
        let budget = TestDataFactory.createBudget(rollover: 300)

        let viewModel = PreviousBudgetSheetViewModel(
            budgetId: budget.id,
            budget: budget,
            budgetLines: [income, expense],
            transactions: []
        )

        let metrics = viewModel.metrics
        #expect(metrics.totalIncome == 5000)
        #expect(metrics.totalExpenses == 2000)
        #expect(metrics.rollover == 300)
    }
}
