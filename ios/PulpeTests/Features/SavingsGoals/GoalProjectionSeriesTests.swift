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

    @Test("planned projection starts on confirmed and ends on the API projection")
    func plannedProjectionAnchorsAndMatchesEndpoint() {
        let series = GoalProjectionSeries.read(from: makeProgress(currentIndex: 1))

        #expect(series.confirmed.last?.value == 85_000)
        #expect(series.projection.map(\.index) == [1, 2, 3])
        #expect(series.projection.map(\.value) == [85_000, 86_000, 86_500])
    }

    @Test("simulation projection keeps the confirmed anchor and draft endpoint")
    func simulationProjectionAnchorsAndMatchesEndpoint() throws {
        let progress = makeProgress(currentIndex: 1)
        let draft = try SavingsPlanCalculator.simulate(
            timeline: progress.months,
            targetAmount: progress.targetAmount,
            globalMonthlyAmount: 750,
            initialAmount: progress.initialAmount
        )

        let series = GoalProjectionSeries.simulation(
            from: draft,
            targetAmount: progress.targetAmount,
            confirmedAmount: progress.confirmed
        )

        #expect(series.projection.first?.value == 85_000)
        #expect(series.projection.last?.value == NSDecimalNumber(decimal: draft.simulatedFinal).doubleValue)
    }

    @Test("gap copy names the direction — lag, advance, on-plan (amount unsigned)")
    func gapCopyNamesDirection() {
        let lag = GoalTrajectorySection.gapCopy(for: 300, currency: .chf)
        let advance = GoalTrajectorySection.gapCopy(for: -150, currency: .chf)
        let onPlan = GoalTrajectorySection.gapCopy(for: 0, currency: .chf)
        let expectedLag = Decimal(300).asAdaptiveCurrency(.chf)
        let expectedAdvance = Decimal(150).asAdaptiveCurrency(.chf)

        #expect(lag.lead == "Il te manque")
        #expect(lag.amount == expectedLag)
        #expect(advance.lead == "Tu es en avance de")
        #expect(advance.amount == expectedAdvance)
        #expect(onPlan.lead == "Pile sur ton plan")
        #expect(onPlan.amount == nil)
    }

    @Test("gap copy keeps a meaningful cent without adding noise to whole amounts")
    func gapCopyUsesAdaptivePrecision() {
        #expect(
            GoalTrajectorySection.gapCopy(for: 0.01, currency: .chf).amount
                == Decimal(string: "0.01")?.asAdaptiveCurrency(.chf)
        )
        #expect(
            GoalTrajectorySection.gapCopy(for: 300, currency: .chf).amount
                == Decimal(300).asAdaptiveCurrency(.chf)
        )
    }

    @Test("a targetless series keeps its data without inventing a chart target")
    func targetlessSeries_hasNoTargetRuleValue() {
        let series = GoalProjectionSeries.read(from: makeProgress(currentIndex: 1, targetAmount: nil))

        #expect(series.target == nil)
        #expect(series.projection.count == 3)
        #expect(series.confirmed.count == 2)
    }

    private func makeProgress(
        currentIndex: Int,
        count: Int = 4,
        targetAmount: Decimal? = 2_000
    ) -> SavingsGoalProgress {
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
                confirmedCumulative: offset <= currentIndex ? 85_000 : 0,
                lines: []
            )
        }
        return SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: targetAmount,
            targetDate: "2099-04-01",
            plannedCumulative: 500,
            confirmed: 85_000,
            achievementPercent: 43,
            monthsElapsed: currentIndex + 1,
            monthsRemaining: count - currentIndex,
            isOverdue: false,
            pace: 500,
            confirmedPace: 0,
            required: 500,
            projected: 85_000 + Decimal(500 * (count - currentIndex)),
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
