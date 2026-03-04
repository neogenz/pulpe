import Foundation
@testable import Pulpe
import Testing

/// Envelope-aware expense calculation tests (allocated vs free transactions)
struct BudgetFormulasEnvelopeTests {
    // MARK: - Expense Envelopes

    @Test func calculateTotalExpenses_withAllocatedTransaction_doesNotDoubleCount() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 200, kind: .expense)
        ]
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines, transactions: transactions)
        #expect(result == 500) // Not 700 — transaction covered by envelope
    }

    @Test func calculateTotalExpenses_withAllocatedTransactionExceedingEnvelope_usesMax() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 100, kind: .expense)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 188, kind: .expense)
        ]
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines, transactions: transactions)
        #expect(result == 188) // Overage: transaction exceeds envelope
    }

    @Test func calculateTotalExpenses_withFreeAndAllocatedTransactions_onlyCountsFreeOnes() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 200, kind: .expense),
            TestDataFactory.createTransaction(id: "tx-2", amount: 50, kind: .expense)
        ]
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines, transactions: transactions)
        #expect(result == 550) // 500 envelope + 50 free
    }

    @Test func calculateTotalExpenses_withMultipleEnvelopes_handlesIndependently() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 500, kind: .expense),
            TestDataFactory.createBudgetLine(id: "2", amount: 200, kind: .expense)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 400, kind: .expense),
            TestDataFactory.createTransaction(id: "tx-2", budgetLineId: "2", amount: 350, kind: .expense)
        ]
        let result = BudgetFormulas.calculateTotalExpenses(budgetLines: lines, transactions: transactions)
        #expect(result == 850) // 500 (no overage) + 350 (overage)
    }

    // MARK: - Income & Savings Envelopes

    @Test func calculateTotalIncome_withAllocatedIncomeTransaction_doesNotDoubleCount() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 500, kind: .income)
        ]
        let result = BudgetFormulas.calculateTotalIncome(budgetLines: lines, transactions: transactions)
        #expect(result == 3000) // Not 3500 — transaction covered by envelope
    }

    @Test func calculateTotalSavings_withAllocatedSavingTransaction_doesNotDoubleCount() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 400, kind: .saving)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "1", amount: 150, kind: .saving)
        ]
        let result = BudgetFormulas.calculateTotalSavings(budgetLines: lines, transactions: transactions)
        #expect(result == 400) // Not 550 — transaction covered by envelope
    }

    // MARK: - Metrics with Envelopes

    @Test func calculateAllMetrics_withAllocatedTransactions_usesEnvelopeLogic() {
        let lines = [
            TestDataFactory.createBudgetLine(id: "1", amount: 3000, kind: .income),
            TestDataFactory.createBudgetLine(id: "2", amount: 800, kind: .expense)
        ]
        let transactions = [
            TestDataFactory.createTransaction(id: "tx-1", budgetLineId: "2", amount: 600, kind: .expense),
            TestDataFactory.createTransaction(id: "tx-2", amount: 50, kind: .expense)
        ]
        let metrics = BudgetFormulas.calculateAllMetrics(budgetLines: lines, transactions: transactions)
        #expect(metrics.totalExpenses == 850) // 800 envelope + 50 free, not 1450
        #expect(metrics.totalIncome == 3000)
    }
}
