import Foundation
@testable import Pulpe
import Testing

struct BudgetFormulasExtendedTests {
    // MARK: - Consumption Calculations

    @Test func calculateConsumption_normalCase_returnsCorrectValues() {
        let line = TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 200, kind: .expense),
            TestDataFactory.createTransaction(id: "tx-2", budgetLineId: "1", amount: 100, kind: .expense)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.allocated == 300)
        #expect(consumption.available == 200)
        #expect(abs(consumption.percentage - 60) < 0.01)
    }

    @Test func calculateConsumption_zeroAmount_returnsZeroPercentage() {
        let line = TestDataFactory.createBudgetLine(id: "1", amount: 0, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 50, kind: .expense)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.allocated == 50)
        #expect(consumption.percentage == 0)
    }

    @Test func calculateConsumption_overBudget_exceeds100Percent() {
        let line = TestDataFactory.createBudgetLine(id: "1", amount: 200, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 300, kind: .expense)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.isOverBudget)
        #expect(consumption.percentage > 100)
        #expect(consumption.available == -100)
    }

    @Test func calculateConsumption_at80Percent_isNearLimit() {
        let line = TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 800, kind: .expense)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.isNearLimit)
        #expect(!consumption.isOverBudget)
    }

    @Test func calculateConsumption_noTransactions_returnsZero() {
        let line = TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense)
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: [])
        #expect(consumption.allocated == 0)
        #expect(consumption.available == 500)
        #expect(consumption.percentage == 0)
    }

    @Test func calculateConsumption_ignoresUnrelatedTransactions() {
        let line = TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense)
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "other", amount: 300, kind: .expense),
            TestDataFactory.createTransaction(id: "tx-2", budgetLineId: "1", amount: 100, kind: .expense)
        ]
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        #expect(consumption.allocated == 100)
    }

    // MARK: - Projection Calculations

    @Test func calculateProjection_currentMonth_returnsProjection() throws {
        let calendar = Calendar.current
        let now = Date()
        let month = calendar.component(.month, from: now)
        let year = calendar.component(.year, from: now)

        let projection = BudgetFormulas.calculateProjection(
            realizedExpenses: 1000,
            totalBudgetedExpenses: 2000,
            available: 3000,
            month: month,
            year: year,
            referenceDate: now
        )

        let result = try #require(projection)
        #expect(result.daysElapsed >= 1)
        #expect(result.dailySpendingRate >= 0)
    }

    @Test func calculateProjection_pastMonth_returnsNil() {
        let calendar = Calendar.current
        let now = Date()
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)
        let pastMonth = currentMonth == 1 ? 12 : currentMonth - 1
        let pastYear = currentMonth == 1 ? currentYear - 1 : currentYear

        let projection = BudgetFormulas.calculateProjection(
            realizedExpenses: 1000,
            totalBudgetedExpenses: 2000,
            available: 3000,
            month: pastMonth,
            year: pastYear,
            referenceDate: now
        )
        #expect(projection == nil)
    }

    @Test func calculateProjection_futureMonth_returnsNil() {
        let calendar = Calendar.current
        let now = Date()
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)
        let futureMonth = currentMonth == 12 ? 1 : currentMonth + 1
        let futureYear = currentMonth == 12 ? currentYear + 1 : currentYear

        let projection = BudgetFormulas.calculateProjection(
            realizedExpenses: 0,
            totalBudgetedExpenses: 2000,
            available: 3000,
            month: futureMonth,
            year: futureYear,
            referenceDate: now
        )
        #expect(projection == nil)
    }

    @Test func calculateProjection_dayOne_usesOneDayElapsed() throws {
        let calendar = Calendar.current
        let now = Date()
        let month = calendar.component(.month, from: now)
        let year = calendar.component(.year, from: now)

        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = 1
        let dayOne = try #require(calendar.date(from: components))

        let projection = BudgetFormulas.calculateProjection(
            realizedExpenses: 100,
            totalBudgetedExpenses: 2000,
            available: 3000,
            month: month,
            year: year,
            referenceDate: dayOne
        )

        let result = try #require(projection)
        #expect(result.daysElapsed == 1)
    }

    @Test func calculateProjection_zeroExpenses_isOnTrack() throws {
        let calendar = Calendar.current
        let now = Date()
        let month = calendar.component(.month, from: now)
        let year = calendar.component(.year, from: now)

        let projection = BudgetFormulas.calculateProjection(
            realizedExpenses: 0,
            totalBudgetedExpenses: 2000,
            available: 3000,
            month: month,
            year: year,
            referenceDate: now
        )

        let result = try #require(projection)
        #expect(result.isOnTrack)
        #expect(result.projectedEndOfMonthBalance == 3000)
    }

    // MARK: - Realized Metrics

    @Test func calculateRealizedMetrics_completionPercentage() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 300, kind: .expense, isChecked: false)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", amount: 100, kind: .expense, isChecked: true)
        ]
        let metrics = BudgetFormulas.calculateRealizedMetrics(
            budgetLines: lines,
            transactions: transactions
        )
        // 2 checked (line1 + tx1) out of 3 total
        #expect(metrics.checkedItemsCount == 2)
        #expect(metrics.totalItemsCount == 3)
        #expect(abs(metrics.completionPercentage - 66.66) < 0.67)
    }

    @Test func calculateRealizedMetrics_emptyItems_zeroCompletion() {
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: [], transactions: [])
        #expect(metrics.completionPercentage == 0)
        #expect(metrics.checkedItemsCount == 0)
        #expect(metrics.totalItemsCount == 0)
    }

    @Test func calculateRealizedMetrics_checkedSavingsAmount() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 200, kind: .saving, isChecked: true),
            TestDataFactory.createBudgetLine(id: "2", amount: 300, kind: .saving, isChecked: false),
            TestDataFactory.createBudgetLine(id: "3", amount: 500, kind: .expense, isChecked: true)
        ]
        let metrics = BudgetFormulas.calculateRealizedMetrics(budgetLines: lines)
        #expect(metrics.checkedSavingsAmount == 200)
    }

    // MARK: - Template Totals

    @Test func calculateTemplateTotals_sumsCorrectly() {
        let date = TestDataFactory.fixedDate
        let lines = [
            TemplateLine(
                id: "1", templateId: "t1", name: "Salaire", amount: 5000,
                kind: .income, recurrence: .fixed, description: "",
                createdAt: date, updatedAt: date
            ),
            TemplateLine(
                id: "2", templateId: "t1", name: "Loyer", amount: 1500,
                kind: .expense, recurrence: .fixed, description: "",
                createdAt: date, updatedAt: date
            ),
            TemplateLine(
                id: "3", templateId: "t1", name: "Épargne", amount: 500,
                kind: .saving, recurrence: .fixed, description: "",
                createdAt: date, updatedAt: date
            )
        ]
        let totals = BudgetFormulas.calculateTemplateTotals(lines: lines)
        #expect(totals.totalIncome == 5000)
        #expect(totals.totalExpenses == 2000)
        #expect(totals.balance == 3000)
    }

    // MARK: - Metrics Edge Cases

    @Test func metrics_usagePercentage_zeroAvailable_returnsZero() {
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: [])
        #expect(metrics.usagePercentage == 0)
    }

    @Test func metrics_isDeficit_whenRemainingNegative() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 1500, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.isDeficit)
        #expect(metrics.remaining == -500)
    }

    @Test func metrics_isDeficit_falseWhenPositive() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 1000, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(!metrics.isDeficit)
    }

    // MARK: - Emotion State (DA §3.1: 3-state system)

    @Test func emotionState_comfortable_whenUsageBelow80Percent() {
        // 79% usage → comfortable
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 790, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.emotionState == .comfortable)
    }

    @Test func emotionState_tight_atExactly80Percent() {
        // 80% usage → tight (boundary)
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.emotionState == .tight)
    }

    @Test func emotionState_tight_between80And100Percent() {
        // 90% usage → tight
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 900, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.emotionState == .tight)
    }

    @Test func emotionState_tight_atExactly100Percent() {
        // 100% usage, remaining = 0 → tight (not deficit)
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 1000, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.emotionState == .tight)
        #expect(!metrics.isDeficit)
    }

    @Test func emotionState_deficit_whenRemainingNegative() {
        // 120% usage, remaining < 0 → deficit
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 1000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 1200, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines)
        #expect(metrics.emotionState == .deficit)
    }

    @Test func emotionState_comfortable_whenZeroAvailable() {
        // No income, no expenses → available=0, usagePercentage=0 → comfortable
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: [])
        #expect(metrics.emotionState == .comfortable)
    }
}
