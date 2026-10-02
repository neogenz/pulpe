import Foundation
@testable import Pulpe
import Testing

struct TemplateUsageDataTests {
    @Test func propagationCount_beforeFirstQuinzainePayday_includesActiveBudget() throws {
        let now = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 8, day: 4, hour: 12)))
        let usage = makeUsage([BudgetPeriod(month: 7, year: 2026)])

        #expect(usage.propagationBudgetCount(payDayOfMonth: 5, now: now) == 1)
    }

    @Test(arguments: [
        (DateComponents(year: 2026, month: 8, day: 4), 5, BudgetPeriod(month: 7, year: 2026)),
        (DateComponents(year: 2026, month: 8, day: 5), 5, BudgetPeriod(month: 8, year: 2026)),
        (DateComponents(year: 2026, month: 8, day: 14), 15, BudgetPeriod(month: 7, year: 2026)),
        (DateComponents(year: 2026, month: 8, day: 15), 15, BudgetPeriod(month: 8, year: 2026)),
        (DateComponents(year: 2026, month: 8, day: 15), 16, BudgetPeriod(month: 8, year: 2026)),
        (DateComponents(year: 2026, month: 8, day: 16), 16, BudgetPeriod(month: 9, year: 2026)),
        (DateComponents(year: 2026, month: 8, day: 24), 25, BudgetPeriod(month: 8, year: 2026)),
        (DateComponents(year: 2026, month: 8, day: 25), 25, BudgetPeriod(month: 9, year: 2026)),
        (DateComponents(year: 2027, month: 1, day: 4), 5, BudgetPeriod(month: 12, year: 2026)),
        (DateComponents(year: 2026, month: 12, day: 25), 25, BudgetPeriod(month: 1, year: 2027))
    ])
    func propagationCount_paydayBoundaries_countsCurrentAndFutureOnly(
        components: DateComponents, payDayOfMonth: Int, current: BudgetPeriod
    ) throws {
        let now = try #require(Calendar.current.date(from: components))
        let index = BudgetPeriodCalculator.periodIndex(current)
        let usage = makeUsage((-1...1).map { BudgetPeriodCalculator.periodFromIndex(index + $0) })

        #expect(usage.propagationBudgetCount(payDayOfMonth: payDayOfMonth, now: now) == 2)
    }

    @Test(arguments: [nil, 0, 1] as [Int?])
    func propagationCount_calendarPayday_countsCurrentAndFutureOnly(payDayOfMonth: Int?) throws {
        let now = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 8, day: 4)))
        let usage = makeUsage([7, 8, 9].map { BudgetPeriod(month: $0, year: 2026) })

        #expect(usage.propagationBudgetCount(payDayOfMonth: payDayOfMonth, now: now) == 2)
    }

    @Test func propagationCount_noEligibleBudgets_returnsZero() throws {
        let now = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 8, day: 25)))
        let pastOnly = makeUsage([BudgetPeriod(month: 8, year: 2026)])

        #expect(pastOnly.propagationBudgetCount(payDayOfMonth: 25, now: now) == 0)
        #expect(makeUsage([]).propagationBudgetCount(payDayOfMonth: 25, now: now) == 0)
    }

    private func makeUsage(_ periods: [BudgetPeriod]) -> TemplateUsageData {
        let budgets = periods.map {
            TemplateUsageBudget(id: "\($0.year)-\($0.month)", month: $0.month, year: $0.year, description: "Budget")
        }
        return TemplateUsageData(isUsed: !budgets.isEmpty, budgetCount: budgets.count, budgets: budgets)
    }
}
