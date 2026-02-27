import Foundation
@testable import Pulpe
import Testing

struct BudgetFormulasRealizedTests {
    // MARK: - Realized Metrics

    @Test func calculateRealizedMetrics_tracksCheckedItems() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "3", amount: 200, kind: .expense, isChecked: false)
        ]
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: lines)
        #expect(metrics.realizedIncome == 3000)
        #expect(metrics.realizedExpenses == 800)
        #expect(metrics.realizedBalance == 2200)
        #expect(metrics.checkedItemsCount == 2)
        #expect(metrics.totalItemsCount == 3)
    }

    @Test func realizedMetrics_completionPercentage_calculatesCorrectly() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", isChecked: true),
            TestDataFactory.createBudgetLine(id: "3", isChecked: false),
            TestDataFactory.createBudgetLine(id: "4", isChecked: false)
        ]
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: lines)
        #expect(abs(metrics.completionPercentage - 50.0) < 0.01)
    }

    // MARK: - Consumption Tracking

    @Test func calculateConsumption_withNoTransactions_showsFullAvailable() {
        let line = TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .expense)
        let transactions: [Transaction] = []
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.allocated == 0)
        #expect(consumption.available == 1000)
        #expect(consumption.percentage == 0)
        #expect(!consumption.isOverBudget)
        #expect(!consumption.isNearLimit)
    }

    @Test func calculateConsumption_withPartialAllocation_calculatesCorrectly() {
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "1", budgetLineId: "line-1", amount: 300),
            TestDataFactory.createTransaction(id: "2", budgetLineId: "line-1", amount: 200)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.allocated == 500)
        #expect(consumption.available == 500)
        #expect(abs(consumption.percentage - 50.0) < 0.01)
        #expect(!consumption.isOverBudget)
        #expect(!consumption.isNearLimit)
    }

    @Test func calculateConsumption_whenNearLimit_flagsWarning() {
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "1", budgetLineId: "line-1", amount: 850)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.isNearLimit)
        #expect(!consumption.isOverBudget)
    }

    @Test func calculateConsumption_whenOverBudget_flagsError() {
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "1", budgetLineId: "line-1", amount: 1200)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.isOverBudget)
        #expect(consumption.available == -200)
    }

    @Test func calculateConsumption_ignoresTransactionsFromOtherLines() {
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "1", budgetLineId: "line-1", amount: 300),
            TestDataFactory.createTransaction(id: "2", budgetLineId: "line-2", amount: 500)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.allocated == 300)
    }

    // MARK: - Edge Cases

    @Test func calculateAllMetrics_withEmptyData_returnsZeros() {
        let emptyLines: [BudgetLine] = []
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: emptyLines)
        #expect(metrics.totalIncome == 0)
        #expect(metrics.totalExpenses == 0)
        #expect(metrics.totalSavings == 0)
        #expect(metrics.available == 0)
        #expect(metrics.endingBalance == 0)
    }

    @Test func metrics_usagePercentage_withZeroAvailable_returnsZero() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.usagePercentage == 0)
    }

    @Test func realizedMetrics_completionPercentage_withNoItems_returnsZero() {
        let emptyLines: [BudgetLine] = []
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: emptyLines)
        #expect(metrics.completionPercentage == 0)
    }
}
