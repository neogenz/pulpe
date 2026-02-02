import XCTest
@testable import Pulpe

/// Tests for budget list view model logic and accessibility concerns
final class BudgetListAccessibilityTests: XCTestCase {

    // MARK: - BudgetSparse.isCurrentMonth

    func testIsCurrentMonth_withCurrentMonthAndYear_returnsTrue() {
        let now = Date()
        let calendar = Calendar.current
        let budget = TestDataFactory.createBudgetSparse(
            month: calendar.component(.month, from: now),
            year: calendar.component(.year, from: now)
        )

        XCTAssertTrue(budget.isCurrentMonth)
    }

    func testIsCurrentMonth_withDifferentMonth_returnsFalse() {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let otherMonth = currentMonth == 12 ? 1 : currentMonth + 1

        let budget = TestDataFactory.createBudgetSparse(
            month: otherMonth,
            year: calendar.component(.year, from: now)
        )

        XCTAssertFalse(budget.isCurrentMonth)
    }

    func testIsCurrentMonth_withDifferentYear_returnsFalse() {
        let now = Date()
        let calendar = Calendar.current

        let budget = TestDataFactory.createBudgetSparse(
            month: calendar.component(.month, from: now),
            year: calendar.component(.year, from: now) - 1
        )

        XCTAssertFalse(budget.isCurrentMonth)
    }

    func testIsCurrentMonth_withNilMonth_returnsFalse() {
        let budget = TestDataFactory.createBudgetSparse(month: nil, year: 2025)
        XCTAssertFalse(budget.isCurrentMonth)
    }

    func testIsCurrentMonth_withNilYear_returnsFalse() {
        let budget = TestDataFactory.createBudgetSparse(month: 1, year: nil)
        XCTAssertFalse(budget.isCurrentMonth)
    }

    // MARK: - Remaining Amount Formatting (used in accessibility labels)

    func testCompactCHF_positiveAmount_includesNoSign() {
        let amount: Decimal = 5158.70
        let formatted = amount.asCompactCHF

        XCTAssertFalse(formatted.hasPrefix("-"), "Positive amount should not have minus sign")
        XCTAssertTrue(formatted.contains("5"), "Should contain the amount digits")
    }

    func testCompactCHF_negativeAmount_includesMinusSign() {
        let amount: Decimal = -1970.90
        let formatted = amount.asCompactCHF

        XCTAssertTrue(formatted.contains("-"), "Negative amount should contain minus sign")
    }

    func testCompactCHF_zeroAmount_formatsCorrectly() {
        let amount: Decimal = 0
        let formatted = amount.asCompactCHF

        XCTAssertFalse(formatted.isEmpty, "Zero amount should produce non-empty string")
    }

    // MARK: - Date.isPast (used for month row styling)

    func testIsPast_withPastMonth_returnsTrue() {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        // A month in the past
        if currentMonth > 1 {
            XCTAssertTrue(Date.isPast(month: currentMonth - 1, year: currentYear))
        } else {
            XCTAssertTrue(Date.isPast(month: 12, year: currentYear - 1))
        }
    }

    func testIsPast_withCurrentMonth_returnsFalse() {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        XCTAssertFalse(Date.isPast(month: currentMonth, year: currentYear))
    }

    func testIsPast_withFutureMonth_returnsFalse() {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        if currentMonth < 12 {
            XCTAssertFalse(Date.isPast(month: currentMonth + 1, year: currentYear))
        } else {
            XCTAssertFalse(Date.isPast(month: 1, year: currentYear + 1))
        }
    }
}
