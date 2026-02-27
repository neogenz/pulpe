import Foundation
@testable import Pulpe
import Testing

// MARK: - Helpers

private func makeDate(year: Int, month: Int, day: Int) -> Date {
    var components = DateComponents()
    components.year = year
    components.month = month
    components.day = day
    // swiftlint:disable:next force_unwrapping
    return Calendar.current.date(from: components)!
}

private func makeDate(year: Int, month: Int) -> Date {
    makeDate(year: year, month: month, day: 1)
}

// MARK: - periodForDate Tests

struct PeriodForDateStandardTests {
    @Test func nilPayDay_returnsCalendarMonth() {
        let date = makeDate(year: 2025, month: 1, day: 30)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: nil)
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }

    @Test func payDayOne_returnsCalendarMonth() {
        let date = makeDate(year: 2025, month: 1, day: 30)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 1)
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }

    @Test func payDayZero_returnsCalendarMonth() {
        let date = makeDate(year: 2025, month: 1, day: 15)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 0)
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }
}

struct PeriodForDatePremiereQuinzaineTests {
    // payDay = 5: Budget "Mars" covers 5 mars - 4 avril

    @Test func payDay5_afterPayDay_returnsCurrentMonth() {
        let date = makeDate(year: 2025, month: 3, day: 6)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 5)
        #expect(result == BudgetPeriod(month: 3, year: 2025))
    }

    @Test func payDay5_exactPayDay_returnsCurrentMonth() {
        let date = makeDate(year: 2025, month: 3, day: 5)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 5)
        #expect(result == BudgetPeriod(month: 3, year: 2025))
    }

    @Test func payDay5_beforePayDay_returnsPreviousMonth() {
        let date = makeDate(year: 2025, month: 3, day: 4)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 5)
        #expect(result == BudgetPeriod(month: 2, year: 2025))
    }

    @Test func payDay15_beforePayDay_returnsPreviousMonth() {
        let date = makeDate(year: 2025, month: 3, day: 1)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 15)
        #expect(result == BudgetPeriod(month: 2, year: 2025))
    }

    @Test func payDay15_afterPayDay_returnsCurrentMonth() {
        let date = makeDate(year: 2025, month: 3, day: 20)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 15)
        #expect(result == BudgetPeriod(month: 3, year: 2025))
    }

    @Test func payDay3_jan6_returnsJanuary() {
        let date = makeDate(year: 2025, month: 1, day: 6)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 3)
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }

    @Test func payDay3_jan2_returnsDecemberPreviousYear() {
        let date = makeDate(year: 2025, month: 1, day: 2)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 3)
        #expect(result == BudgetPeriod(month: 12, year: 2024))
    }
}

struct PeriodForDateDeuxiemeQuinzaineTests {
    // payDay = 27: Budget "Mars" covers 27 fev - 26 mars

    @Test func payDay27_afterPayDay_returnsNextMonth() {
        let date = makeDate(year: 2025, month: 1, day: 28)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 28 >= 27 -> jan, +1 (quinzaine) -> fev
        #expect(result == BudgetPeriod(month: 2, year: 2025))
    }

    @Test func payDay27_exactPayDay_returnsNextMonth() {
        let date = makeDate(year: 2025, month: 1, day: 27)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 27 >= 27 -> jan, +1 -> fev
        #expect(result == BudgetPeriod(month: 2, year: 2025))
    }

    @Test func payDay27_beforePayDay_returnsCurrentMonth() {
        let date = makeDate(year: 2025, month: 1, day: 26)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 26 < 27 -> dec, +1 (quinzaine) -> jan
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }

    @Test func payDay27_march1_returnsMarch() {
        let date = makeDate(year: 2025, month: 3, day: 1)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 1 < 27 -> feb, +1 -> march
        #expect(result == BudgetPeriod(month: 3, year: 2025))
    }

    @Test func payDay27_march26_returnsMarch() {
        let date = makeDate(year: 2025, month: 3, day: 26)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 26 < 27 -> feb, +1 -> march
        #expect(result == BudgetPeriod(month: 3, year: 2025))
    }

    @Test func payDay27_march27_returnsApril() {
        let date = makeDate(year: 2025, month: 3, day: 27)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 27 >= 27 -> march, +1 -> april
        #expect(result == BudgetPeriod(month: 4, year: 2025))
    }

    @Test func payDay20_march19_returnsMarch() {
        let date = makeDate(year: 2025, month: 3, day: 19)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 20)
        // 19 < 20 -> feb, +1 -> march
        #expect(result == BudgetPeriod(month: 3, year: 2025))
    }

    @Test func payDay20_march20_returnsApril() {
        let date = makeDate(year: 2025, month: 3, day: 20)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 20)
        // 20 >= 20 -> march, +1 -> april
        #expect(result == BudgetPeriod(month: 4, year: 2025))
    }
}

