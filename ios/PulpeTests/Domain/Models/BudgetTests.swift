import Foundation
import Testing
@testable import Pulpe

struct BudgetTests {

    // MARK: - Month/Year Display

    @Test func monthYearFormatsCorrectly() {
        // Arrange
        let budget = TestDataFactory.createBudget(month: 1, year: 2025)

        // Act
        let result = budget.monthYear

        // Assert
        #expect(result.contains("Janvier") || result.contains("janvier"))
        #expect(result.contains("2025"))
    }

    @Test func shortMonthYearFormatsCorrectly() {
        // Arrange
        let budget = TestDataFactory.createBudget(month: 12, year: 2024)

        // Act
        let result = budget.shortMonthYear

        // Assert
        #expect(result.contains("Déc") || result.contains("déc"))
        #expect(result.contains("2024"))
    }

    @Test func monthYearWithEdgeCaseMonthAutoCorrects() {
        // Arrange
        // Note: Calendar auto-corrects invalid months (month 0 becomes previous year's December)
        let budget = TestDataFactory.createBudget(month: 13, year: 2025)

        // Act
        let result = budget.monthYear

        // Assert
        // Month 13 gets auto-corrected to January 2026 by Calendar
        #expect(result.contains("2026"))
    }

    // MARK: - Current Month Detection

    @Test func isCurrentMonthWhenMatchesCurrentDateReturnsTrue() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        let budget = TestDataFactory.createBudget(month: currentMonth, year: currentYear)

        // Act
        let result = budget.isCurrentMonth

        // Assert
        #expect(result)
    }

    @Test func isCurrentMonthWhenDifferentMonthReturnsFalse() {
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
        #expect(!result)
    }

    @Test func isCurrentMonthWhenDifferentYearReturnsFalse() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        let budget = TestDataFactory.createBudget(month: currentMonth, year: currentYear - 1)

        // Act
        let result = budget.isCurrentMonth

        // Assert
        #expect(!result)
    }

    @Test func isCurrentMonthWhenBothDifferReturnsFalse() {
        // Arrange
        let budget = TestDataFactory.createBudget(month: 1, year: 2020)

        // Act
        let result = budget.isCurrentMonth

        // Assert
        #expect(!result)
    }

    // MARK: - Equality and Hashing

    @Test func equalitySameBudgetsAreEqual() {
        // Arrange
        let budget1 = TestDataFactory.createBudget(id: "test-1", month: 1, year: 2025)
        let budget2 = TestDataFactory.createBudget(id: "test-1", month: 1, year: 2025)

        // Act & Assert
        #expect(budget1 == budget2)
    }

    @Test func equalityDifferentIDsAreNotEqual() {
        // Arrange
        let budget1 = TestDataFactory.createBudget(id: "test-1")
        let budget2 = TestDataFactory.createBudget(id: "test-2")

        // Act & Assert
        #expect(budget1 != budget2)
    }

    @Test func hashableCanBeUsedInSet() {
        // Arrange
        let budget1 = TestDataFactory.createBudget(id: "test-1")
        let budget2 = TestDataFactory.createBudget(id: "test-2")
        let budget3 = TestDataFactory.createBudget(id: "test-1")

        // Act
        let budgetSet: Set<Budget> = [budget1, budget2, budget3]

        // Assert
        #expect(budgetSet.count == 2)
    }

    // MARK: - Rollover Handling

    @Test func rolloverWhenPositiveIndicatesSurplus() {
        // Arrange
        let budget = TestDataFactory.createBudget(rollover: 500)

        // Act & Assert
        #expect(budget.rollover == 500)
    }

    @Test func rolloverWhenNegativeIndicatesDeficit() {
        // Arrange
        let budget = TestDataFactory.createBudget(rollover: -300)

        // Act & Assert
        #expect(budget.rollover == -300)
    }

    @Test func rolloverWhenZeroIndicatesBalanced() {
        // Arrange
        let budget = TestDataFactory.createBudget(rollover: 0)

        // Act & Assert
        #expect(budget.rollover == 0)
    }

}
