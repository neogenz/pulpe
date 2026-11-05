import Foundation
@testable import Pulpe
import Testing

/// Pure presentation rules of the V2 goal sheets: simulator shortcuts, recap rows, the pause
/// sheet grouping and the form's months-without-budget note.
@MainActor
struct GoalSheetsPresentationTests {
    private func month(_ month: Int, _ year: Int, planned: Decimal = 0) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: year,
            state: .gap,
            isLocked: false,
            hasBudget: false,
            isProvisionable: true,
            plannedAmount: planned,
            confirmedAmount: 0,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: []
        )
    }

    private func change(
        _ month: Int, _ year: Int, amount: Decimal, cumulative: Decimal
    ) -> SavingsPlanCalculator.SimulatedMonth {
        .init(
            month: self.month(month, year),
            simulatedAmount: amount,
            simulatedCumulative: cumulative,
            isAdjusted: true,
            replacesExistingPlanWithdrawal: false
        )
    }

    @Test("simulator shortcuts start at the required pace, then round up to the hundred")
    func quickAmounts() {
        #expect(GoalPlanSimulatorSheet.quickAmounts(required: 400) == [400, 500, 700])
        #expect(GoalPlanSimulatorSheet.quickAmounts(required: nil).isEmpty)
        #expect(GoalPlanSimulatorSheet.quickAmounts(required: 0).isEmpty)
    }

    @Test("recap rows show the year on the first row and when it changes")
    func recapRowTitles() {
        let changes = [
            change(12, 2026, amount: 500, cumulative: 3700),
            change(1, 2027, amount: 500, cumulative: 4200),
            change(2, 2027, amount: 500, cumulative: 4700),
        ]
        #expect(GoalPlanApplyRecapSheet.rowTitle(for: 0, in: changes).hasSuffix("2026"))
        #expect(GoalPlanApplyRecapSheet.rowTitle(for: 1, in: changes).hasSuffix("2027"))
        #expect(!GoalPlanApplyRecapSheet.rowTitle(for: 2, in: changes).contains("2027"))
    }

    @Test("recap marks the month that crosses the target and totals the last row")
    func recapRowCaptions() {
        let changes = [
            change(12, 2026, amount: 500, cumulative: 5700),
            change(1, 2027, amount: 500, cumulative: 6200),
            change(2, 2027, amount: 500, cumulative: 6700),
        ]
        let caption = { GoalPlanApplyRecapSheet.rowCaption(for: $0, in: changes, targetAmount: 6000, currency: .chf) }
        #expect(caption(0) == nil)
        #expect(caption(1) != nil)
        #expect(caption(2)?.contains("6") == true)
    }

    @Test("pause sheet keeps the first month alone, then groups the rest by year")
    func pauseGrouping() {
        let lines = [12, 1, 2, 3, 4, 5, 6].enumerated().map { index, month in
            SavingsGoalFutureLine(budgetLineId: "l\(index)", amount: 500, month: month, year: month == 12 ? 2026 : 2027)
        }
        let groups = GoalGenerationStopSheet.groupedLines(lines.reversed(), currency: .chf)
        #expect(groups.count == 2)
        #expect(groups[0].total == 500)
        #expect(groups[0].detail == nil)
        #expect(groups[1].total == 3000)
        #expect(groups[1].detail != nil)
        #expect(GoalGenerationStopSheet.groupedLines([], currency: .chf).isEmpty)
    }

    @Test("form note lists only the months up to the deadline that have no budget")
    func monthsWithoutBudgetNote() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "UTC"))
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 5)))
        let deadline = try #require(calendar.date(from: DateComponents(year: 2027, month: 6, day: 30)))
        let budgets = (1...12).map { offset in
            let date = calendar.date(byAdding: .month, value: offset, to: now) ?? now
            let parts = calendar.dateComponents([.month, .year], from: date)
            return BudgetSparse(
                id: "b\(offset)", month: parts.month, year: parts.year, totalExpenses: nil,
                totalSavings: nil, totalIncome: nil, remaining: 0, rollover: nil
            )
        }
        #expect(SavingsGoalFormSheet.monthsWithoutBudgetNote(
            until: deadline, budgets: [], now: now, calendar: calendar
        ) != nil)
        #expect(SavingsGoalFormSheet.monthsWithoutBudgetNote(
            until: deadline, budgets: budgets, now: now, calendar: calendar
        ) == nil)
    }
}
