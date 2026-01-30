import Foundation
@testable import Pulpe

/// Factory to create test data with sensible defaults
enum TestDataFactory {

    // MARK: - Fixed Dates for Testing

    static let fixedDate = Date(timeIntervalSince1970: 1704067200) // 2024-01-01 00:00:00 UTC
    static let fixedCheckedDate = Date(timeIntervalSince1970: 1704153600) // 2024-01-02 00:00:00 UTC

    // MARK: - BudgetLine Factory

    static func createBudgetLine(
        id: String = "test-line-1",
        budgetId: String = "test-budget-1",
        name: String = "Test Line",
        amount: Decimal = 1000,
        kind: TransactionKind = .expense,
        recurrence: TransactionRecurrence = .fixed,
        isChecked: Bool = false,
        isRollover: Bool = false
    ) -> BudgetLine {
        BudgetLine(
            id: id,
            budgetId: budgetId,
            templateLineId: nil,
            savingsGoalId: nil,
            name: name,
            amount: amount,
            kind: kind,
            recurrence: recurrence,
            isManuallyAdjusted: false,
            checkedAt: isChecked ? fixedCheckedDate : nil,
            createdAt: fixedDate,
            updatedAt: fixedDate,
            isRollover: isRollover,
            rolloverSourceBudgetId: nil
        )
    }

    // MARK: - Transaction Factory

    static func createTransaction(
        id: String = "test-tx-1",
        budgetId: String = "test-budget-1",
        budgetLineId: String? = nil,
        name: String = "Test Transaction",
        amount: Decimal = 100,
        kind: TransactionKind = .expense,
        isChecked: Bool = false
    ) -> Transaction {
        Transaction(
            id: id,
            budgetId: budgetId,
            budgetLineId: budgetLineId,
            name: name,
            amount: amount,
            kind: kind,
            transactionDate: fixedDate,
            category: nil,
            checkedAt: isChecked ? fixedCheckedDate : nil,
            createdAt: fixedDate,
            updatedAt: fixedDate
        )
    }

    // MARK: - BudgetSparse Factory

    static func createBudgetSparse(
        id: String = "test-sparse-1",
        month: Int? = 1,
        year: Int? = 2025,
        totalExpenses: Decimal? = nil,
        totalSavings: Decimal? = nil,
        totalIncome: Decimal? = nil,
        remaining: Decimal? = nil,
        rollover: Decimal? = nil
    ) -> BudgetSparse {
        BudgetSparse(
            id: id,
            month: month,
            year: year,
            totalExpenses: totalExpenses,
            totalSavings: totalSavings,
            totalIncome: totalIncome,
            remaining: remaining,
            rollover: rollover
        )
    }

    // MARK: - Budget Factory

    static func createBudget(
        id: String = "test-budget-1",
        month: Int = 1,
        year: Int = 2025,
        rollover: Decimal = 0
    ) -> Budget {
        Budget(
            id: id,
            month: month,
            year: year,
            description: "Test Budget",
            userId: "test-user",
            templateId: "test-template",
            endingBalance: nil,
            rollover: rollover,
            remaining: nil,
            previousBudgetId: nil,
            createdAt: fixedDate,
            updatedAt: fixedDate
        )
    }
}
