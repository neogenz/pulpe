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
