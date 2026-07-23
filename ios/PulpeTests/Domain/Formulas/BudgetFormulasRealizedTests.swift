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

    // MARK: - Rollover in Realized Calculations
    //
    // Contract: the report enters the realized BALANCE via the `rollover` parameter, never
    // the flows. The virtual rollover line is always checked, so counting it in
    // realizedExpenses/Income inflated "Pointé" (home hero) and "Dépense réalisée" (sheet)
    // by the carried deficit — while the planned side routes rollover through `available`.

    @Test func calculateRealizedExpenses_excludesRolloverLine() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 100, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 50, kind: .expense, isChecked: true, isRollover: true)
        ]
        let expenses = BudgetFormulas.calculateRealizedExpenses(budgetLines: lines)
        #expect(expenses == 100)
    }

    @Test func calculateRealizedIncome_excludesRolloverLine() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 5000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 3094, kind: .income, isChecked: true, isRollover: true)
        ]
        let income = BudgetFormulas.calculateRealizedIncome(budgetLines: lines)
        #expect(income == 5000)
    }

    @Test func calculateRealizedBalance_carriesNegativeRolloverViaParameter() {
        // Same observable balance as when the virtual line inflated expenses: 5000 − 3000 − 1950.
        let rolloverLine = BudgetLine.rolloverLine(amount: -1950, budgetId: "b1", sourceBudgetId: nil)
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 5000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 3000, kind: .expense, isChecked: true),
            rolloverLine
        ]
        let balance = BudgetFormulas.calculateRealizedBalance(budgetLines: lines, rollover: -1950)
        #expect(balance == 50)
    }

    @Test func calculateRealizedBalance_carriesPositiveRolloverViaParameter() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 5000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 3094, kind: .income, isChecked: true, isRollover: true),
            TestDataFactory.createBudgetLine(id: "3", amount: 8000, kind: .expense, isChecked: true)
        ]
        let balance = BudgetFormulas.calculateRealizedBalance(budgetLines: lines, rollover: 3094)
        #expect(balance == 94)
    }

    /// Regression for the hero ledger: in a deficit-carryover month, "Pointé" must show
    /// true realized spending — not spending + the carried report — so that
    /// pointé + engagé + restant still sums to `available`.
    @Test func realizedMetrics_negativeRolloverMonth_keepsHeroLedgerIdentity() {
        let rolloverLine = BudgetLine.rolloverLine(amount: -1950, budgetId: "b1", sourceBudgetId: nil)
        let base = [
            TestDataFactory.createBudgetLine(id: "1", amount: 5000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 3000, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "3", amount: 1000, kind: .expense, isChecked: false)
        ]
        let display = [rolloverLine] + base

        let realized = BudgetFormulas.calculateRealizedMetrics(budgetLines: display, rollover: -1950)
        let planned = BudgetFormulas.calculateAllMetrics(budgetLines: base, rollover: -1950)

        #expect(realized.realizedExpenses == 3000) // report NOT counted as pointé
        #expect(realized.realizedBalance == 50)    // report still carried in the balance

        // Hero ledger identity: pointé + engagé + restant = available
        let pointe = realized.realizedExpenses
        let engage = max(planned.totalExpenses - pointe, 0)
        let identitySum = pointe + engage + planned.remaining
        #expect(identitySum == planned.available)
    }

    @Test func calculateRealizedMetrics_countsIncludeRolloverLine() {
        // Pointage counts are display-scoped and unchanged by the flow fix.
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 5000, kind: .income, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 3000, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "3", amount: 1950, kind: .expense, isChecked: true, isRollover: true)
        ]
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: lines, rollover: -1950)
        #expect(metrics.checkedItemsCount == 3)
        #expect(metrics.totalItemsCount == 3)
        #expect(metrics.realizedBalance == 50)
    }

    // MARK: - Realized Savings Envelope Logic

    @Test func realizedSavings_envelope_consumedExceedsLine() {
        let lines = [
            TestDataFactory.createBudgetLine(
                id: "line-1", amount: 100, kind: .saving, isChecked: true
            )
        ]
        let transactions = [
            TestDataFactory.createTransaction(
                id: "tx-1", budgetLineId: "line-1",
                amount: 200, kind: .saving, isChecked: true
            )
        ]
        let savings = BudgetFormulas.calculateRealizedSavings(
            budgetLines: lines, transactions: transactions
        )
        // max(100, 200) = 200 — no double counting
        #expect(savings == 200)
    }

    @Test func realizedSavings_freeTransaction_noParentLine() {
        let lines: [BudgetLine] = []
        let transactions = [
            TestDataFactory.createTransaction(
                id: "tx-1", budgetLineId: nil,
                amount: 75, kind: .saving, isChecked: true
            )
        ]
        let savings = BudgetFormulas.calculateRealizedSavings(
            budgetLines: lines, transactions: transactions
        )
        #expect(savings == 75)
    }

    @Test func realizedSavings_envelope_uncheckedParent() {
        let lines = [
            TestDataFactory.createBudgetLine(
                id: "line-1", amount: 200, kind: .saving, isChecked: false
            )
        ]
        let transactions = [
            TestDataFactory.createTransaction(
                id: "tx-1", budgetLineId: "line-1",
                amount: 150, kind: .saving, isChecked: true
            )
        ]
        let savings = BudgetFormulas.calculateRealizedSavings(
            budgetLines: lines, transactions: transactions
        )
        // Unchecked parent: only checked transactions count
        #expect(savings == 150)
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
