import Foundation
import Testing
@testable import Pulpe

struct TransactionTests {

    // MARK: - Check Status

    @Test func isChecked_whenCheckedAtIsNil_returnsFalse() {
        let transaction = TestDataFactory.createTransaction(isChecked: false)
        let result = transaction.isChecked
        #expect(!result)
    }

    @Test func isChecked_whenCheckedAtHasValue_returnsTrue() {
        let transaction = TestDataFactory.createTransaction(isChecked: true)
        let result = transaction.isChecked
        #expect(result)
    }

    // MARK: - Toggle Behavior

    @Test func toggled_whenUnchecked_setsCheckedAt() {
        let transaction = TestDataFactory.createTransaction(isChecked: false)
        let toggled = transaction.toggled()
        #expect(toggled.isChecked)
        #expect(toggled.checkedAt != nil)
    }

    @Test func toggled_whenChecked_clearsCheckedAt() {
        let transaction = TestDataFactory.createTransaction(isChecked: true)
        let toggled = transaction.toggled()
        #expect(!toggled.isChecked)
        #expect(toggled.checkedAt == nil)
    }

    @Test func toggled_preservesAllOtherFields() {
        let original = Transaction(
            id: "test-tx-id",
            budgetId: "budget-123",
            budgetLineId: "line-456",
            name: "Test Transaction",
            amount: 250,
            kind: .expense,
            transactionDate: Date(),
            category: "Food",
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        let toggled = original.toggled()
        #expect(toggled.id == original.id)
        #expect(toggled.budgetId == original.budgetId)
        #expect(toggled.budgetLineId == original.budgetLineId)
        #expect(toggled.name == original.name)
        #expect(toggled.amount == original.amount)
        #expect(toggled.kind == original.kind)
        #expect(toggled.category == original.category)
    }

    @Test func toggled_canBeToggledMultipleTimes() {
        let transaction = TestDataFactory.createTransaction(isChecked: false)
        let toggled1 = transaction.toggled()
        let toggled2 = toggled1.toggled()
        let toggled3 = toggled2.toggled()
        #expect(toggled1.isChecked)
        #expect(!toggled2.isChecked)
        #expect(toggled3.isChecked)
    }

    // MARK: - Allocation Status

    @Test func isAllocated_whenBudgetLineIdExists_returnsTrue() {
        let transaction = TestDataFactory.createTransaction(budgetLineId: "line-123")
        let result = transaction.isAllocated
        #expect(result)
    }

    @Test func isAllocated_whenBudgetLineIdIsNil_returnsFalse() {
        let transaction = TestDataFactory.createTransaction(budgetLineId: nil)
        let result = transaction.isAllocated
        #expect(!result)
    }

    @Test func isFree_whenBudgetLineIdIsNil_returnsTrue() {
        let transaction = TestDataFactory.createTransaction(budgetLineId: nil)
        let result = transaction.isFree
        #expect(result)
    }

    @Test func isFree_whenBudgetLineIdExists_returnsFalse() {
        let transaction = TestDataFactory.createTransaction(budgetLineId: "line-123")
        let result = transaction.isFree
        #expect(!result)
    }

    @Test func isAllocated_and_isFree_areMutuallyExclusive() {
        let allocated = TestDataFactory.createTransaction(budgetLineId: "line-123")
        let free = TestDataFactory.createTransaction(budgetLineId: nil)
        #expect(allocated.isAllocated && !allocated.isFree)
        #expect(free.isFree && !free.isAllocated)
    }

    // MARK: - Kind Categorization

    @Test func kind_income_isNotOutflow() {
        let transaction = TestDataFactory.createTransaction(kind: .income)
        #expect(transaction.kind == .income)
        #expect(!transaction.kind.isOutflow)
    }

    @Test func kind_expense_isOutflow() {
        let transaction = TestDataFactory.createTransaction(kind: .expense)
        #expect(transaction.kind == .expense)
        #expect(transaction.kind.isOutflow)
    }

    @Test func kind_saving_isOutflow() {
        let transaction = TestDataFactory.createTransaction(kind: .saving)
        #expect(transaction.kind == .saving)
        #expect(transaction.kind.isOutflow)
    }

    // MARK: - Amount Validation

    @Test func amount_canBePositive() {
        let transaction = TestDataFactory.createTransaction(amount: 150.50)
        #expect(transaction.amount == Decimal(string: "150.50")!)
    }

    @Test func amount_canBeZero() {
        let transaction = TestDataFactory.createTransaction(amount: 0)
        #expect(transaction.amount == 0)
    }

    @Test func amount_usesDecimalForPrecision() {
        let transaction = TestDataFactory.createTransaction(amount: Decimal(string: "99.99")!)
        #expect(transaction.amount == Decimal(string: "99.99")!)
    }

    @Test func amount_handlesCHFFormatting() {
        let transaction = TestDataFactory.createTransaction(amount: Decimal(string: "1234.56")!)
        let formatted = transaction.amount.asCHF
        // Swiss locale uses apostrophe as thousands separator (either ' or ')
        let hasThousandsSeparator = formatted.contains("1'234") || formatted.contains("1\u{2019}234")
        #expect(hasThousandsSeparator)
        #expect(formatted.contains("56"))
    }

    // MARK: - Category Handling

    @Test func category_canBeNil() {
        let transaction = Transaction(
            id: "test-id",
            budgetId: "budget-123",
            budgetLineId: nil,
            name: "Test",
            amount: 100,
            kind: .expense,
            transactionDate: Date(),
            category: nil,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        #expect(transaction.category == nil)
    }

    @Test func category_canHaveValue() {
        let transaction = Transaction(
            id: "test-id",
            budgetId: "budget-123",
            budgetLineId: nil,
            name: "Test",
            amount: 100,
            kind: .expense,
            transactionDate: Date(),
            category: "Food",
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        #expect(transaction.category == "Food")
    }

    // MARK: - Transaction Date

    @Test func transactionDate_storesCorrectDate() {
        let specificDate = Date()
        let transaction = Transaction(
            id: "test-id",
            budgetId: "budget-123",
            budgetLineId: nil,
            name: "Test",
            amount: 100,
            kind: .expense,
            transactionDate: specificDate,
            category: nil,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        #expect(transaction.transactionDate == specificDate)
    }

    // MARK: - Signed Amount (Used for Display)

    @Test func signedAmount_income_returnsPositive() {
        let transaction = TestDataFactory.createTransaction(amount: 1500, kind: .income)
        let result = transaction.signedAmount
        #expect(result == 1500)
        #expect(result > 0)
    }

    @Test func signedAmount_expense_returnsNegative() {
        let transaction = TestDataFactory.createTransaction(amount: 500, kind: .expense)
        let result = transaction.signedAmount
        #expect(result == -500)
        #expect(result < 0)
    }

    @Test func signedAmount_saving_returnsNegative() {
        let transaction = TestDataFactory.createTransaction(amount: 200, kind: .saving)
        let result = transaction.signedAmount
        #expect(result == -200)
        #expect(result < 0)
    }

    @Test func signedAmount_zeroAmount_staysZero() {
        let incomeZero = TestDataFactory.createTransaction(amount: 0, kind: .income)
        let expenseZero = TestDataFactory.createTransaction(amount: 0, kind: .expense)
        #expect(incomeZero.signedAmount == 0)
        #expect(expenseZero.signedAmount == 0)
    }

    // MARK: - Equality and Hashing

    @Test func equality_sameTransactions_areEqual() {
        let tx1 = TestDataFactory.createTransaction(id: "test-1")
        let tx2 = TestDataFactory.createTransaction(id: "test-1")
        #expect(tx1 == tx2)
    }

    @Test func equality_differentIDs_areNotEqual() {
        let tx1 = TestDataFactory.createTransaction(id: "test-1")
        let tx2 = TestDataFactory.createTransaction(id: "test-2")
        #expect(tx1 != tx2)
    }

    @Test func hashable_canBeUsedInSet() {
        let tx1 = TestDataFactory.createTransaction(id: "test-1")
        let tx2 = TestDataFactory.createTransaction(id: "test-2")
        let tx3 = TestDataFactory.createTransaction(id: "test-1")
        let txSet: Set<Transaction> = [tx1, tx2, tx3]
        #expect(txSet.count == 2)
    }

    // MARK: - Business Logic

    @Test func allocatedTransaction_belongsToBudgetLine() {
        let budgetLineId = "line-123"
        let transaction = TestDataFactory.createTransaction(budgetLineId: budgetLineId)
        #expect(transaction.budgetLineId == budgetLineId)
        #expect(transaction.isAllocated)
    }

    @Test func freeTransaction_doesNotBelongToBudgetLine() {
        let transaction = TestDataFactory.createTransaction(budgetLineId: nil)
        #expect(transaction.budgetLineId == nil)
        #expect(transaction.isFree)
    }

    // MARK: - Integration with BudgetFormulas

    @Test func transaction_canBeUsedInFormulaCalculations() {
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 100, kind: .income),
            TestDataFactory.createTransaction(id: "2", amount: 50, kind: .expense)
        ]
        let totalIncome = BudgetFormulas.calculateTotalIncome(budgetLines: [], transactions: transactions)
        let totalExpenses = BudgetFormulas.calculateTotalExpenses(budgetLines: [], transactions: transactions)
        #expect(totalIncome == 100)
        #expect(totalExpenses == 50)
    }

    @Test func checkedTransaction_contributesToRealizedMetrics() {
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 100, kind: .income, isChecked: true),
            TestDataFactory.createTransaction(id: "2", amount: 50, kind: .expense, isChecked: false)
        ]
        let realizedIncome = BudgetFormulas.calculateRealizedIncome(budgetLines: [], transactions: transactions)
        let realizedExpenses = BudgetFormulas.calculateRealizedExpenses(budgetLines: [], transactions: transactions)
        #expect(realizedIncome == 100)
        #expect(realizedExpenses == 0)
    }
}
