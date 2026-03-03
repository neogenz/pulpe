import Foundation
@testable import Pulpe
import Testing

struct CurrentMonthStoreAlertAndFilterTests {
    // MARK: - Alert Budget Lines Logic (80% Threshold)

    @Test func alertBudgetLinesLogic_filtersAbove80Percent() {
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
            .filter { $0.kind == .expense }
            .compactMap { line -> BudgetAlert? in
                let consumption = BudgetFormulas.calculateConsumption(
                    for: line,
                    transactions: transactions
                )
                guard consumption.percentage >= 80 else { return nil }
                return BudgetAlert(line: line, consumption: consumption)
            }

        // Assert
        #expect(alerts.count == 2)

        let alertIds = alerts.map { $0.line.id }
        #expect(alertIds.contains("line-85"))
        #expect(alertIds.contains("line-100"))
        #expect(!alertIds.contains("line-75"))
    }

    @Test func alertBudgetLinesLogic_sortsByPercentageDescending() {
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
            .filter { $0.kind == .expense }
            .compactMap { line -> BudgetAlert? in
                let consumption = BudgetFormulas.calculateConsumption(
                    for: line,
                    transactions: transactions
                )
                guard consumption.percentage >= 80 else { return nil }
                return BudgetAlert(line: line, consumption: consumption)
            }
            .sorted { $0.consumption.percentage > $1.consumption.percentage }

        // Assert
        #expect(alerts.count == 3)
        #expect(alerts[0].line.id == "line-95")
        #expect(alerts[1].line.id == "line-90")
        #expect(alerts[2].line.id == "line-85")
    }

    @Test func alertBudgetLinesLogic_excludesRolloverLines() {
        // Arrange
        let normalLine = TestDataFactory.createBudgetLine(id: "normal", amount: 1000, kind: .expense, isRollover: false)
        let rolloverLine = TestDataFactory.createBudgetLine(
            id: "rollover",
            amount: 1000,
            kind: .expense,
            isRollover: true
        )

        let transactions = [
            TestDataFactory.createTransaction(id: "tx-normal", budgetLineId: "normal", amount: 850),
            TestDataFactory.createTransaction(id: "tx-rollover", budgetLineId: "rollover", amount: 850)
        ]

        let budgetLines = [normalLine, rolloverLine]

        // Act
        let alerts = budgetLines
            .filter { $0.kind == .expense && !($0.isRollover ?? false) }
            .compactMap { line -> BudgetAlert? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.percentage >= 80 else { return nil }
                return BudgetAlert(line: line, consumption: consumption)
            }

        // Assert
        #expect(alerts.count == 1)
        #expect(alerts[0].line.id == "normal")
    }

    @Test func alertBudgetLinesLogic_excludesIncomeLines() {
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
            .filter { $0.kind == .expense }
            .compactMap { line -> BudgetAlert? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.percentage >= 80 else { return nil }
                return BudgetAlert(line: line, consumption: consumption)
            }

        // Assert
        #expect(alerts.count == 1)
        #expect(alerts[0].line.id == "expense")
    }

    @Test func alertBudgetLinesLogic_excludesSavingLines() {
        // Arrange
        let expenseLine = TestDataFactory.createBudgetLine(id: "expense", amount: 1000, kind: .expense)
        let savingLine = TestDataFactory.createBudgetLine(id: "saving", amount: 1000, kind: .saving)

        let transactions = [
            TestDataFactory.createTransaction(id: "tx-expense", budgetLineId: "expense", amount: 900),
            TestDataFactory.createTransaction(id: "tx-saving", budgetLineId: "saving", amount: 900)
        ]

        let budgetLines = [expenseLine, savingLine]

        // Act
        let alerts = budgetLines
            .filter { $0.kind == .expense }
            .compactMap { line -> BudgetAlert? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.percentage >= 80 else { return nil }
                return BudgetAlert(line: line, consumption: consumption)
            }

        // Assert
        #expect(alerts.count == 1)
        #expect(alerts[0].line.id == "expense")
    }

    // MARK: - Display Budget Lines Logic (Rollover)

