import Foundation
@testable import Pulpe
import Testing

struct BudgetIsCurrentPeriodTests {
    // MARK: - Budget.isCurrentPeriod

    @Test func isCurrentPeriod_nilPayDay_fallsBackToCalendarMonth() {
        let now = Date()
        let calendar = Calendar.current
        let budget = TestDataFactory.createBudget(
            month: calendar.component(.month, from: now),
            year: calendar.component(.year, from: now)
        )

        #expect(budget.isCurrentPeriod(payDayOfMonth: nil))
    }

    @Test func isCurrentPeriod_payDay1_fallsBackToCalendarMonth() {
        let now = Date()
        let calendar = Calendar.current
        let budget = TestDataFactory.createBudget(
            month: calendar.component(.month, from: now),
            year: calendar.component(.year, from: now)
        )

        #expect(budget.isCurrentPeriod(payDayOfMonth: 1))
    }

    @Test func isCurrentPeriod_withPayDay_usesCalculator() {
        // Use the calculator to find what the current period actually is
        let currentPeriod = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: 15)
        let budget = TestDataFactory.createBudget(
            month: currentPeriod.month,
            year: currentPeriod.year
        )

        #expect(budget.isCurrentPeriod(payDayOfMonth: 15))
    }

    @Test func isCurrentPeriod_differentMonth_returnsFalse() {
        let currentPeriod = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: 10)
        let otherMonth = currentPeriod.month == 12 ? 1 : currentPeriod.month + 1
        let budget = TestDataFactory.createBudget(month: otherMonth, year: currentPeriod.year)

        #expect(!budget.isCurrentPeriod(payDayOfMonth: 10))
    }

    @Test func isCurrentPeriod_differentYear_returnsFalse() {
        let budget = TestDataFactory.createBudget(month: 1, year: 2020)

        #expect(!budget.isCurrentPeriod(payDayOfMonth: 15))
    }

    // MARK: - BudgetSparse.isCurrentPeriod

    @Test func sparse_isCurrentPeriod_nilPayDay_usesCalendarMonth() {
        let now = Date()
        let calendar = Calendar.current
        let budget = TestDataFactory.createBudgetSparse(
            month: calendar.component(.month, from: now),
            year: calendar.component(.year, from: now)
        )

        #expect(budget.isCurrentPeriod(payDayOfMonth: nil))
    }

    @Test func sparse_isCurrentPeriod_withPayDay_usesCalculator() {
        let currentPeriod = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: 27)
        let budget = TestDataFactory.createBudgetSparse(
            month: currentPeriod.month,
            year: currentPeriod.year
        )

        #expect(budget.isCurrentPeriod(payDayOfMonth: 27))
    }

    @Test func sparse_isCurrentPeriod_nilMonth_returnsFalse() {
        let budget = TestDataFactory.createBudgetSparse(month: nil, year: 2025)

        #expect(!budget.isCurrentPeriod(payDayOfMonth: 15))
    }

    @Test func sparse_isCurrentPeriod_nilYear_returnsFalse() {
        let budget = TestDataFactory.createBudgetSparse(month: 1, year: nil)

        #expect(!budget.isCurrentPeriod(payDayOfMonth: 15))
    }

    @Test func sparse_isCurrentPeriod_differentPeriod_returnsFalse() {
        let budget = TestDataFactory.createBudgetSparse(month: 6, year: 2020)

        #expect(!budget.isCurrentPeriod(payDayOfMonth: 27))
    }
}
