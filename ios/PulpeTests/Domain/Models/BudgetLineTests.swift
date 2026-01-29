import XCTest
@testable import Pulpe

/// Tests for BudgetLine model behavior
/// Focuses on state management and business logic
final class BudgetLineTests: XCTestCase {

    // MARK: - Check Status

    func testIsChecked_whenCheckedAtIsNil_returnsFalse() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(isChecked: false)

        // Act
        let result = line.isChecked

        // Assert
        XCTAssertFalse(result, "Should return false when checkedAt is nil")
    }

    func testIsChecked_whenCheckedAtHasValue_returnsTrue() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(isChecked: true)

        // Act
        let result = line.isChecked

        // Assert
        XCTAssertTrue(result, "Should return true when checkedAt has a value")
    }

    // MARK: - Toggle Behavior

    func testToggled_whenUnchecked_setsCheckedAt() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(isChecked: false)

        // Act
        let toggled = line.toggled()

        // Assert
        XCTAssertTrue(toggled.isChecked, "Should set checkedAt when toggling unchecked line")
        XCTAssertNotNil(toggled.checkedAt, "checkedAt should not be nil after toggling")
    }

    func testToggled_whenChecked_clearsCheckedAt() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(isChecked: true)

        // Act
        let toggled = line.toggled()

        // Assert
        XCTAssertFalse(toggled.isChecked, "Should clear checkedAt when toggling checked line")
        XCTAssertNil(toggled.checkedAt, "checkedAt should be nil after toggling")
    }

    func testToggled_preservesAllOtherFields() {
        // Arrange
        let original = BudgetLine(
            id: "test-id",
            budgetId: "budget-123",
            templateLineId: "template-456",
            savingsGoalId: "goal-789",
            name: "Test Line",
            amount: 1500,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: true,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date(),
            isRollover: false,
            rolloverSourceBudgetId: nil
        )

        // Act
        let toggled = original.toggled()

        // Assert
        XCTAssertEqual(toggled.id, original.id)
        XCTAssertEqual(toggled.budgetId, original.budgetId)
        XCTAssertEqual(toggled.templateLineId, original.templateLineId)
        XCTAssertEqual(toggled.savingsGoalId, original.savingsGoalId)
        XCTAssertEqual(toggled.name, original.name)
        XCTAssertEqual(toggled.amount, original.amount)
        XCTAssertEqual(toggled.kind, original.kind)
        XCTAssertEqual(toggled.recurrence, original.recurrence)
        XCTAssertEqual(toggled.isManuallyAdjusted, original.isManuallyAdjusted)
        XCTAssertEqual(toggled.isRollover, original.isRollover)
    }

    func testToggled_canBeToggledMultipleTimes() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(isChecked: false)

        // Act
        let toggled1 = line.toggled()
        let toggled2 = toggled1.toggled()
        let toggled3 = toggled2.toggled()

        // Assert
        XCTAssertTrue(toggled1.isChecked, "First toggle should check")
        XCTAssertFalse(toggled2.isChecked, "Second toggle should uncheck")
        XCTAssertTrue(toggled3.isChecked, "Third toggle should check again")
    }

    // MARK: - Template Association

    func testIsFromTemplate_whenTemplateLineIdExists_returnsTrue() {
        // Arrange
        let line = BudgetLine(
            id: "test-id",
            budgetId: "budget-123",
            templateLineId: "template-456",
            savingsGoalId: nil,
            name: "Test",
            amount: 100,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Act
        let result = line.isFromTemplate

        // Assert
        XCTAssertTrue(result, "Should return true when templateLineId is present")
    }

    func testIsFromTemplate_whenTemplateLineIdIsNil_returnsFalse() {
        // Arrange
        let line = BudgetLine(
            id: "test-id",
            budgetId: "budget-123",
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Test",
            amount: 100,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Act
        let result = line.isFromTemplate

        // Assert
        XCTAssertFalse(result, "Should return false when templateLineId is nil")
    }

    // MARK: - Rollover Handling

    func testIsVirtualRollover_whenIsRolloverTrue_returnsTrue() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(isRollover: true)

        // Act
        let result = line.isVirtualRollover

        // Assert
        XCTAssertTrue(result, "Should return true when isRollover is true")
    }

    func testIsVirtualRollover_whenIsRolloverFalse_returnsFalse() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(isRollover: false)

        // Act
        let result = line.isVirtualRollover

        // Assert
        XCTAssertFalse(result, "Should return false when isRollover is false")
    }

    func testRolloverLine_createsCorrectVirtualLine() {
        // Arrange
        let amount: Decimal = 500
        let budgetId = "budget-123"
        let sourceBudgetId = "budget-122"

        // Act
        let rollover = BudgetLine.rolloverLine(
            amount: amount,
            budgetId: budgetId,
            sourceBudgetId: sourceBudgetId
        )

        // Assert
        XCTAssertEqual(rollover.amount, 500)
        XCTAssertEqual(rollover.budgetId, budgetId)
        XCTAssertEqual(rollover.rolloverSourceBudgetId, sourceBudgetId)
        XCTAssertTrue(rollover.isVirtualRollover)
        XCTAssertTrue(rollover.isChecked, "Rollover lines should always be checked")
        XCTAssertEqual(rollover.kind, .income, "Positive rollover should be income")
    }

    func testRolloverLine_withNegativeAmount_createsExpense() {
        // Arrange
        let amount: Decimal = -300

        // Act
        let rollover = BudgetLine.rolloverLine(
            amount: amount,
            budgetId: "budget-123",
            sourceBudgetId: nil
        )

        // Assert
        XCTAssertEqual(rollover.amount, -300)
        XCTAssertEqual(rollover.kind, .expense, "Negative rollover should be expense")
    }

    func testRolloverLine_hasExpectedName() {
        // Arrange & Act
        let rollover = BudgetLine.rolloverLine(
            amount: 100,
            budgetId: "budget-123",
            sourceBudgetId: nil
        )

        // Assert
        XCTAssertEqual(rollover.name, "Report du mois précédent")
    }

    // MARK: - Kind Categorization

    func testKind_income_isNotOutflow() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(kind: .income)

        // Act & Assert
        XCTAssertEqual(line.kind, .income)
        XCTAssertFalse(line.kind.isOutflow, "Income should not be outflow")
    }

    func testKind_expense_isOutflow() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(kind: .expense)

        // Act & Assert
        XCTAssertEqual(line.kind, .expense)
        XCTAssertTrue(line.kind.isOutflow, "Expense should be outflow")
    }

    func testKind_saving_isOutflow() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(kind: .saving)

        // Act & Assert
        XCTAssertEqual(line.kind, .saving)
        XCTAssertTrue(line.kind.isOutflow, "Saving should be outflow")
    }

    // MARK: - Recurrence Types

    func testRecurrence_fixed_representsRecurring() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(recurrence: .fixed)

        // Act & Assert
        XCTAssertEqual(line.recurrence, .fixed, "Should support fixed recurrence")
    }

    func testRecurrence_oneOff_representsNonRecurring() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(recurrence: .oneOff)

        // Act & Assert
        XCTAssertEqual(line.recurrence, .oneOff, "Should support one-off recurrence")
    }

    // MARK: - Equality and Hashing

    func testEquality_sameBudgetLines_areEqual() {
        // Arrange
        let line1 = TestDataFactory.createBudgetLine(id: "test-1")
        let line2 = TestDataFactory.createBudgetLine(id: "test-1")

        // Act & Assert
        XCTAssertEqual(line1, line2, "BudgetLines with same ID should be equal")
    }

    func testEquality_differentIDs_areNotEqual() {
        // Arrange
        let line1 = TestDataFactory.createBudgetLine(id: "test-1")
        let line2 = TestDataFactory.createBudgetLine(id: "test-2")

        // Act & Assert
        XCTAssertNotEqual(line1, line2, "BudgetLines with different IDs should not be equal")
    }

    func testHashable_canBeUsedInSet() {
        // Arrange
        let line1 = TestDataFactory.createBudgetLine(id: "test-1")
        let line2 = TestDataFactory.createBudgetLine(id: "test-2")
        let line3 = TestDataFactory.createBudgetLine(id: "test-1")

        // Act
        let lineSet: Set<BudgetLine> = [line1, line2, line3]

        // Assert
        XCTAssertEqual(lineSet.count, 2, "Set should contain only unique budget lines")
    }

    // MARK: - Amount Validation

    func testAmount_canBePositive() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(amount: 1500)

        // Act & Assert
        XCTAssertEqual(line.amount, 1500, "Should store positive amounts")
    }

    func testAmount_canBeZero() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(amount: 0)

        // Act & Assert
        XCTAssertEqual(line.amount, 0, "Should allow zero amounts")
    }

    func testAmount_usesDecimalForPrecision() {
        // Arrange
        let line = TestDataFactory.createBudgetLine(amount: Decimal(string: "1234.56")!)

        // Act & Assert
        XCTAssertEqual(line.amount, Decimal(string: "1234.56")!, "Should preserve decimal precision")
    }
}
