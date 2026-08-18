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

    /// The deadline is the only landmark the drawing owes the reader: whatever the
    /// horizon, the last month must always earn a tick.
    @Test("the deadline month always carries a tick", arguments: [2, 3, 24])
    func alwaysTicksTheDeadlineMonth(monthCount: Int) {
        let ticks = GoalProjectionSeries.ticks(for: makeMonths(count: monthCount), currentIndex: 1)

        #expect(ticks.last?.index == monthCount - 1)
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

        #expect(lag.lead == "En retard sur ton plan")
        #expect(lag.amount == expectedLag)
        #expect(advance.lead == "En avance sur ton plan")
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

    /// The bug this pins: the curve used to be a running sum of contributions, so a
    /// month that announced a retrait kept climbing and only the final point — which
    /// the API owns — came back down. The dip has to be drawn where it happens.
    @Test("a planned withdrawal digs into the projection on its own month")
    func plannedWithdrawal_digsIntoTheProjectedCurve() {
        let series = GoalProjectionSeries.read(from: makeProgressWithWithdrawal())

        #expect(series.projection.map(\.index) == [1, 2, 3])
        #expect(series.projection.map(\.value) == [85_000, 83_500, 84_000])
    }

    /// Same contract in the simulator, against the calculator instead of the API:
    /// `simulatedCumulative` already nets the retraits out, and it is the very figure
    /// each editable row prints — the curve must not derive a second one.
    /// 500 confirmés, puis +500/mois avec un retrait de 1 500 sur le troisième mois :
    /// 500 → 0 → 500. En sommant les seules contributions on lisait 500 → 1 500 → 500.
    @Test("simulation projection follows the calculator down through a retrait")
    func simulationProjection_followsTheCalculatorThroughAWithdrawal() throws {
        let draft = try SavingsPlanCalculator.simulate(
            timeline: makeSimulatableTimeline(withdrawalOnThirdMonth: 1_500),
            targetAmount: 2_000,
            globalMonthlyAmount: 500
        )

        let series = GoalProjectionSeries.simulation(
            from: draft,
            targetAmount: 2_000,
            confirmedAmount: 500
        )

        #expect(draft.months.map(\.simulatedCumulative) == [500, 1_000, 0, 500])
        #expect(series.projection.map(\.value) == [500, 0, 500])
    }

    /// Sans montant cible le serveur ne calcule plus `projected`, et le repli
    /// `plannedProjection` n'est pas un solde : il ignore les retraits par
    /// construction (`savings-goal-progress.ts`). Le lui donner comme point final
    /// faisait plonger la courbe au mois du retrait puis remonter au dernier mois
    /// sans qu'un franc bouge. Ici 87 000 bruts contre 84 000 nets.
    @Test("a targetless goal closes its curve on the net balance, not the gross plan")
    func targetlessProjection_closesOnTheNetBalance() {
        let series = GoalProjectionSeries.read(
            from: makeProgressWithWithdrawal(
                targetAmount: nil,
                projected: nil,
                plannedProjection: 87_000
            )
        )

        #expect(series.projection.map(\.value) == [85_000, 83_500, 84_000])
    }

    @Test("a targetless series keeps its data without inventing a chart target")
    func targetlessSeries_hasNoTargetRuleValue() {
        let series = GoalProjectionSeries.read(from: makeProgress(currentIndex: 1, targetAmount: nil))

        #expect(series.target == nil)
        #expect(series.projection.count == 3)
        #expect(series.confirmed.count == 2)
    }

    // MARK: - Vertical domain

    private func makeSeries(values: [Double], target: Double?) -> GoalProjectionSeries {
        GoalProjectionSeries(
            confirmed: values.enumerated().map { .init(index: $0.offset, value: $0.element) },
            projection: [],
            target: target,
            ticks: []
        )
    }

    @Test("a positive curve keeps the axis on zero — épargne reads from nothing")
    func valueDomain_floorsOnZero() {
        let domain = makeSeries(values: [400, 1_200], target: 3_000).valueDomain

        #expect(domain.lowerBound == 0)
        #expect(domain.upperBound == 3_240)
    }

    /// Le serveur ne clampe jamais un solde à 0 : un négatif signale une
    /// incohérence à diagnostiquer. Un plancher figé à 0 l'écrasait contre l'axe,
    /// où il se lisait « zéro » — exactement ce que le négatif est là pour dire.
    @Test("a negative balance digs below the axis instead of flattening on it")
    func valueDomain_digsForANegativeBalance() {
        let domain = makeSeries(values: [200, -500], target: 3_000).valueDomain

        #expect(domain.lowerBound == -780)
        #expect(domain.upperBound == 3_280)
    }

    @Test("an empty series still spans a positive range — Charts crashes on a flat domain")
    func valueDomain_neverCollapses() {
        let domain = makeSeries(values: [], target: nil).valueDomain

        #expect(domain.lowerBound < domain.upperBound)
    }

    /// Un mois passé pointé à 500, puis trois mois ouverts (`isProvisionable`, sans
    /// quoi `isContributivePlanMonth` les écarterait de la simulation), le troisième
    /// portant un retrait annoncé côté budget — pas piloté par le plan, sinon le
    /// montant global le REMPLACE au lieu de s'y ajouter et rien n'est retranché.
    private func makeSimulatableTimeline(withdrawalOnThirdMonth: Decimal) -> [SavingsGoalPlanMonth] {
        (0..<4).map { offset in
            let withdrawal: Decimal = offset == 2 ? withdrawalOnThirdMonth : 0
            return SavingsGoalPlanMonth(
                month: offset + 1,
                year: 2099,
                state: offset == 0 ? .past : (offset == 1 ? .current : .future),
                isLocked: offset == 0,
                isProvisionable: offset > 0,
                plannedAmount: 500,
                confirmedAmount: offset == 0 ? 500 : 0,
                remainingPlannedWithdrawalAmount: withdrawal,
                plannedCumulative: Decimal(500 * (offset + 1)),
                confirmedCumulative: 500,
                lines: []
            )
        }
    }

    /// Four months, the current one at index 1, and a 2 000 retrait announced on
    /// index 2 — so the server's own `projectedCumulative` falls before it climbs
    /// back: 85 000 → 83 500 → 84 000.
    private func makeProgressWithWithdrawal(
        targetAmount: Decimal? = 2_000,
        projected: Decimal? = 84_000,
        plannedProjection: Decimal? = nil
    ) -> SavingsGoalProgress {
        let months: [SavingsGoalPlanMonth] = (0..<4).map { offset in
            let withdrawal: Decimal = offset == 2 ? 2_000 : 0
            let cumulative: Decimal = switch offset {
            case 2: 83_500
            case 3: 84_000
            default: 85_000
            }
            return SavingsGoalPlanMonth(
                month: offset + 1,
                year: 2099,
                state: offset < 1 ? .past : (offset == 1 ? .current : .future),
                isLocked: offset < 1,
                plannedAmount: 500,
                confirmedAmount: 0,
                plannedWithdrawalAmount: withdrawal,
                remainingPlannedWithdrawalAmount: withdrawal,
                planLinkedWithdrawalAmount: withdrawal,
                plannedCumulative: Decimal(500 * (offset + 1)),
                confirmedCumulative: offset <= 1 ? 85_000 : 0,
                projectedCumulative: cumulative,
                lines: []
            )
        }
        return SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: targetAmount,
            targetDate: "2099-04-01",
            plannedCumulative: 500,
            plannedProjection: plannedProjection,
            confirmed: 85_000,
            achievementPercent: 43,
            monthsElapsed: 2,
            monthsRemaining: 3,
            isOverdue: false,
            pace: 500,
            confirmedPace: 0,
            required: 500,
            projected: projected,
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
