import XCTest
@testable import Pulpe

/// Tests for BudgetService business logic
/// Focuses on pure logic functions without API calls
final class BudgetServiceTests: XCTestCase {

    var sut: BudgetService!

    override func setUp() {
        sut = BudgetService.shared
    }

    // MARK: - getNextAvailableMonth Tests

    func testGetNextAvailableMonth_withNoBudgets_returnsCurrentMonth() {
        // Arrange
        let emptyBudgets: [Budget] = []
        let now = Date()
        let expectedMonth = now.month
        let expectedYear = now.year

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: emptyBudgets)

        // Assert
        XCTAssertNotNil(result, "Should return current month when no budgets exist")
        XCTAssertEqual(result?.month, expectedMonth)
        XCTAssertEqual(result?.year, expectedYear)
    }

    func testGetNextAvailableMonth_whenCurrentMonthTaken_returnsNextMonth() {
        // Arrange
        let now = Date()
        let currentMonthBudget = TestDataFactory.createBudget(
            month: now.month,
            year: now.year
        )

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: [currentMonthBudget])

        // Assert
        XCTAssertNotNil(result, "Should find next available month")

        // Verify it's not the current month
        let isSameMonth = result?.month == now.month && result?.year == now.year
        XCTAssertFalse(isSameMonth, "Should skip the current month since it's taken")

        // Verify it's a future month
        if let resultMonth = result?.month, let resultYear = result?.year {
            XCTAssertTrue(
                resultYear > now.year || (resultYear == now.year && resultMonth > now.month),
                "Result should be in the future"
            )
        }
    }

    func testGetNextAvailableMonth_skipsMultipleTakenMonths() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current

        // Create budgets for current month and next 2 months
        var takenBudgets: [Budget] = []
        for offset in 0..<3 {
            if let date = calendar.date(byAdding: .month, value: offset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(offset)",
                    month: date.month,
                    year: date.year
                )
                takenBudgets.append(budget)
            }
        }

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: takenBudgets)

        // Assert
        XCTAssertNotNil(result, "Should find an available month after skipping taken ones")

        // Verify it's not one of the taken months
        let isTaken = takenBudgets.contains { budget in
            budget.month == result?.month && budget.year == result?.year
        }
        XCTAssertFalse(isTaken, "Should not return a month that's already taken")
    }

    func testGetNextAvailableMonth_findsGapInMiddleOfSequence() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current

        // Create budgets for months 0, 1, 3 (skip month 2)
        var budgetsWithGap: [Budget] = []
        for offset in [0, 1, 3] {
            if let date = calendar.date(byAdding: .month, value: offset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(offset)",
                    month: date.month,
                    year: date.year
                )
                budgetsWithGap.append(budget)
            }
        }

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: budgetsWithGap)

        // Assert
        XCTAssertNotNil(result, "Should find the gap in the sequence")

        // Verify it found month 2 (the gap)
        if let expectedDate = calendar.date(byAdding: .month, value: 2, to: now) {
            XCTAssertEqual(result?.month, expectedDate.month, "Should find the gap at offset 2")
            XCTAssertEqual(result?.year, expectedDate.year, "Should find the gap at offset 2")
        }
    }

    func testGetNextAvailableMonth_handlesYearTransition() {
        // Arrange
        let decemberBudget = TestDataFactory.createBudget(month: 12, year: 2025)

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: [decemberBudget])

        // Assert
        XCTAssertNotNil(result, "Should handle year transition")
        if let result = result {
            // Should either be a different month in 2025, or any month in 2026
            let isValid = (result.year == 2025 && result.month != 12) || result.year >= 2026
            XCTAssertTrue(isValid, "Should correctly handle December to January transition")
        }
    }

    func testGetNextAvailableMonth_respectsMaxYearsAheadLimit() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current
        let maxYears = AppConfiguration.maxBudgetYearsAhead

        // Fill all months for the max period
        var allBudgets: [Budget] = []
        for monthOffset in 0..<(maxYears * 12) {
            if let date = calendar.date(byAdding: .month, value: monthOffset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(monthOffset)",
                    month: date.month,
                    year: date.year
                )
                allBudgets.append(budget)
            }
        }

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: allBudgets)

        // Assert
        XCTAssertNil(result, "Should return nil when all slots within max range are taken")
    }

    func testGetNextAvailableMonth_withRandomlyDistributedBudgets_findsFirstGap() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current

        // Create budgets at offsets 0, 2, 4, 6 (leaving gaps at 1, 3, 5)
        var sparselyDistributed: [Budget] = []
        for offset in stride(from: 0, to: 8, by: 2) {
            if let date = calendar.date(byAdding: .month, value: offset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(offset)",
                    month: date.month,
                    year: date.year
                )
                sparselyDistributed.append(budget)
            }
        }

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: sparselyDistributed)

        // Assert
        XCTAssertNotNil(result, "Should find first available gap")

        // Should find offset 1 (the first gap)
        if let expectedDate = calendar.date(byAdding: .month, value: 1, to: now) {
            XCTAssertEqual(result?.month, expectedDate.month, "Should find the first gap at offset 1")
            XCTAssertEqual(result?.year, expectedDate.year, "Should find the first gap at offset 1")
        }
    }

    func testGetNextAvailableMonth_returnsFirstAvailableNotLastInSequence() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current

        // Take months 1 and 2, leaving month 0 available
        var futureBudgets: [Budget] = []
        for offset in 1...2 {
            if let date = calendar.date(byAdding: .month, value: offset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(offset)",
                    month: date.month,
                    year: date.year
                )
                futureBudgets.append(budget)
            }
        }

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: futureBudgets)

        // Assert
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.month, now.month, "Should return current month (offset 0) as it's available")
        XCTAssertEqual(result?.year, now.year, "Should return current year")
    }

    // MARK: - Edge Cases

    func testGetNextAvailableMonth_withDuplicateBudgets_stillFindsGap() {
        // Arrange
        let now = Date()

        // Create duplicate budgets for current month
        let budget1 = TestDataFactory.createBudget(id: "budget-1", month: now.month, year: now.year)
        let budget2 = TestDataFactory.createBudget(id: "budget-2", month: now.month, year: now.year)

        // Act
        let result = sut.getNextAvailableMonth(existingBudgets: [budget1, budget2])

        // Assert
        XCTAssertNotNil(result, "Should handle duplicate budgets and find next month")

        // Should not be current month
        let isNotCurrent = result?.month != now.month || result?.year != now.year
        XCTAssertTrue(isNotCurrent, "Should skip current month despite duplicates")
    }
}
