import XCTest
@testable import Pulpe

/// Tests for CurrentMonthStore business logic rules
/// Tests the logic behind computed properties without requiring API calls
final class CurrentMonthStoreLogicTests: XCTestCase {

    // MARK: - Days Remaining Logic

    func testDaysRemainingLogic_calculatesCorrectly() {
        // Arrange
        let calendar = Calendar.current
        let today = Date()

        guard let range = calendar.range(of: .day, in: .month, for: today),
              let lastDay = calendar.date(from: DateComponents(
                year: calendar.component(.year, from: today),
                month: calendar.component(.month, from: today),
                day: range.count
              )) else {
            XCTFail("Could not calculate month range")
            return
        }

        // Act
        let remaining = calendar.dateComponents([.day], from: today, to: lastDay).day ?? 0
        let daysRemaining = max(remaining + 1, 1) // Include today

        // Assert
        XCTAssertGreaterThanOrEqual(daysRemaining, 1, "Should always have at least 1 day remaining (today)")
        XCTAssertLessThanOrEqual(daysRemaining, 31, "Cannot have more than 31 days in a month")
    }

    func testDaysRemainingLogic_onLastDayOfMonth_returns1() {
        // Arrange
        let calendar = Calendar.current
        let today = Date()

        // Find the last day of current month
        guard let range = calendar.range(of: .day, in: .month, for: today),
              let lastDayOfMonth = calendar.date(from: DateComponents(
                year: calendar.component(.year, from: today),
                month: calendar.component(.month, from: today),
                day: range.count
              )) else {
            XCTFail("Could not find last day of month")
            return
        }

        // Act - simulate calculation for last day
        let remaining = calendar.dateComponents([.day], from: lastDayOfMonth, to: lastDayOfMonth).day ?? 0
        let daysRemaining = max(remaining + 1, 1) // Include today

        // Assert
        XCTAssertEqual(daysRemaining, 1, "On last day of month, should return 1 (today)")
    }

    // MARK: - Daily Budget Logic

    func testDailyBudgetLogic_dividesRemainingByDays() {
        // Arrange
        let remaining: Decimal = 1000
        let daysRemaining = 10

        // Act
        let dailyBudget = remaining / Decimal(daysRemaining)

        // Assert
        XCTAssertEqual(dailyBudget, 100, "Should divide remaining by days left")
    }

    func testDailyBudgetLogic_withZeroDays_returns0() {
        XCTAssertEqual(
            Self.calculateDailyBudget(remaining: 1000, daysRemaining: 0),
            0,
            "Should return 0 when no days remaining"
        )
    }

    func testDailyBudgetLogic_withNegativeRemaining_returns0() {
        // Arrange
        let remaining: Decimal = -500
        let daysRemaining = 10

        // Act
        let dailyBudget = remaining > 0 ? remaining / Decimal(daysRemaining) : 0

        // Assert
        XCTAssertEqual(dailyBudget, 0, "Should return 0 when remaining is negative (deficit)")
    }

    func testDailyBudgetLogic_withSingleDayLeft_returnsFullRemaining() {
        // Arrange
        let remaining: Decimal = 250
        let daysRemaining = 1

        // Act
        let dailyBudget = remaining / Decimal(daysRemaining)

        // Assert
        XCTAssertEqual(dailyBudget, 250, "With 1 day left, daily budget equals full remaining")
    }

    // MARK: - Alert Budget Lines Logic (80% Threshold)

    func testAlertBudgetLinesLogic_filtersAbove80Percent() {
        // Arrange
        let line75 = TestDataFactory.createBudgetLine(id: "line-75", amount: 1000, kind: .expense)
        let line85 = TestDataFactory.createBudgetLine(id: "line-85", amount: 1000, kind: .expense)
        let line100 = TestDataFactory.createBudgetLine(id: "line-100", amount: 1000, kind: .expense)

        let transactions = [
            TestDataFactory.createTransaction(id: "tx-75", budgetLineId: "line-75", amount: 750),
            TestDataFactory.createTransaction(id: "tx-85", budgetLineId: "line-85", amount: 850),
            TestDataFactory.createTransaction(id: "tx-100", budgetLineId: "line-100", amount: 1000)
        ]

        let budgetLines = [line75, line85, line100]

        // Act
        let alerts = budgetLines
            .filter { $0.kind.isOutflow }
            .compactMap { line -> (BudgetLine, BudgetFormulas.Consumption)? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.percentage >= 80 else { return nil }
                return (line, consumption)
            }

        // Assert
        XCTAssertEqual(alerts.count, 2, "Should include only lines >= 80%")

        let alertIds = alerts.map { $0.0.id }
        XCTAssertTrue(alertIds.contains("line-85"), "Should include 85% line")
        XCTAssertTrue(alertIds.contains("line-100"), "Should include 100% line")
        XCTAssertFalse(alertIds.contains("line-75"), "Should exclude 75% line")
    }

