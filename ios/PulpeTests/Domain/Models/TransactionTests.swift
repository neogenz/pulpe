import XCTest
@testable import Pulpe

/// Tests for Transaction model behavior
/// Focuses on state management and allocation logic
final class TransactionTests: XCTestCase {

    // MARK: - Check Status

    func testIsChecked_whenCheckedAtIsNil_returnsFalse() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(isChecked: false)

        // Act
        let result = transaction.isChecked

        // Assert
        XCTAssertFalse(result, "Should return false when checkedAt is nil")
    }

    func testIsChecked_whenCheckedAtHasValue_returnsTrue() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(isChecked: true)

        // Act
        let result = transaction.isChecked

        // Assert
        XCTAssertTrue(result, "Should return true when checkedAt has a value")
    }

    // MARK: - Toggle Behavior

    func testToggled_whenUnchecked_setsCheckedAt() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(isChecked: false)

        // Act
        let toggled = transaction.toggled()

        // Assert
        XCTAssertTrue(toggled.isChecked, "Should set checkedAt when toggling unchecked transaction")
        XCTAssertNotNil(toggled.checkedAt, "checkedAt should not be nil after toggling")
    }

    func testToggled_whenChecked_clearsCheckedAt() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(isChecked: true)

        // Act
        let toggled = transaction.toggled()

        // Assert
        XCTAssertFalse(toggled.isChecked, "Should clear checkedAt when toggling checked transaction")
        XCTAssertNil(toggled.checkedAt, "checkedAt should be nil after toggling")
    }

    func testToggled_preservesAllOtherFields() {
        // Arrange
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

        // Act
        let toggled = original.toggled()

        // Assert
        XCTAssertEqual(toggled.id, original.id)
        XCTAssertEqual(toggled.budgetId, original.budgetId)
        XCTAssertEqual(toggled.budgetLineId, original.budgetLineId)
        XCTAssertEqual(toggled.name, original.name)
        XCTAssertEqual(toggled.amount, original.amount)
        XCTAssertEqual(toggled.kind, original.kind)
        XCTAssertEqual(toggled.category, original.category)
    }

    func testToggled_canBeToggledMultipleTimes() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(isChecked: false)

        // Act
        let toggled1 = transaction.toggled()
        let toggled2 = toggled1.toggled()
        let toggled3 = toggled2.toggled()

        // Assert
        XCTAssertTrue(toggled1.isChecked, "First toggle should check")
        XCTAssertFalse(toggled2.isChecked, "Second toggle should uncheck")
        XCTAssertTrue(toggled3.isChecked, "Third toggle should check again")
    }

    // MARK: - Allocation Status

    func testIsAllocated_whenBudgetLineIdExists_returnsTrue() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(budgetLineId: "line-123")

        // Act
        let result = transaction.isAllocated

        // Assert
        XCTAssertTrue(result, "Should return true when budgetLineId is present")
    }

    func testIsAllocated_whenBudgetLineIdIsNil_returnsFalse() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(budgetLineId: nil)

        // Act
        let result = transaction.isAllocated

        // Assert
        XCTAssertFalse(result, "Should return false when budgetLineId is nil")
    }

    func testIsFree_whenBudgetLineIdIsNil_returnsTrue() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(budgetLineId: nil)

        // Act
        let result = transaction.isFree

        // Assert
        XCTAssertTrue(result, "Should return true when budgetLineId is nil")
    }

    func testIsFree_whenBudgetLineIdExists_returnsFalse() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(budgetLineId: "line-123")

        // Act
        let result = transaction.isFree

        // Assert
        XCTAssertFalse(result, "Should return false when budgetLineId is present")
    }

    func testIsAllocated_and_isFree_areMutuallyExclusive() {
        // Arrange
        let allocated = TestDataFactory.createTransaction(budgetLineId: "line-123")
        let free = TestDataFactory.createTransaction(budgetLineId: nil)

        // Act & Assert
        XCTAssertTrue(allocated.isAllocated && !allocated.isFree, "Allocated transaction should not be free")
        XCTAssertTrue(free.isFree && !free.isAllocated, "Free transaction should not be allocated")
    }

    // MARK: - Kind Categorization

    func testKind_income_isNotOutflow() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(kind: .income)

        // Act & Assert
        XCTAssertEqual(transaction.kind, .income)
        XCTAssertFalse(transaction.kind.isOutflow, "Income should not be outflow")
    }

    func testKind_expense_isOutflow() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(kind: .expense)

        // Act & Assert
        XCTAssertEqual(transaction.kind, .expense)
        XCTAssertTrue(transaction.kind.isOutflow, "Expense should be outflow")
    }

    func testKind_saving_isOutflow() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(kind: .saving)

        // Act & Assert
        XCTAssertEqual(transaction.kind, .saving)
        XCTAssertTrue(transaction.kind.isOutflow, "Saving should be outflow")
    }

    // MARK: - Amount Validation

    func testAmount_canBePositive() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(amount: 150.50)

        // Act & Assert
        XCTAssertEqual(transaction.amount, Decimal(string: "150.50")!, "Should store positive amounts")
    }

    func testAmount_canBeZero() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(amount: 0)

        // Act & Assert
        XCTAssertEqual(transaction.amount, 0, "Should allow zero amounts")
    }

    func testAmount_usesDecimalForPrecision() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(amount: Decimal(string: "99.99")!)

        // Act & Assert
        XCTAssertEqual(transaction.amount, Decimal(string: "99.99")!, "Should preserve decimal precision")
    }

    func testAmount_handlesCHFFormatting() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(amount: Decimal(string: "1234.56")!)

        // Act
        let formatted = transaction.amount.asCHF

        // Assert
        XCTAssertTrue(formatted.contains("1'234"), "Should format with Swiss thousand separator")
        XCTAssertTrue(formatted.contains("56"), "Should include cents")
    }

    // MARK: - Category Handling

    func testCategory_canBeNil() {
        // Arrange
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

        // Act & Assert
        XCTAssertNil(transaction.category, "Category should be optional")
    }

    func testCategory_canHaveValue() {
        // Arrange
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

        // Act & Assert
        XCTAssertEqual(transaction.category, "Food", "Should store category value")
    }

    // MARK: - Transaction Date

    func testTransactionDate_storesCorrectDate() {
        // Arrange
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

        // Act & Assert
        XCTAssertEqual(transaction.transactionDate, specificDate, "Should store transaction date")
    }

    // MARK: - Signed Amount (Used for Display)

    func testSignedAmount_income_returnsPositive() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(amount: 1500, kind: .income)

        // Act
        let result = transaction.signedAmount

        // Assert
        XCTAssertEqual(result, 1500, "Income should return positive amount")
        XCTAssertGreaterThan(result, 0, "Income should be positive")
    }

    func testSignedAmount_expense_returnsNegative() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(amount: 500, kind: .expense)

        // Act
        let result = transaction.signedAmount

        // Assert
        XCTAssertEqual(result, -500, "Expense should return negative amount")
        XCTAssertLessThan(result, 0, "Expense should be negative")
    }

    func testSignedAmount_saving_returnsNegative() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(amount: 200, kind: .saving)

        // Act
        let result = transaction.signedAmount

        // Assert
        XCTAssertEqual(result, -200, "Saving should return negative amount (treated as expense)")
        XCTAssertLessThan(result, 0, "Saving should be negative")
    }

    func testSignedAmount_zeroAmount_staysZero() {
        // Arrange
        let incomeZero = TestDataFactory.createTransaction(amount: 0, kind: .income)
        let expenseZero = TestDataFactory.createTransaction(amount: 0, kind: .expense)

        // Act & Assert
        XCTAssertEqual(incomeZero.signedAmount, 0, "Zero income should be zero")
        XCTAssertEqual(expenseZero.signedAmount, 0, "Zero expense should be zero")
    }

    // MARK: - Equality and Hashing

    func testEquality_sameTransactions_areEqual() {
        // Arrange
        let tx1 = TestDataFactory.createTransaction(id: "test-1")
        let tx2 = TestDataFactory.createTransaction(id: "test-1")

        // Act & Assert
        XCTAssertEqual(tx1, tx2, "Transactions with same ID should be equal")
    }

    func testEquality_differentIDs_areNotEqual() {
        // Arrange
        let tx1 = TestDataFactory.createTransaction(id: "test-1")
        let tx2 = TestDataFactory.createTransaction(id: "test-2")

        // Act & Assert
        XCTAssertNotEqual(tx1, tx2, "Transactions with different IDs should not be equal")
    }

    func testHashable_canBeUsedInSet() {
        // Arrange
        let tx1 = TestDataFactory.createTransaction(id: "test-1")
        let tx2 = TestDataFactory.createTransaction(id: "test-2")
        let tx3 = TestDataFactory.createTransaction(id: "test-1")

        // Act
        let txSet: Set<Transaction> = [tx1, tx2, tx3]

        // Assert
        XCTAssertEqual(txSet.count, 2, "Set should contain only unique transactions")
    }

    // MARK: - Sendable Conformance

    func testTransaction_isSendable() {
        // This test verifies the type conforms to Sendable at compile time

        // Arrange
        let transaction = TestDataFactory.createTransaction()

        // Act
        Task {
            let _ = transaction
        }

        // Assert
        XCTAssertTrue(true, "Transaction should be Sendable for use across actor boundaries")
    }

    // MARK: - Business Logic

    func testAllocatedTransaction_belongsToBudgetLine() {
        // Arrange
        let budgetLineId = "line-123"
        let transaction = TestDataFactory.createTransaction(budgetLineId: budgetLineId)

        // Act & Assert
        XCTAssertEqual(transaction.budgetLineId, budgetLineId, "Allocated transaction should reference budget line")
        XCTAssertTrue(transaction.isAllocated)
    }

    func testFreeTransaction_doesNotBelongToBudgetLine() {
        // Arrange
        let transaction = TestDataFactory.createTransaction(budgetLineId: nil)

        // Act & Assert
        XCTAssertNil(transaction.budgetLineId, "Free transaction should not reference budget line")
        XCTAssertTrue(transaction.isFree)
    }

    // MARK: - Integration with BudgetFormulas

    func testTransaction_canBeUsedInFormulaCalculations() {
        // Arrange
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 100, kind: .income),
            TestDataFactory.createTransaction(id: "2", amount: 50, kind: .expense)
        ]

        // Act
        let totalIncome = BudgetFormulas.calculateTotalIncome(budgetLines: [], transactions: transactions)
        let totalExpenses = BudgetFormulas.calculateTotalExpenses(budgetLines: [], transactions: transactions)

        // Assert
        XCTAssertEqual(totalIncome, 100, "Should contribute to income calculations")
        XCTAssertEqual(totalExpenses, 50, "Should contribute to expense calculations")
    }

    func testCheckedTransaction_contributesToRealizedMetrics() {
        // Arrange
        let transactions = [
            TestDataFactory.createTransaction(id: "1", amount: 100, kind: .income, isChecked: true),
            TestDataFactory.createTransaction(id: "2", amount: 50, kind: .expense, isChecked: false)
        ]

        // Act
        let realizedIncome = BudgetFormulas.calculateRealizedIncome(budgetLines: [], transactions: transactions)
        let realizedExpenses = BudgetFormulas.calculateRealizedExpenses(budgetLines: [], transactions: transactions)

        // Assert
        XCTAssertEqual(realizedIncome, 100, "Checked income should contribute to realized metrics")
        XCTAssertEqual(realizedExpenses, 0, "Unchecked expense should not contribute to realized metrics")
    }
}