struct PeriodForDateYearBoundaryTests {
    @Test func payDay27_dec28_returnsJanuaryNextYear() {
        let date = makeDate(year: 2024, month: 12, day: 28)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 28 >= 27 -> dec, +1 (quinzaine, dec->jan) -> jan 2025
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }

    @Test func payDay27_dec26_returnsDecember() {
        let date = makeDate(year: 2024, month: 12, day: 26)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 26 < 27 -> nov, +1 -> dec
        #expect(result == BudgetPeriod(month: 12, year: 2024))
    }

    @Test func payDay27_jan5_returnsJanuary() {
        let date = makeDate(year: 2025, month: 1, day: 5)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 27)
        // 5 < 27 -> dec 2024, +1 -> jan 2025
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }

    @Test func payDay5_dec6_returnsDecember() {
        let date = makeDate(year: 2024, month: 12, day: 6)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 5)
        // 6 >= 5 -> december
        #expect(result == BudgetPeriod(month: 12, year: 2024))
    }

    @Test func payDay5_dec4_returnsNovember() {
        let date = makeDate(year: 2024, month: 12, day: 4)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 5)
        // 4 < 5 -> november
        #expect(result == BudgetPeriod(month: 11, year: 2024))
    }

    @Test func payDay5_jan4_returnsDecemberPreviousYear() {
        let date = makeDate(year: 2025, month: 1, day: 4)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 5)
        // 4 < 5 -> dec 2024
        #expect(result == BudgetPeriod(month: 12, year: 2024))
    }
}

struct PeriodForDateEdgeCaseTests {
    @Test func clampsPayDayAbove31() {
        let date = makeDate(year: 2025, month: 1, day: 30)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 50)
        // clamped to 31, 30 < 31 -> dec, +1 (quinzaine) -> jan
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }

    @Test func floorsDecimalPayDay() {
        let date = makeDate(year: 2025, month: 1, day: 15)
        let result = BudgetPeriodCalculator.periodForDate(date, payDayOfMonth: 14)
        // floor(14.7) = 14 in TS, but Swift Int truncates already
        // 15 >= 14, payDay <= 15 -> january
        #expect(result == BudgetPeriod(month: 1, year: 2025))
    }
}

// MARK: - periodDates Tests

struct PeriodDatesCalendarTests {
    @Test func payDay1_marchReturnsFullMonth() {
        let result = BudgetPeriodCalculator.periodDates(month: 3, year: 2026, payDayOfMonth: 1)
        #expect(result.startDate == makeDate(year: 2026, month: 3, day: 1))
        #expect(result.endDate == makeDate(year: 2026, month: 3, day: 31))
    }

    @Test func payDay1_february_nonLeapYear() {
        let result = BudgetPeriodCalculator.periodDates(month: 2, year: 2026, payDayOfMonth: 1)
        #expect(result.startDate == makeDate(year: 2026, month: 2, day: 1))
        #expect(result.endDate == makeDate(year: 2026, month: 2, day: 28))
    }

    @Test func payDay1_february_leapYear() {
        let result = BudgetPeriodCalculator.periodDates(month: 2, year: 2024, payDayOfMonth: 1)
        #expect(result.startDate == makeDate(year: 2024, month: 2, day: 1))
        #expect(result.endDate == makeDate(year: 2024, month: 2, day: 29))
    }
}

struct PeriodDatesPremiereQuinzaineTests {
    @Test func payDay5_marchStartsMarch5() {
        let result = BudgetPeriodCalculator.periodDates(month: 3, year: 2026, payDayOfMonth: 5)
        #expect(result.startDate == makeDate(year: 2026, month: 3, day: 5))
        #expect(result.endDate == makeDate(year: 2026, month: 4, day: 4))
    }

    @Test func payDay15_marchStartsMarch15() {
        let result = BudgetPeriodCalculator.periodDates(month: 3, year: 2026, payDayOfMonth: 15)
        #expect(result.startDate == makeDate(year: 2026, month: 3, day: 15))
        #expect(result.endDate == makeDate(year: 2026, month: 4, day: 14))
    }

    @Test func payDay5_januaryStartsJan5() {
        let result = BudgetPeriodCalculator.periodDates(month: 1, year: 2026, payDayOfMonth: 5)
        #expect(result.startDate == makeDate(year: 2026, month: 1, day: 5))
        #expect(result.endDate == makeDate(year: 2026, month: 2, day: 4))
    }