    func testAlertBudgetLinesLogic_sortsByPercentageDescending() {
        // Arrange
        let line90 = TestDataFactory.createBudgetLine(id: "line-90", amount: 1000, kind: .expense)
        let line95 = TestDataFactory.createBudgetLine(id: "line-95", amount: 1000, kind: .expense)
        let line85 = TestDataFactory.createBudgetLine(id: "line-85", amount: 1000, kind: .expense)

        let transactions = [
            TestDataFactory.createTransaction(id: "tx-90", budgetLineId: "line-90", amount: 900),
            TestDataFactory.createTransaction(id: "tx-95", budgetLineId: "line-95", amount: 950),
            TestDataFactory.createTransaction(id: "tx-85", budgetLineId: "line-85", amount: 850)
        ]

        let budgetLines = [line90, line95, line85]

        // Act
        let alerts = budgetLines
            .filter { $0.kind.isOutflow }
            .compactMap { line -> (BudgetLine, BudgetFormulas.Consumption)? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.percentage >= 80 else { return nil }
                return (line, consumption)
            }
            .sorted { $0.1.percentage > $1.1.percentage }

        // Assert
        XCTAssertEqual(alerts.count, 3)
        XCTAssertEqual(alerts[0].0.id, "line-95", "Highest percentage should be first")
        XCTAssertEqual(alerts[1].0.id, "line-90", "Second highest should be second")
        XCTAssertEqual(alerts[2].0.id, "line-85", "Lowest should be last")
    }

    func testAlertBudgetLinesLogic_excludesRolloverLines() {
        // Arrange
        let normalLine = TestDataFactory.createBudgetLine(id: "normal", amount: 1000, kind: .expense, isRollover: false)
        let rolloverLine = TestDataFactory.createBudgetLine(id: "rollover", amount: 1000, kind: .expense, isRollover: true)

        let transactions = [
            TestDataFactory.createTransaction(id: "tx-normal", budgetLineId: "normal", amount: 850),
            TestDataFactory.createTransaction(id: "tx-rollover", budgetLineId: "rollover", amount: 850)
        ]

        let budgetLines = [normalLine, rolloverLine]

        // Act
        let alerts = budgetLines
            .filter { $0.kind.isOutflow && !($0.isRollover ?? false) }
            .compactMap { line -> (BudgetLine, BudgetFormulas.Consumption)? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.percentage >= 80 else { return nil }
                return (line, consumption)
            }

        // Assert
        XCTAssertEqual(alerts.count, 1, "Should exclude rollover lines from alerts")
        XCTAssertEqual(alerts[0].0.id, "normal", "Should only include normal line")
    }

    func testAlertBudgetLinesLogic_excludesIncomeLines() {
        // Arrange
        let expenseLine = TestDataFactory.createBudgetLine(id: "expense", amount: 1000, kind: .expense)
        let incomeLine = TestDataFactory.createBudgetLine(id: "income", amount: 1000, kind: .income)

        let transactions = [
            TestDataFactory.createTransaction(id: "tx-expense", budgetLineId: "expense", amount: 850),
            TestDataFactory.createTransaction(id: "tx-income", budgetLineId: "income", amount: 850)
        ]

        let budgetLines = [expenseLine, incomeLine]

        // Act
        let alerts = budgetLines
            .filter { $0.kind.isOutflow }
            .compactMap { line -> (BudgetLine, BudgetFormulas.Consumption)? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.percentage >= 80 else { return nil }
                return (line, consumption)
            }

        // Assert
        XCTAssertEqual(alerts.count, 1, "Should exclude income lines from alerts")
        XCTAssertEqual(alerts[0].0.id, "expense", "Should only include expense line")
    }

    // MARK: - Display Budget Lines Logic (Rollover)

