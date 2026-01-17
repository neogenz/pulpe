import XCTest
@testable import Pulpe

/// Tests for MonthYear business logic
/// These functions are used for budget navigation and sorting
final class MonthYearTests: XCTestCase {

    // MARK: - Comparable Tests (Used for Budget Sorting)

    func testComparable_sameYear_comparesMonths() {
        // Arrange
        let january = MonthYear(month: 1, year: 2024)
        let june = MonthYear(month: 6, year: 2024)
        let december = MonthYear(month: 12, year: 2024)

        // Act & Assert
        XCTAssertTrue(january < june, "January should be before June in same year")
        XCTAssertTrue(june < december, "June should be before December in same year")
        XCTAssertFalse(december < january, "December should not be before January")
    }

    func testComparable_differentYears_comparesYearsFirst() {
        // Arrange
        let december2023 = MonthYear(month: 12, year: 2023)
        let january2024 = MonthYear(month: 1, year: 2024)

        // Act & Assert
        XCTAssertTrue(december2023 < january2024, "Dec 2023 should be before Jan 2024")
    }

    func testComparable_sameMonthYear_notLessThan() {
        // Arrange
        let month1 = MonthYear(month: 6, year: 2024)
        let month2 = MonthYear(month: 6, year: 2024)

        // Act & Assert
        XCTAssertFalse(month1 < month2, "Same month/year should not be less than itself")
        XCTAssertEqual(month1, month2, "Same month/year should be equal")
    }

    func testComparable_sortingArray_ordersChronologically() {
        // Arrange
        let unsorted = [
            MonthYear(month: 12, year: 2024),
            MonthYear(month: 3, year: 2024),
            MonthYear(month: 1, year: 2025),
            MonthYear(month: 6, year: 2023)
        ]

        // Act
        let sorted = unsorted.sorted()

        // Assert
        XCTAssertEqual(sorted[0], MonthYear(month: 6, year: 2023), "First should be oldest")
        XCTAssertEqual(sorted[1], MonthYear(month: 3, year: 2024))
        XCTAssertEqual(sorted[2], MonthYear(month: 12, year: 2024))
        XCTAssertEqual(sorted[3], MonthYear(month: 1, year: 2025), "Last should be newest")
    }

    // MARK: - Adding Months (Used for Budget Navigation)

    func testAddingMonths_positiveOffset_movesForward() {
        // Arrange
        let january = MonthYear(month: 1, year: 2024)

        // Act
        let result = january.adding(months: 3)

        // Assert
        XCTAssertEqual(result.month, 4, "Should move to April")
        XCTAssertEqual(result.year, 2024, "Should stay in same year")
    }

    func testAddingMonths_crossesYearBoundary() {
        // Arrange
        let november = MonthYear(month: 11, year: 2024)

        // Act
        let result = november.adding(months: 3)

        // Assert
        XCTAssertEqual(result.month, 2, "Should wrap to February")
        XCTAssertEqual(result.year, 2025, "Should move to next year")
    }

    func testAddingMonths_negativeOffset_movesBackward() {
        // Arrange
        let june = MonthYear(month: 6, year: 2024)

        // Act
        let result = june.adding(months: -3)

        // Assert
        XCTAssertEqual(result.month, 3, "Should move back to March")
        XCTAssertEqual(result.year, 2024, "Should stay in same year")
    }

    func testAddingMonths_negativeOffset_crossesYearBoundary() {
        // Arrange
        let february = MonthYear(month: 2, year: 2024)

        // Act
        let result = february.adding(months: -3)

        // Assert
        XCTAssertEqual(result.month, 11, "Should wrap to November")
        XCTAssertEqual(result.year, 2023, "Should move to previous year")
    }

    func testAddingMonths_zeroOffset_returnsSame() {
        // Arrange
        let july = MonthYear(month: 7, year: 2024)

        // Act
        let result = july.adding(months: 0)

        // Assert
        XCTAssertEqual(result, july, "Zero offset should return same month")
    }

    func testAddingMonths_largeOffset_handlesMultipleYears() {
        // Arrange
        let january = MonthYear(month: 1, year: 2024)

        // Act
        let result = january.adding(months: 24)

        // Assert
        XCTAssertEqual(result.month, 1, "Should still be January")
        XCTAssertEqual(result.year, 2026, "Should be 2 years later")
    }

    // MARK: - Date Static Methods (Used for Budget Status)

