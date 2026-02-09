import XCTest
@testable import Pulpe

/// Tests for BudgetFormulas - Core business logic calculations
/// Following AAA pattern and testing behavior, not implementation
final class BudgetFormulasTests: XCTestCase {

    // MARK: - Income Calculations

    func testCalculateTotalIncome_withBudgetLinesOnly_returnsSum() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 500, kind: .income)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 3500)
    }

    func testCalculateTotalIncome_withTransactionsOnly_returnsSum() {
        // Arrange
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 200, kind: .income),
            TestDataFactory.createTransaction(id: "2", amount: 150, kind: .income)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: [], transactions: transactions)

        // Assert
        XCTAssertEqual(result, 350)
    }

    func testCalculateTotalIncome_withMixedSources_returnsCombinedSum() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 200, kind: .income)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines, transactions: transactions)

        // Assert
        XCTAssertEqual(result, 3200)
    }

    func testCalculateTotalIncome_excludesRolloverLines() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income, isRollover: false),
            TestDataFactory.createBudgetLine(id: "2", amount: 500, kind: .income, isRollover: true)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 3000, "Rollover lines should be excluded from income calculation")
    }

    func testCalculateTotalIncome_ignoresExpensesAndSavings() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 500, kind: .expense),
            TestDataFactory.createBudgetLine(id: "3", amount: 200, kind: .saving)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 3000)
    }

    // MARK: - Expense Calculations

    func testCalculateTotalExpenses_withExpensesOnly_returnsSum() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .expense)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 1000)
    }

    func testCalculateTotalExpenses_includesSavings() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .saving)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 1000, "Savings should be treated as expenses per SPECS")
    }

    func testCalculateTotalExpenses_excludesRolloverLines() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense, isRollover: false),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .expense, isRollover: true)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 800, "Rollover lines should be excluded from expense calculation")
    }

    func testCalculateTotalExpenses_withTransactions_returnsCombinedSum() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 50, kind: .expense)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines, transactions: transactions)

        // Assert
        XCTAssertEqual(result, 850)
    }

    // MARK: - Savings Calculations

    func testCalculateTotalSavings_withSavingsOnly_returnsSum() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 200, kind: .saving),
            TestDataFactory.createBudgetLine(id: "2", amount: 300, kind: .saving)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalSavings(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 500)
    }

    func testCalculateTotalSavings_excludesExpensesAndIncome() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 200, kind: .saving),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense),
            TestDataFactory.createBudgetLine(id: "3", amount: 3000, kind: .income)
        ]

        // Act
        let result = BudgetFormulas.calculateTotalSavings(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 200)
    }

    // MARK: - Realized Calculations

    func testCalculateRealizedIncome_onlyCountsCheckedItems() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 500, kind: .income, isChecked: false)
        ]

        // Act
        let result = BudgetFormulas.calculateRealizedIncome(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 3000, "Only checked items should be counted in realized income")
    }

    func testCalculateRealizedExpenses_checkedEnvelopeUsesMaxOfEnvelopeAndConsumed() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense, isChecked: true)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 200, kind: .expense, isChecked: true),
            TestDataFactory.createTransaction(id: "tx-2", budgetLineId: "1", amount: 150, kind: .expense, isChecked: true)
        ]

        let result = BudgetFormulas.calculateRealizedExpenses(budgetLines: lines, transactions: transactions)

        // max(500, 350) = 500
        XCTAssertEqual(result, 500)
    }

    func testCalculateRealizedExpenses_uncheckedParentCountsCheckedTransactions() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense, isChecked: false)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 200, kind: .expense, isChecked: true),
            TestDataFactory.createTransaction(id: "tx-2", budgetLineId: "1", amount: 150, kind: .expense, isChecked: false)
        ]

        let result = BudgetFormulas.calculateRealizedExpenses(budgetLines: lines, transactions: transactions)

        // Unchecked parent → only checked transactions count
        XCTAssertEqual(result, 200)
    }

    func testCalculateRealizedExpenses_checkedParentUsesMaxWhenTransactionsExceedEnvelope() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 100, kind: .expense, isChecked: true)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 150, kind: .expense, isChecked: true)
        ]

        let result = BudgetFormulas.calculateRealizedExpenses(budgetLines: lines, transactions: transactions)

        // max(100, 150) = 150
        XCTAssertEqual(result, 150)
    }

    func testCalculateRealizedExpenses_freeTransactionsCountedDirectly() {
        let lines: [BudgetLine] = []
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", amount: 50, kind: .expense, isChecked: true),
            TestDataFactory.createTransaction(id: "tx-2", amount: 30, kind: .expense, isChecked: true)
        ]

        let result = BudgetFormulas.calculateRealizedExpenses(budgetLines: lines, transactions: transactions)

        XCTAssertEqual(result, 80)
    }

    func testCalculateRealizedExpenses_checkedEnvelopeWithoutTransactions() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .expense, isChecked: false)
        ]

        let result = BudgetFormulas.calculateRealizedExpenses(budgetLines: lines)

        // Checked: max(800, 0) = 800. Unchecked with no transactions: 0
        XCTAssertEqual(result, 800)
    }

    func testCalculateRealizedBalance_correctlyCalculatesDifference() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense, isChecked: true)
        ]

        // Act
        let result = BudgetFormulas.calculateRealizedBalance(budgetLines: lines)

        // Assert
        XCTAssertEqual(result, 2200, "Realized balance should be realized income minus realized expenses")
    }

    // MARK: - Core Formulas

    func testCalculateAvailable_addsIncomeAndRollover() {
        // Arrange
        let income: Decimal = 3000
        let rollover: Decimal = 500

        // Act
        let result = BudgetFormulas.calculateAvailable(totalIncome: income, rollover: rollover)

        // Assert
        XCTAssertEqual(result, 3500)
    }

    func testCalculateAvailable_withNegativeRollover_subtractsFromIncome() {
        // Arrange
        let income: Decimal = 3000
        let rollover: Decimal = -200

        // Act
        let result = BudgetFormulas.calculateAvailable(totalIncome: income, rollover: rollover)

        // Assert
        XCTAssertEqual(result, 2800)
    }

    func testCalculateEndingBalance_subtractsExpensesFromAvailable() {
        // Arrange
        let available: Decimal = 3500
        let expenses: Decimal = 2000

        // Act
        let result = BudgetFormulas.calculateEndingBalance(available: available, totalExpenses: expenses)

        // Assert
        XCTAssertEqual(result, 1500)
    }

    func testCalculateEndingBalance_canBeNegative() {
        // Arrange
        let available: Decimal = 3000
        let expenses: Decimal = 3500

        // Act
        let result = BudgetFormulas.calculateEndingBalance(available: available, totalExpenses: expenses)

        // Assert
        XCTAssertEqual(result, -500, "Ending balance can be negative when expenses exceed available")
    }

    func testCalculateRemaining_matchesEndingBalance() {
        // Arrange
        let available: Decimal = 3000
        let expenses: Decimal = 2000

        // Act
        let ending = BudgetFormulas.calculateEndingBalance(available: available, totalExpenses: expenses)
        let remaining = BudgetFormulas.calculateRemaining(available: available, totalExpenses: expenses)

        // Assert
        XCTAssertEqual(remaining, ending, "Remaining should equal ending balance per SPECS")
    }

    // MARK: - All Metrics

    func testCalculateAllMetrics_withPositiveBudget_calculatesCorrectly() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense),
            TestDataFactory.createBudgetLine(id: "3", amount: 200, kind: .saving)
        ]
        let rollover: Decimal = 500

        // Act
        let metrics = BudgetFormulas.calculateAllMetrics(
            budgetLines: lines,
            rollover: rollover
        )

        // Assert
        XCTAssertEqual(metrics.totalIncome, 3000)
        XCTAssertEqual(metrics.totalExpenses, 1000)
        XCTAssertEqual(metrics.totalSavings, 200)
        XCTAssertEqual(metrics.available, 3500)
        XCTAssertEqual(metrics.endingBalance, 2500)
        XCTAssertEqual(metrics.remaining, 2500)
        XCTAssertEqual(metrics.rollover, 500)
    }

    func testCalculateAllMetrics_withDeficit_showsNegativeBalance() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 3500, kind: .expense)
        ]

        // Act
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)

        // Assert
        XCTAssertTrue(metrics.isDeficit)
        XCTAssertEqual(metrics.remaining, -500)
    }

    func testMetrics_usagePercentage_calculatesCorrectly() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 250, kind: .expense)
        ]

        // Act
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)

        // Assert
        XCTAssertEqual(metrics.usagePercentage, 25.0, accuracy: 0.01)
    }

    func testMetrics_usagePercentage_canExceed100() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 1200, kind: .expense)
        ]

        // Act
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)

        // Assert
        XCTAssertGreaterThan(metrics.usagePercentage, 100)
    }

    // MARK: - Realized Metrics

    func testCalculateRealizedMetrics_tracksCheckedItems() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "3", amount: 200, kind: .expense, isChecked: false)
        ]

        // Act
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: lines)

        // Assert
        XCTAssertEqual(metrics.realizedIncome, 3000)
        XCTAssertEqual(metrics.realizedExpenses, 800)
        XCTAssertEqual(metrics.realizedBalance, 2200)
        XCTAssertEqual(metrics.checkedItemsCount, 2)
        XCTAssertEqual(metrics.totalItemsCount, 3)
    }

    func testRealizedMetrics_completionPercentage_calculatesCorrectly() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", isChecked: true),
            TestDataFactory.createBudgetLine(id: "3", isChecked: false),
            TestDataFactory.createBudgetLine(id: "4", isChecked: false)
        ]

        // Act
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: lines)

        // Assert
        XCTAssertEqual(metrics.completionPercentage, 50.0, accuracy: 0.01)
    }

    // MARK: - Consumption Tracking

    func testCalculateConsumption_withNoTransactions_showsFullAvailable() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .expense)
        let transactions: [Transaction] = []

        // Act
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)

        // Assert
        XCTAssertEqual(consumption.allocated, 0)
        XCTAssertEqual(consumption.available, 1000)
        XCTAssertEqual(consumption.percentage, 0)
        XCTAssertFalse(consumption.isOverBudget)
        XCTAssertFalse(consumption.isNearLimit)
    }

    func testCalculateConsumption_withPartialAllocation_calculatesCorrectly() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "1", budgetLineId: "line-1", amount: 300),
            TestDataFactory.createTransaction(id: "2", budgetLineId: "line-1", amount: 200)
        ]

        // Act
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)

        // Assert
        XCTAssertEqual(consumption.allocated, 500)
        XCTAssertEqual(consumption.available, 500)
        XCTAssertEqual(consumption.percentage, 50.0, accuracy: 0.01)
        XCTAssertFalse(consumption.isOverBudget)
        XCTAssertFalse(consumption.isNearLimit)
    }

    func testCalculateConsumption_whenNearLimit_flagsWarning() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "1", budgetLineId: "line-1", amount: 850)
        ]

        // Act
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)

        // Assert
        XCTAssertTrue(consumption.isNearLimit, "Should flag when consumption is >= 80%")
        XCTAssertFalse(consumption.isOverBudget)
    }

    func testCalculateConsumption_whenOverBudget_flagsError() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "1", budgetLineId: "line-1", amount: 1200)
        ]

        // Act
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)

        // Assert
        XCTAssertTrue(consumption.isOverBudget, "Should flag when consumption exceeds budget")
        XCTAssertEqual(consumption.available, -200)
    }

    func testCalculateConsumption_ignoresTransactionsFromOtherLines() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "1", budgetLineId: "line-1", amount: 300),
            TestDataFactory.createTransaction(id: "2", budgetLineId: "line-2", amount: 500)
        ]

        // Act
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)

        // Assert
        XCTAssertEqual(consumption.allocated, 300, "Should only count transactions for this line")
    }

    // MARK: - Edge Cases

    func testCalculateAllMetrics_withEmptyData_returnsZeros() {
        // Arrange
        let emptyLines: [BudgetLine] = []

        // Act
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: emptyLines)

        // Assert
        XCTAssertEqual(metrics.totalIncome, 0)
        XCTAssertEqual(metrics.totalExpenses, 0)
        XCTAssertEqual(metrics.totalSavings, 0)
        XCTAssertEqual(metrics.available, 0)
        XCTAssertEqual(metrics.endingBalance, 0)
    }

    func testMetrics_usagePercentage_withZeroAvailable_returnsZero() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense)
        ]

        // Act
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)

        // Assert
        XCTAssertEqual(metrics.usagePercentage, 0, "Should return 0% when available is 0")
    }

    func testRealizedMetrics_completionPercentage_withNoItems_returnsZero() {
        // Arrange
        let emptyLines: [BudgetLine] = []

        // Act
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: emptyLines)

        // Assert
        XCTAssertEqual(metrics.completionPercentage, 0)
    }
}
