import XCTest
@testable import Pulpe

/// Tests for Budget model behavior
/// Focuses on computed properties and business logic, not data storage
final class BudgetTests: XCTestCase {

    // MARK: - Month/Year Display

    func testMonthYear_formatsCorrectly() {
        // Arrange
        let budget = TestDataFactory.createBudget(month: 1, year: 2025)

        // Act
        let result = budget.monthYear

        // Assert
        XCTAssertTrue(result.contains("Janvier") || result.contains("janvier"), "Should contain month name")
        XCTAssertTrue(result.contains("2025"), "Should contain year")
    }

    func testShortMonthYear_formatsCorrectly() {
        // Arrange
        let budget = TestDataFactory.createBudget(month: 12, year: 2024)

        // Act
        let result = budget.shortMonthYear

        // Assert
        XCTAssertTrue(result.contains("Déc") || result.contains("déc"), "Should contain abbreviated month")
        XCTAssertTrue(result.contains("2024"), "Should contain year")
    }

    func testMonthYear_withEdgeCaseMonth_autoCorrects() {
        // Arrange
        // Note: Calendar auto-corrects invalid months (month 0 becomes previous year's December)
        let budget = TestDataFactory.createBudget(month: 13, year: 2025)

        // Act
        let result = budget.monthYear

        // Assert
        // Month 13 gets auto-corrected to January 2026 by Calendar
        XCTAssertTrue(result.contains("2026"), "Calendar should auto-correct month 13 to next year")
    }

    // MARK: - Current Month Detection

    func testIsCurrentMonth_whenMatchesCurrentDate_returnsTrue() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        let budget = TestDataFactory.createBudget(month: currentMonth, year: currentYear)

        // Act
        let result = budget.isCurrentMonth

        // Assert
        XCTAssertTrue(result, "Should return true for current month and year")
    }

    func testIsCurrentMonth_whenDifferentMonth_returnsFalse() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        let differentMonth = currentMonth == 1 ? 2 : currentMonth - 1
        let budget = TestDataFactory.createBudget(month: differentMonth, year: currentYear)

        // Act
        let result = budget.isCurrentMonth

        // Assert
        XCTAssertFalse(result, "Should return false when month differs")
    }

    func testIsCurrentMonth_whenDifferentYear_returnsFalse() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        let budget = TestDataFactory.createBudget(month: currentMonth, year: currentYear - 1)

        // Act
        let result = budget.isCurrentMonth

        // Assert
        XCTAssertFalse(result, "Should return false when year differs")
    }

    func testIsCurrentMonth_whenBothDiffer_returnsFalse() {
        // Arrange
        let budget = TestDataFactory.createBudget(month: 1, year: 2020)

        // Act
        let result = budget.isCurrentMonth

        // Assert
        XCTAssertFalse(result, "Should return false when both month and year differ")
    }

    // MARK: - Equality and Hashing

    func testEquality_sameBudgets_areEqual() {
        // Arrange
        let budget1 = TestDataFactory.createBudget(id: "test-1", month: 1, year: 2025)
        let budget2 = TestDataFactory.createBudget(id: "test-1", month: 1, year: 2025)

        // Act & Assert
        XCTAssertEqual(budget1, budget2, "Budgets with same ID should be equal")
    }

    func testEquality_differentIDs_areNotEqual() {
        // Arrange
        let budget1 = TestDataFactory.createBudget(id: "test-1")
        let budget2 = TestDataFactory.createBudget(id: "test-2")

        // Act & Assert
        XCTAssertNotEqual(budget1, budget2, "Budgets with different IDs should not be equal")
    }

    func testHashable_canBeUsedInSet() {
        // Arrange
        let budget1 = TestDataFactory.createBudget(id: "test-1")
        let budget2 = TestDataFactory.createBudget(id: "test-2")
        let budget3 = TestDataFactory.createBudget(id: "test-1")

        // Act
        let budgetSet: Set<Budget> = [budget1, budget2, budget3]

        // Assert
        XCTAssertEqual(budgetSet.count, 2, "Set should contain only unique budgets")
    }

    // MARK: - Rollover Handling

    func testRollover_whenPositive_indicatesSurplus() {
        // Arrange
        let budget = TestDataFactory.createBudget(rollover: 500)

        // Act & Assert
        XCTAssertEqual(budget.rollover, 500, "Should store positive rollover")
    }

    func testRollover_whenNegative_indicatesDeficit() {
        // Arrange
        let budget = TestDataFactory.createBudget(rollover: -300)

        // Act & Assert
        XCTAssertEqual(budget.rollover, -300, "Should store negative rollover")
    }

    func testRollover_whenZero_indicatesBalanced() {
        // Arrange
        let budget = TestDataFactory.createBudget(rollover: 0)

        // Act & Assert
        XCTAssertEqual(budget.rollover, 0, "Should store zero rollover")
    }

}
