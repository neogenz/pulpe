import Foundation
@testable import Pulpe
import Testing

@Suite("GoalProjectionSeries Tests")
struct GoalProjectionSeriesTests {
    @Test("drops the start tick when it would collide with the current month")
    func dropsCrowdedStartTick() {
        let ticks = GoalProjectionSeries.ticks(for: makeMonths(count: 20), currentIndex: 2)

        #expect(ticks.map(\.index) == [2, 19])
    }

    @Test("keeps start, current, and end ticks when they are sufficiently spaced")
    func keepsSpacedTicks() {
        let ticks = GoalProjectionSeries.ticks(for: makeMonths(count: 20), currentIndex: 8)

        #expect(ticks.map(\.index) == [0, 8, 19])
    }

    @Test("day 1 — current month first: a single confirmed point is no trend, chart hidden")
    func hasConfirmedTrend_day1_isFalse() {
        let series = GoalProjectionSeries.read(from: makeProgress(currentIndex: 0))

        #expect(series.confirmed.count == 1)
        #expect(series.hasConfirmedTrend == false)
    }

    @Test("one elapsed month + the current: the confirmed line exists, chart shown")
    func hasConfirmedTrend_elapsedMonthBehind_isTrue() {
        let series = GoalProjectionSeries.read(from: makeProgress(currentIndex: 1))

        #expect(series.hasConfirmedTrend == true)
    }

    private func makeProgress(currentIndex: Int, count: Int = 4) -> SavingsGoalProgress {
        let months: [SavingsGoalPlanMonth] = (0..<count).map { offset in
            let state: SavingsPlanMonthState
            if offset < currentIndex {
                state = .past
            } else if offset == currentIndex {
                state = .current
            } else {
                state = .future
            }
            return SavingsGoalPlanMonth(
                month: offset + 1,
                year: 2099,
                state: state,
                isLocked: offset < currentIndex,
                plannedAmount: 500,
                confirmedAmount: 0,
                plannedCumulative: Decimal(500 * (offset + 1)),
                confirmedCumulative: 0,
                lines: []
            )
        }
        return SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: 2_000,
            targetDate: "2099-04-01",
            plannedCumulative: 500,
            confirmed: 0,
            achievementPercent: 0,
            monthsElapsed: currentIndex + 1,
            monthsRemaining: count - currentIndex,
            isOverdue: false,
            pace: 500,
            confirmedPace: 0,
            required: 500,
            projected: 0,
            paceStatus: .behind,
            suggestCompletion: false,
            linkedLineCount: 1,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months
        )
    }

    private func makeMonths(count: Int) -> [SavingsGoalPlanMonth] {
        (0..<count).map { offset in
            let monthIndex = 4 + offset
            let year = 2026 + (monthIndex - 1) / 12
            let month = (monthIndex - 1) % 12 + 1
            return SavingsGoalPlanMonth(
                month: month,
                year: year,
                state: offset == 2 ? .current : .future,
                isLocked: false,
                plannedAmount: 500,
                confirmedAmount: 0,
                plannedCumulative: 500,
                confirmedCumulative: 0,
                lines: []
            )
        }
    }
}
