import Foundation
import Testing
@testable import Pulpe

struct BudgetListAccessibilityTests {

    // MARK: - BudgetSparse.isCurrentMonth

    @Test func isCurrentMonthWithCurrentMonthAndYearReturnsTrue() {
        let now = Date()
        let calendar = Calendar.current
        let budget = TestDataFactory.createBudgetSparse(
            month: calendar.component(.month, from: now),
            year: calendar.component(.year, from: now)
        )

        #expect(budget.isCurrentMonth)
    }

    @Test func isCurrentMonthWithDifferentMonthReturnsFalse() {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let otherMonth = currentMonth == 12 ? 1 : currentMonth + 1

        let budget = TestDataFactory.createBudgetSparse(
            month: otherMonth,
            year: calendar.component(.year, from: now)
        )

        #expect(!budget.isCurrentMonth)
    }

    @Test func isCurrentMonthWithDifferentYearReturnsFalse() {
        let now = Date()
        let calendar = Calendar.current

        let budget = TestDataFactory.createBudgetSparse(
            month: calendar.component(.month, from: now),
            year: calendar.component(.year, from: now) - 1
        )

        #expect(!budget.isCurrentMonth)
    }

    @Test func isCurrentMonthWithNilMonthReturnsFalse() {
        let budget = TestDataFactory.createBudgetSparse(month: nil, year: 2025)
        #expect(!budget.isCurrentMonth)
    }

    @Test func isCurrentMonthWithNilYearReturnsFalse() {
        let budget = TestDataFactory.createBudgetSparse(month: 1, year: nil)
        #expect(!budget.isCurrentMonth)
    }

    // MARK: - Remaining Amount Formatting (used in accessibility labels)

    @Test func compactCHFPositiveAmountIncludesNoSign() {
        let amount: Decimal = 5158.70
        let formatted = amount.asCompactCHF

        #expect(!formatted.hasPrefix("-"))
        #expect(formatted.contains("5"))
    }

    @Test func compactCHFNegativeAmountIncludesMinusSign() {
        let amount: Decimal = -1970.90
        let formatted = amount.asCompactCHF

        #expect(formatted.contains("-"))
    }

    @Test func compactCHFZeroAmountFormatsCorrectly() {
        let amount: Decimal = 0
        let formatted = amount.asCompactCHF

        #expect(!formatted.isEmpty)
    }

    // MARK: - Date.isPast (used for month row styling)

    @Test func isPastWithPastMonthReturnsTrue() {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        // A month in the past
        if currentMonth > 1 {
            #expect(Date.isPast(month: currentMonth - 1, year: currentYear))
        } else {
            #expect(Date.isPast(month: 12, year: currentYear - 1))
        }
    }

    @Test func isPastWithCurrentMonthReturnsFalse() {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        #expect(!Date.isPast(month: currentMonth, year: currentYear))
    }

    @Test func isPastWithFutureMonthReturnsFalse() {
        let now = Date()
        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        if currentMonth < 12 {
            #expect(!Date.isPast(month: currentMonth + 1, year: currentYear))
        } else {
            #expect(!Date.isPast(month: 1, year: currentYear + 1))
        }
    }
}