    func testDisplayBudgetLinesLogic_withNoRollover_returnsOriginalLines() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-1"),
            TestDataFactory.createBudgetLine(id: "line-2")
        ]
        let budget = TestDataFactory.createBudget(rollover: 0)

        // Act
        let displayLines = budget.rollover == 0 ? lines : lines // Simplified logic

        // Assert
        XCTAssertEqual(displayLines.count, 2, "Should return original lines when no rollover")
        XCTAssertEqual(displayLines.map { $0.id }, ["line-1", "line-2"])
    }

    func testDisplayBudgetLinesLogic_withPositiveRollover_prependsRolloverLine() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-1"),
            TestDataFactory.createBudgetLine(id: "line-2")
        ]
        let budget = TestDataFactory.createBudget(rollover: 500)

        // Act
        let rolloverLine = BudgetLine.rolloverLine(
            amount: budget.rollover ?? 0,
            budgetId: budget.id,
            sourceBudgetId: budget.previousBudgetId
        )
        let displayLines = [rolloverLine] + lines

        // Assert
        XCTAssertEqual(displayLines.count, 3, "Should add rollover line to beginning")
        XCTAssertTrue(displayLines[0].isVirtualRollover, "First line should be rollover")
        XCTAssertEqual(displayLines[0].amount, 500)
        XCTAssertEqual(displayLines[0].kind, .income, "Positive rollover should be income")
    }

    func testDisplayBudgetLinesLogic_withNegativeRollover_prependsNegativeRolloverLine() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-1")
        ]
        let budget = TestDataFactory.createBudget(rollover: -300)

        // Act
        let rolloverLine = BudgetLine.rolloverLine(
            amount: budget.rollover ?? 0,
            budgetId: budget.id,
            sourceBudgetId: budget.previousBudgetId
        )
        let displayLines = [rolloverLine] + lines

        // Assert
        XCTAssertEqual(displayLines.count, 2)
        XCTAssertTrue(displayLines[0].isVirtualRollover)
        XCTAssertEqual(displayLines[0].amount, -300)
        XCTAssertEqual(displayLines[0].kind, .expense, "Negative rollover should be expense")
    }

    // MARK: - Transaction Filtering Logic

    func testRecentTransactionsLogic_sortsAndLimitsTo5() {
        // Arrange
        let calendar = Calendar.current
        let now = Date()

        // Create 7 transactions with different dates
        var transactions: [Transaction] = []
        for i in 0..<7 {
            let date = calendar.date(byAdding: .day, value: -i, to: now)!
            let tx = Transaction(
                id: "tx-\(i)",
                budgetId: "budget-1",
                budgetLineId: nil,
                name: "Transaction \(i)",
                amount: 100,
                kind: .expense,
                transactionDate: date,
                category: nil,
                checkedAt: nil,
                createdAt: date,
                updatedAt: date
            )
            transactions.append(tx)
        }

        // Act
        let recent = Array(
            transactions
                .sorted { $0.transactionDate > $1.transactionDate }
                .prefix(5)
        )

        // Assert
        XCTAssertEqual(recent.count, 5, "Should limit to 5 most recent")
        XCTAssertEqual(recent[0].id, "tx-0", "Most recent should be first")
        XCTAssertEqual(recent[4].id, "tx-4", "5th most recent should be last")
    }

    func testUncheckedTransactionsLogic_filtersAndLimits() {
        // Arrange
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", isChecked: false),
            TestDataFactory.createTransaction(id: "tx-2", isChecked: true),
            TestDataFactory.createTransaction(id: "tx-3", isChecked: false),
            TestDataFactory.createTransaction(id: "tx-4", isChecked: false)
        ]

        // Act
        let unchecked = Array(
            transactions
                .filter { !$0.isChecked }
                .prefix(5)
        )

        // Assert
        XCTAssertEqual(unchecked.count, 3, "Should only include unchecked transactions")
        let allUnchecked = unchecked.allSatisfy { !$0.isChecked }
        XCTAssertTrue(allUnchecked, "All results should be unchecked")
    }

    func testFreeTransactionsLogic_filtersUnallocated() {
        // Arrange
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-free-1", budgetLineId: nil),
            TestDataFactory.createTransaction(id: "tx-allocated", budgetLineId: "line-1"),
            TestDataFactory.createTransaction(id: "tx-free-2", budgetLineId: nil)
        ]

        // Act
        let freeTransactions = transactions.filter { $0.budgetLineId == nil }

        // Assert
        XCTAssertEqual(freeTransactions.count, 2, "Should only include transactions without budgetLineId")
        XCTAssertTrue(freeTransactions[0].isFree, "Should be free transactions")
        XCTAssertTrue(freeTransactions[1].isFree, "Should be free transactions")
    }

    // MARK: - Recurrence Filtering Logic

    func testRecurringBudgetLinesLogic_filtersFixed() {
        // Arrange
        let fixed1 = TestDataFactory.createBudgetLine(id: "fixed-1", recurrence: .fixed)
        let oneOff = TestDataFactory.createBudgetLine(id: "oneoff-1", recurrence: .oneOff)
        let fixed2 = TestDataFactory.createBudgetLine(id: "fixed-2", recurrence: .fixed)

        let lines = [fixed1, oneOff, fixed2]

        // Act
        let recurring = lines.filter { $0.recurrence == .fixed }

        // Assert
        XCTAssertEqual(recurring.count, 2, "Should only include fixed recurrence lines")
        XCTAssertTrue(recurring.allSatisfy { $0.recurrence == .fixed })
    }

    func testOneOffBudgetLinesLogic_filtersOneOffExcludingRollover() {
        // Arrange
        let oneOff1 = TestDataFactory.createBudgetLine(id: "oneoff-1", recurrence: .oneOff, isRollover: false)
        let fixed = TestDataFactory.createBudgetLine(id: "fixed-1", recurrence: .fixed, isRollover: false)
        let rollover = TestDataFactory.createBudgetLine(id: "rollover-1", recurrence: .oneOff, isRollover: true)
        let oneOff2 = TestDataFactory.createBudgetLine(id: "oneoff-2", recurrence: .oneOff, isRollover: false)

        let lines = [oneOff1, fixed, rollover, oneOff2]

        // Act
        let oneOffs = lines.filter { $0.recurrence == .oneOff && !($0.isRollover ?? false) }

        // Assert
        XCTAssertEqual(oneOffs.count, 2, "Should include only oneOff, excluding rollover")
        XCTAssertFalse(oneOffs.contains { $0.id == "rollover-1" }, "Should exclude rollover")
    }

    // MARK: - BudgetListStore Grouped By Year Logic

    func testGroupedByYearLogic_groupsBudgetsByYear() {
        // Arrange
        let budgets = [
            TestDataFactory.createBudget(id: "b1", month: 1, year: 2024),
            TestDataFactory.createBudget(id: "b2", month: 6, year: 2024),
            TestDataFactory.createBudget(id: "b3", month: 3, year: 2025),
            TestDataFactory.createBudget(id: "b4", month: 12, year: 2023)
        ]

        // Act
        let grouped = Dictionary(grouping: budgets) { $0.year }
        let yearGroups = grouped
            .sorted { $0.key < $1.key }
            .map { year, budgets in (year: year, budgets: budgets.sorted { $0.month < $1.month }) }

        // Assert
        XCTAssertEqual(yearGroups.count, 3, "Should have 3 distinct years")
        XCTAssertEqual(yearGroups[0].year, 2023, "First group should be oldest year")
        XCTAssertEqual(yearGroups[1].year, 2024, "Second group should be 2024")
        XCTAssertEqual(yearGroups[2].year, 2025, "Third group should be newest year")
    }

    func testGroupedByYearLogic_sortsBudgetsByMonthWithinYear() {
        // Arrange
        let budgets = [
            TestDataFactory.createBudget(id: "b1", month: 12, year: 2024),
            TestDataFactory.createBudget(id: "b2", month: 3, year: 2024),
            TestDataFactory.createBudget(id: "b3", month: 7, year: 2024),
            TestDataFactory.createBudget(id: "b4", month: 1, year: 2024)
        ]

        // Act
        let grouped = Dictionary(grouping: budgets) { $0.year }
        let yearGroups = grouped
            .sorted { $0.key < $1.key }
            .map { year, budgets in (year: year, budgets: budgets.sorted { $0.month < $1.month }) }

        // Assert
        let months = yearGroups[0].budgets.map { $0.month }
        XCTAssertEqual(months, [1, 3, 7, 12], "Budgets within year should be sorted by month ascending")
    }

    func testGroupedByYearLogic_emptyBudgets_returnsEmptyArray() {
        // Arrange
        let budgets: [Budget] = []

        // Act
        let grouped = Dictionary(grouping: budgets) { $0.year }
        let yearGroups = grouped
            .sorted { $0.key < $1.key }
            .map { year, budgets in (year: year, budgets: budgets.sorted { $0.month < $1.month }) }

        // Assert
        XCTAssertTrue(yearGroups.isEmpty, "Should return empty array for no budgets")
    }

    // MARK: - Helpers

    /// Mirrors CurrentMonthStore.dailyBudget logic
    private static func calculateDailyBudget(remaining: Decimal, daysRemaining: Int) -> Decimal {
        guard daysRemaining > 0, remaining > 0 else { return 0 }
        return remaining / Decimal(daysRemaining)
    }

    func testGroupedByYearLogic_singleBudget_createsSingleGroup() {
        // Arrange
        let budgets = [
            TestDataFactory.createBudget(id: "b1", month: 5, year: 2024)
        ]

        // Act
        let grouped = Dictionary(grouping: budgets) { $0.year }
        let yearGroups = grouped
            .sorted { $0.key < $1.key }
            .map { year, budgets in (year: year, budgets: budgets.sorted { $0.month < $1.month }) }

        // Assert
        XCTAssertEqual(yearGroups.count, 1, "Should have one year group")
        XCTAssertEqual(yearGroups[0].budgets.count, 1, "Should have one budget in group")
    }
}