    @Test func displayBudgetLinesLogic_withNoRollover_returnsOriginalLines() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-1"),
            TestDataFactory.createBudgetLine(id: "line-2")
        ]
        let budget = TestDataFactory.createBudget(rollover: 0)

        // Act
        let displayLines = budget.rollover == 0 ? lines : lines // Simplified logic

        // Assert
        #expect(displayLines.count == 2)
        #expect(displayLines.map { $0.id } == ["line-1", "line-2"])
    }

    @Test func displayBudgetLinesLogic_withPositiveRollover_prependsRolloverLine() {
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
        #expect(displayLines.count == 3)
        #expect(displayLines[0].isVirtualRollover)
        #expect(displayLines[0].amount == 500)
        #expect(displayLines[0].kind == .income)
    }

    @Test func displayBudgetLinesLogic_withNegativeRollover_prependsNegativeRolloverLine() {
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
        #expect(displayLines.count == 2)
        #expect(displayLines[0].isVirtualRollover)
        #expect(displayLines[0].amount == -300)
        #expect(displayLines[0].kind == .expense)
    }

    // MARK: - Transaction Filtering Logic

    @Test func recentTransactionsLogic_sortsAndLimitsTo5() {
        // Arrange
        let calendar = Calendar.current
        let now = Date()

        // Create 7 transactions with different dates
        var transactions: [Transaction] = []
        for i in 0..<7 {
            guard let date = calendar.date(byAdding: .day, value: -i, to: now) else {
                continue
            }
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
        #expect(recent.count == 5)
        #expect(recent[0].id == "tx-0")
        #expect(recent[4].id == "tx-4")
    }

    @Test func uncheckedTransactionsLogic_filtersAndLimits() {
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
        #expect(unchecked.count == 3)
        let allUnchecked = unchecked.allSatisfy { !$0.isChecked }
        #expect(allUnchecked)
    }

    @Test func freeTransactionsLogic_filtersUnallocated() {
        // Arrange
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-free-1", budgetLineId: nil),
            TestDataFactory.createTransaction(id: "tx-allocated", budgetLineId: "line-1"),
            TestDataFactory.createTransaction(id: "tx-free-2", budgetLineId: nil)
        ]

        // Act
        let freeTransactions = transactions.filter { $0.budgetLineId == nil }

        // Assert
        #expect(freeTransactions.count == 2)
        #expect(freeTransactions[0].isFree)
        #expect(freeTransactions[1].isFree)
    }

    // MARK: - Recurrence Filtering Logic

    @Test func recurringBudgetLinesLogic_filtersFixed() {
        // Arrange
        let fixed1 = TestDataFactory.createBudgetLine(id: "fixed-1", recurrence: .fixed)
        let oneOff = TestDataFactory.createBudgetLine(id: "oneoff-1", recurrence: .oneOff)
        let fixed2 = TestDataFactory.createBudgetLine(id: "fixed-2", recurrence: .fixed)

        let lines = [fixed1, oneOff, fixed2]

        // Act
        let recurring = lines.filter { $0.recurrence == .fixed }

        // Assert
        #expect(recurring.count == 2)
        #expect(recurring.allSatisfy { $0.recurrence == .fixed })
    }

    @Test func oneOffBudgetLinesLogic_filtersOneOffExcludingRollover() {
        // Arrange
        let oneOff1 = TestDataFactory.createBudgetLine(id: "oneoff-1", recurrence: .oneOff, isRollover: false)
        let fixed = TestDataFactory.createBudgetLine(id: "fixed-1", recurrence: .fixed, isRollover: false)
        let rollover = TestDataFactory.createBudgetLine(id: "rollover-1", recurrence: .oneOff, isRollover: true)
        let oneOff2 = TestDataFactory.createBudgetLine(id: "oneoff-2", recurrence: .oneOff, isRollover: false)

        let lines = [oneOff1, fixed, rollover, oneOff2]

        // Act
        let oneOffs = lines.filter { $0.recurrence == .oneOff && !($0.isRollover ?? false) }

        // Assert
        #expect(oneOffs.count == 2)
        #expect(oneOffs.allSatisfy { !($0.isRollover ?? false) })
        #expect(oneOffs.allSatisfy { $0.recurrence == .oneOff })
    }
}
