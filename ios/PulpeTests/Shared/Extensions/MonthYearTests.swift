import Foundation
import Testing
@testable import Pulpe

struct MonthYearTests {

    // MARK: - Comparable Tests (Used for Budget Sorting)

    @Test func comparable_sameYear_comparesMonths() {
        let january = MonthYear(month: 1, year: 2024)
        let june = MonthYear(month: 6, year: 2024)
        let december = MonthYear(month: 12, year: 2024)
        #expect(january < june)
        #expect(june < december)
        #expect(!(december < january))
    }

    @Test func comparable_differentYears_comparesYearsFirst() {
        let december2023 = MonthYear(month: 12, year: 2023)
        let january2024 = MonthYear(month: 1, year: 2024)
        #expect(december2023 < january2024)
    }

    @Test func comparable_sameMonthYear_notLessThan() {
        let month1 = MonthYear(month: 6, year: 2024)
        let month2 = MonthYear(month: 6, year: 2024)
        #expect(!(month1 < month2))
        #expect(month1 == month2)
    }

    @Test func comparable_sortingArray_ordersChronologically() {
        let unsorted = [
            MonthYear(month: 12, year: 2024),
            MonthYear(month: 3, year: 2024),
            MonthYear(month: 1, year: 2025),
            MonthYear(month: 6, year: 2023)
        ]
        let sorted = unsorted.sorted()
        #expect(sorted[0] == MonthYear(month: 6, year: 2023))
        #expect(sorted[1] == MonthYear(month: 3, year: 2024))
        #expect(sorted[2] == MonthYear(month: 12, year: 2024))
        #expect(sorted[3] == MonthYear(month: 1, year: 2025))
    }

    // MARK: - Adding Months (Used for Budget Navigation)

    @Test func addingMonths_positiveOffset_movesForward() {
        let january = MonthYear(month: 1, year: 2024)
        let result = january.adding(months: 3)
        #expect(result.month == 4)
        #expect(result.year == 2024)
    }

    @Test func addingMonths_crossesYearBoundary() {
        let november = MonthYear(month: 11, year: 2024)
        let result = november.adding(months: 3)
        #expect(result.month == 2)
        #expect(result.year == 2025)
    }

    @Test func addingMonths_negativeOffset_movesBackward() {
        let june = MonthYear(month: 6, year: 2024)
        let result = june.adding(months: -3)
        #expect(result.month == 3)
        #expect(result.year == 2024)
    }

    @Test func addingMonths_negativeOffset_crossesYearBoundary() {
        let february = MonthYear(month: 2, year: 2024)
        let result = february.adding(months: -3)
        #expect(result.month == 11)
        #expect(result.year == 2023)
    }

    @Test func addingMonths_zeroOffset_returnsSame() {
        let july = MonthYear(month: 7, year: 2024)
        let result = july.adding(months: 0)
        #expect(result == july)
    }

    @Test func addingMonths_largeOffset_handlesMultipleYears() {
        let january = MonthYear(month: 1, year: 2024)
        let result = january.adding(months: 24)
        #expect(result.month == 1)
        #expect(result.year == 2026)
    }

    // MARK: - Date Static Methods (Used for Budget Status)

    @Test func isPast_pastMonth_returnsTrue() {
        let now = Date()
        let pastMonth = now.month == 1 ? 12 : now.month - 1
        let pastYear = now.month == 1 ? now.year - 1 : now.year
        let result = Date.isPast(month: pastMonth, year: pastYear)
        #expect(result)
    }

    @Test func isPast_currentMonth_returnsFalse() {
        let now = Date()
        let result = Date.isPast(month: now.month, year: now.year)
        #expect(!result)
    }

    @Test func isPast_futureMonth_returnsFalse() {
        let now = Date()
        let futureMonth = now.month == 12 ? 1 : now.month + 1
        let futureYear = now.month == 12 ? now.year + 1 : now.year
        let result = Date.isPast(month: futureMonth, year: futureYear)
        #expect(!result)
    }

    @Test func isPast_previousYear_returnsTrue() {
        let now = Date()
        let result = Date.isPast(month: 12, year: now.year - 1)
        #expect(result)
    }

    @Test func isCurrent_currentMonth_returnsTrue() {
        let now = Date()
        let result = Date.isCurrent(month: now.month, year: now.year)
        #expect(result)
    }

    @Test func isCurrent_differentMonth_returnsFalse() {
        let now = Date()
        let differentMonth = now.month == 1 ? 2 : now.month - 1
        let result = Date.isCurrent(month: differentMonth, year: now.year)
        #expect(!result)
    }

    @Test func isCurrent_differentYear_returnsFalse() {
        let now = Date()
        let result = Date.isCurrent(month: now.month, year: now.year - 1)
        #expect(!result)
    }

    // MARK: - Date Instance Methods

    @Test func dateIsPastMonth_usesCorrectLogic() throws {
        let now = Date()
        let calendar = Calendar.current
        let pastDate = try #require(calendar.date(byAdding: .month, value: -1, to: now))
        let result = pastDate.isPastMonth
        #expect(result)
    }

    @Test func dateIsFutureMonth_usesCorrectLogic() throws {
        let now = Date()
        let calendar = Calendar.current
        let futureDate = try #require(calendar.date(byAdding: .month, value: 1, to: now))
        let result = futureDate.isFutureMonth
        #expect(result)
    }

    @Test func dateIsCurrentMonth_todayReturnsTrue() {
        let today = Date()
        let result = today.isCurrentMonth
        #expect(result)
    }

    // MARK: - Hashable (Used for Budget Deduplication)

    @Test func hashable_sameValues_sameHash() {
        let month1 = MonthYear(month: 6, year: 2024)
        let month2 = MonthYear(month: 6, year: 2024)
        #expect(month1.hashValue == month2.hashValue)
    }

    @Test func hashable_canBeUsedAsSetKey() {
        let month1 = MonthYear(month: 6, year: 2024)
        let month2 = MonthYear(month: 6, year: 2024)
        let month3 = MonthYear(month: 7, year: 2024)
        let set: Set<MonthYear> = [month1, month2, month3]
        #expect(set.count == 2)
    }

    @Test func hashable_canBeUsedAsDictionaryKey() {
        let january = MonthYear(month: 1, year: 2024)
        let february = MonthYear(month: 2, year: 2024)
        var budgetsByMonth: [MonthYear: String] = [:]
        budgetsByMonth[january] = "Budget January"
        budgetsByMonth[february] = "Budget February"
        #expect(budgetsByMonth[january] == "Budget January")
        #expect(budgetsByMonth[february] == "Budget February")
    }
}