    @Test func payDay5_decemberCrossesYear() {
        let result = BudgetPeriodCalculator.periodDates(month: 12, year: 2025, payDayOfMonth: 5)
        #expect(result.startDate == makeDate(year: 2025, month: 12, day: 5))
        #expect(result.endDate == makeDate(year: 2026, month: 1, day: 4))
    }
}

struct PeriodDatesDeuxiemeQuinzaineTests {
    @Test func payDay27_marchStartsFeb27() {
        let result = BudgetPeriodCalculator.periodDates(month: 3, year: 2026, payDayOfMonth: 27)
        #expect(result.startDate == makeDate(year: 2026, month: 2, day: 27))
        #expect(result.endDate == makeDate(year: 2026, month: 3, day: 26))
    }

    @Test func payDay20_marchStartsFeb20() {
        let result = BudgetPeriodCalculator.periodDates(month: 3, year: 2026, payDayOfMonth: 20)
        #expect(result.startDate == makeDate(year: 2026, month: 2, day: 20))
        #expect(result.endDate == makeDate(year: 2026, month: 3, day: 19))
    }

    @Test func payDay27_januaryCrossesPreviousYear() {
        let result = BudgetPeriodCalculator.periodDates(month: 1, year: 2026, payDayOfMonth: 27)
        #expect(result.startDate == makeDate(year: 2025, month: 12, day: 27))
        #expect(result.endDate == makeDate(year: 2026, month: 1, day: 26))
    }
}

struct PeriodDatesEdgeCaseTests {
    @Test func payDay30_marchClampsToFeb28() {
        // February 2026 has 28 days, payDay 30 clamps to 28
        let result = BudgetPeriodCalculator.periodDates(month: 3, year: 2026, payDayOfMonth: 30)
        #expect(result.startDate == makeDate(year: 2026, month: 2, day: 28))
        #expect(result.endDate == makeDate(year: 2026, month: 3, day: 29))
    }

    @Test func nilPayDay_returnsCalendarMonth() {
        let result = BudgetPeriodCalculator.periodDates(month: 3, year: 2026, payDayOfMonth: nil)
        #expect(result.startDate == makeDate(year: 2026, month: 3, day: 1))
        #expect(result.endDate == makeDate(year: 2026, month: 3, day: 31))
    }
}

// MARK: - formatPeriod Tests

struct FormatPeriodTests {
    @Test func nilPayDay_returnsNil() {
        let result = BudgetPeriodCalculator.formatPeriod(month: 3, year: 2026, payDayOfMonth: nil)
        #expect(result == nil)
    }

    @Test func payDayOne_returnsNil() {
        let result = BudgetPeriodCalculator.formatPeriod(month: 3, year: 2026, payDayOfMonth: 1)
        #expect(result == nil)
    }

    @Test func payDay5_containsSeparator() {
        let result = BudgetPeriodCalculator.formatPeriod(month: 3, year: 2026, payDayOfMonth: 5)
        #expect(result?.contains(" - ") == true)
    }

    @Test func payDay27_containsExpectedMonths() {
        let result = BudgetPeriodCalculator.formatPeriod(month: 3, year: 2026, payDayOfMonth: 27)
        // Should contain "27" and "26" (start day and end day)
        #expect(result?.contains("27") == true)
        #expect(result?.contains("26") == true)
    }
}

// MARK: - comparePeriods Tests

struct ComparePeriodsTests {
    @Test func equalPeriods_returnsZero() {
        let lhs = BudgetPeriod(month: 3, year: 2025)
        let rhs = BudgetPeriod(month: 3, year: 2025)
        #expect(BudgetPeriodCalculator.comparePeriods(lhs, rhs) == 0)
    }

    @Test func earlierMonth_returnsNegative() {
        let lhs = BudgetPeriod(month: 1, year: 2025)
        let rhs = BudgetPeriod(month: 3, year: 2025)
        #expect(BudgetPeriodCalculator.comparePeriods(lhs, rhs) == -1)
    }

    @Test func laterMonth_returnsPositive() {
        let lhs = BudgetPeriod(month: 6, year: 2025)
        let rhs = BudgetPeriod(month: 3, year: 2025)
        #expect(BudgetPeriodCalculator.comparePeriods(lhs, rhs) == 1)
    }

    @Test func earlierYear_returnsNegative() {
        let lhs = BudgetPeriod(month: 12, year: 2024)
        let rhs = BudgetPeriod(month: 1, year: 2025)
        #expect(BudgetPeriodCalculator.comparePeriods(lhs, rhs) == -1)
    }

    @Test func laterYear_returnsPositive() {
        let lhs = BudgetPeriod(month: 1, year: 2026)
        let rhs = BudgetPeriod(month: 12, year: 2025)
        #expect(BudgetPeriodCalculator.comparePeriods(lhs, rhs) == 1)
    }
}
