import Foundation
@testable import Pulpe
import Testing

struct BudgetFormulasTests {
    // MARK: - Income Calculations

    @Test func calculateTotalIncome_withBudgetLinesOnly_returnsSum() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 500, kind: .income)
        ]
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines)
        #expect(result == 3500)
    }

    @Test func calculateTotalIncome_withTransactionsOnly_returnsSum() {
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 200, kind: .income),
            TestDataFactory.createTransaction(id: "2", amount: 150, kind: .income)
        ]
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: [], transactions: transactions)
        #expect(result == 350)
    }

    @Test func calculateTotalIncome_withMixedSources_returnsCombinedSum() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 200, kind: .income)
        ]
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines, transactions: transactions)
        #expect(result == 3200)
    }

    @Test func calculateTotalIncome_excludesRolloverLines() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income, isRollover: false),
            TestDataFactory.createBudgetLine(id: "2", amount: 500, kind: .income, isRollover: true)
        ]
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines)
        #expect(result == 3000)
    }

    @Test func calculateTotalIncome_ignoresExpensesAndSavings() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 500, kind: .expense),
            TestDataFactory.createBudgetLine(id: "3", amount: 200, kind: .saving)
        ]
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines)
        #expect(result == 3000)
    }

    // MARK: - Expense Calculations

    @Test func calculateTotalExpenses_withExpensesOnly_returnsSum() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .expense)
        ]
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines)
        #expect(result == 1000)
    }

    @Test func calculateTotalExpenses_includesSavings() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .saving)
        ]
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines)
        #expect(result == 1000)
    }

    @Test func calculateTotalExpenses_excludesRolloverLines() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense, isRollover: false),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .expense, isRollover: true)
        ]
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines)
        #expect(result == 800)
    }

    @Test func calculateTotalExpenses_withTransactions_returnsCombinedSum() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 50, kind: .expense)
        ]
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines, transactions: transactions)
        #expect(result == 850)
    }

    // MARK: - Savings Calculations

    @Test func calculateTotalSavings_withSavingsOnly_returnsSum() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 200, kind: .saving),
            TestDataFactory.createBudgetLine(id: "2", amount: 300, kind: .saving)
        ]
        let result = BudgetFormulas.calculateTotalSavings(budgetLines: lines)
        #expect(result == 500)
    }

    @Test func calculateTotalSavings_excludesExpensesAndIncome() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 200, kind: .saving),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense),
            TestDataFactory.createBudgetLine(id: "3", amount: 3000, kind: .income)
        ]
        let result = BudgetFormulas.calculateTotalSavings(budgetLines: lines)
        #expect(result == 200)
    }

    // MARK: - Realized Calculations

    @Test func calculateRealizedIncome_onlyCountsCheckedItems() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 500, kind: .income, isChecked: false)
        ]
        let result = BudgetFormulas.calculateRealizedIncome(budgetLines: lines)
        #expect(result == 3000)
    }

    @Test func calculateRealizedExpenses_checkedEnvelopeUsesMaxOfEnvelopeAndConsumed() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense, isChecked: true)
        ]
        let transactions = [
            TestDataFactory.createTransaction(
                id: "tx-1",
                budgetLineId: "1",
                amount: 200,
                kind: .expense,
                isChecked: true
            ),
            TestDataFactory.createTransaction(
                id: "tx-2",
                budgetLineId: "1",
                amount: 150,
                kind: .expense,
                isChecked: true
            )
        ]
        let result = BudgetFormulas.calculateRealizedExpenses(
            budgetLines: lines,
            transactions: transactions
        )
        #expect(result == 500)
    }

    @Test func calculateRealizedExpenses_uncheckedParentCountsCheckedTransactions() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense, isChecked: false)
        ]
        let transactions = [
            TestDataFactory.createTransaction(
                id: "tx-1",
                budgetLineId: "1",
                amount: 200,
                kind: .expense,
                isChecked: true
            ),
            TestDataFactory.createTransaction(
                id: "tx-2",
                budgetLineId: "1",
                amount: 150,
                kind: .expense,
                isChecked: false
            )
        ]
        let result = BudgetFormulas.calculateRealizedExpenses(
            budgetLines: lines,
            transactions: transactions
        )
        #expect(result == 200)
    }

    @Test func calculateRealizedExpenses_checkedParentUsesMaxWhenTransactionsExceedEnvelope() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 100, kind: .expense, isChecked: true)
        ]
        let transactions = [
            TestDataFactory.createTransaction(
                id: "tx-1",
                budgetLineId: "1",
                amount: 150,
                kind: .expense,
                isChecked: true
            )
        ]
        let result = BudgetFormulas.calculateRealizedExpenses(
            budgetLines: lines,
            transactions: transactions
        )
        #expect(result == 150)
    }

    @Test func calculateRealizedExpenses_freeTransactionsCountedDirectly() {
        let lines: [BudgetLine] = []
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", amount: 50, kind: .expense, isChecked: true),
            TestDataFactory.createTransaction(id: "tx-2", amount: 30, kind: .expense, isChecked: true)
        ]
        let result = BudgetFormulas.calculateRealizedExpenses(budgetLines: lines, transactions: transactions)
        #expect(result == 80)
    }

    @Test func calculateRealizedExpenses_checkedEnvelopeWithoutTransactions() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 800, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .expense, isChecked: false)
        ]
        let result = BudgetFormulas.calculateRealizedExpenses(budgetLines: lines)
        #expect(result == 800)
    }

    @Test func calculateRealizedBalance_correctlyCalculatesDifference() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense, isChecked: true)
        ]
        let result = BudgetFormulas.calculateRealizedBalance(budgetLines: lines)
        #expect(result == 2200)
    }

    // MARK: - Core Formulas

    @Test func calculateAvailable_addsIncomeAndRollover() {
        let income: Decimal = 3000
        let rollover: Decimal = 500
        let result = BudgetFormulas.calculateAvailable(totalIncome: income, rollover: rollover)
        #expect(result == 3500)
    }

    @Test func calculateAvailable_withNegativeRollover_subtractsFromIncome() {
        let income: Decimal = 3000
        let rollover: Decimal = -200
        let result = BudgetFormulas.calculateAvailable(totalIncome: income, rollover: rollover)
        #expect(result == 2800)
    }

    @Test func calculateEndingBalance_subtractsExpensesFromAvailable() {
        let available: Decimal = 3500
        let expenses: Decimal = 2000
        let result = BudgetFormulas.calculateEndingBalance(available: available, totalExpenses: expenses)
        #expect(result == 1500)
    }

    @Test func calculateEndingBalance_canBeNegative() {
        let available: Decimal = 3000
        let expenses: Decimal = 3500
        let result = BudgetFormulas.calculateEndingBalance(available: available, totalExpenses: expenses)
        #expect(result == -500)
    }

    @Test func calculateRemaining_matchesEndingBalance() {
        let available: Decimal = 3000
        let expenses: Decimal = 2000
        let ending = BudgetFormulas.calculateEndingBalance(available: available, totalExpenses: expenses)
        let remaining = BudgetFormulas.calculateRemaining(available: available, totalExpenses: expenses)
        #expect(remaining == ending)
    }

    // MARK: - All Metrics

    @Test func calculateAllMetrics_withPositiveBudget_calculatesCorrectly() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense),
            TestDataFactory.createBudgetLine(id: "3", amount: 200, kind: .saving)
        ]
        let rollover: Decimal = 500
        let metrics = BudgetFormulas.calculateAllMetrics(
            budgetLines: lines,
            rollover: rollover
        )
        #expect(metrics.totalIncome == 3000)
        #expect(metrics.totalExpenses == 1000)
        #expect(metrics.totalSavings == 200)
        #expect(metrics.available == 3500)
        #expect(metrics.endingBalance == 2500)
        #expect(metrics.remaining == 2500)
        #expect(metrics.rollover == 500)
    }

    @Test func calculateAllMetrics_withDeficit_showsNegativeBalance() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 3500, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.isDeficit)
        #expect(metrics.remaining == -500)
    }

    @Test func metrics_usagePercentage_calculatesCorrectly() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 250, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(abs(metrics.usagePercentage - 25.0) < 0.01)
    }

    @Test func metrics_usagePercentage_canExceed100() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 1200, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.usagePercentage > 100)
    }
}