    func testIsPast_pastMonth_returnsTrue() {
        // Arrange
        let now = Date()
        let pastMonth = now.month == 1 ? 12 : now.month - 1
        let pastYear = now.month == 1 ? now.year - 1 : now.year

        // Act
        let result = Date.isPast(month: pastMonth, year: pastYear)

        // Assert
        XCTAssertTrue(result, "Month before current should be past")
    }

    func testIsPast_currentMonth_returnsFalse() {
        // Arrange
        let now = Date()

        // Act
        let result = Date.isPast(month: now.month, year: now.year)

        // Assert
        XCTAssertFalse(result, "Current month should not be past")
    }

    func testIsPast_futureMonth_returnsFalse() {
        // Arrange
        let now = Date()
        let futureMonth = now.month == 12 ? 1 : now.month + 1
        let futureYear = now.month == 12 ? now.year + 1 : now.year

        // Act
        let result = Date.isPast(month: futureMonth, year: futureYear)

        // Assert
        XCTAssertFalse(result, "Future month should not be past")
    }

    func testIsPast_previousYear_returnsTrue() {
        // Arrange
        let now = Date()

        // Act
        let result = Date.isPast(month: 12, year: now.year - 1)

        // Assert
        XCTAssertTrue(result, "Any month in previous year should be past")
    }

    func testIsCurrent_currentMonth_returnsTrue() {
        // Arrange
        let now = Date()

        // Act
        let result = Date.isCurrent(month: now.month, year: now.year)

        // Assert
        XCTAssertTrue(result, "Should return true for current month and year")
    }

    func testIsCurrent_differentMonth_returnsFalse() {
        // Arrange
        let now = Date()
        let differentMonth = now.month == 1 ? 2 : now.month - 1

        // Act
        let result = Date.isCurrent(month: differentMonth, year: now.year)

        // Assert
        XCTAssertFalse(result, "Different month should not be current")
    }

    func testIsCurrent_differentYear_returnsFalse() {
        // Arrange
        let now = Date()

        // Act
        let result = Date.isCurrent(month: now.month, year: now.year - 1)

        // Assert
        XCTAssertFalse(result, "Different year should not be current")
    }

    // MARK: - Date Instance Methods

    func testDateIsPastMonth_usesCorrectLogic() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current

        guard let pastDate = calendar.date(byAdding: .month, value: -1, to: now) else {
            XCTFail("Could not create past date")
            return
        }

        // Act
        let result = pastDate.isPastMonth

        // Assert
        XCTAssertTrue(result, "Date one month ago should be past")
    }

    func testDateIsFutureMonth_usesCorrectLogic() {
        // Arrange
        let now = Date()
        let calendar = Calendar.current

        guard let futureDate = calendar.date(byAdding: .month, value: 1, to: now) else {
            XCTFail("Could not create future date")
            return
        }

        // Act
        let result = futureDate.isFutureMonth

        // Assert
        XCTAssertTrue(result, "Date one month ahead should be future")
    }

    func testDateIsCurrentMonth_todayReturnsTrue() {
        // Arrange
        let today = Date()

        // Act
        let result = today.isCurrentMonth

        // Assert
        XCTAssertTrue(result, "Today should be current month")
    }

    // MARK: - Hashable (Used for Budget Deduplication)

    func testHashable_sameValues_sameHash() {
        // Arrange
        let month1 = MonthYear(month: 6, year: 2024)
        let month2 = MonthYear(month: 6, year: 2024)

        // Act & Assert
        XCTAssertEqual(month1.hashValue, month2.hashValue, "Same values should produce same hash")
    }

    func testHashable_canBeUsedAsSetKey() {
        // Arrange
        let month1 = MonthYear(month: 6, year: 2024)
        let month2 = MonthYear(month: 6, year: 2024)
        let month3 = MonthYear(month: 7, year: 2024)

        // Act
        let set: Set<MonthYear> = [month1, month2, month3]

        // Assert
        XCTAssertEqual(set.count, 2, "Set should deduplicate same month/year")
    }

    func testHashable_canBeUsedAsDictionaryKey() {
        // Arrange
        let january = MonthYear(month: 1, year: 2024)
        let february = MonthYear(month: 2, year: 2024)

        // Act
        var budgetsByMonth: [MonthYear: String] = [:]
        budgetsByMonth[january] = "Budget January"
        budgetsByMonth[february] = "Budget February"

        // Assert
        XCTAssertEqual(budgetsByMonth[january], "Budget January")
        XCTAssertEqual(budgetsByMonth[february], "Budget February")
    }
}
