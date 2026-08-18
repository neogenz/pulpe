import Foundation
@testable import Pulpe
import Testing

/// Reads of the plan timeline that the hero gates its day-1 copy on. They live
/// on the model, not on the detail ViewModel: they are pure functions of
/// `months`, like `displayedProjection`, and the presentation struct has no
/// business reaching into a ViewModel to ask them.
struct SavingsGoalProgressTests {
    private func makePlanMonth(
        month: Int,
        state: SavingsPlanMonthState,
        isLocked: Bool,
        planned: Decimal = 200,
        isContributionEligible: Bool = true
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2099,
            state: state,
            isLocked: isLocked,
            isContributionEligible: isContributionEligible,
            plannedAmount: planned,
            confirmedAmount: 0,
            plannedCumulative: planned,
            confirmedCumulative: 0,
            lines: []
        )
    }

    private func makeProgress(months: [SavingsGoalPlanMonth]) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: 3_000,
            targetDate: "2099-12-14",
            plannedCumulative: 0,
            confirmed: 0,
            achievementPercent: 0,
            monthsElapsed: 0,
            monthsRemaining: 6,
            isOverdue: false,
            pace: 0,
            confirmedPace: 0,
            required: nil,
            projected: nil,
            paceStatus: nil,
            suggestCompletion: false,
            linkedLineCount: 1,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months
        )
    }

    // MARK: - Day-1 verdict gate (no reproach at commitment time)

    @Test("day 1 — no plan month closed yet: the pace verdict stays hidden")
    func hasClosedPlanMonth_day1_isFalse() {
        let progress = makeProgress(months: [
            makePlanMonth(month: 7, state: .current, isLocked: false),
            makePlanMonth(month: 8, state: .future, isLocked: false),
        ])

        #expect(progress.hasClosedPlanMonth == false)
    }

    @Test("one closed month behind: the pace verdict comes back")
    func hasClosedPlanMonth_lockedMonthBehind_isTrue() {
        let progress = makeProgress(months: [
            makePlanMonth(month: 6, state: .past, isLocked: true),
            makePlanMonth(month: 7, state: .current, isLocked: false),
        ])

        #expect(progress.hasClosedPlanMonth == true)
    }

    @Test("a locked pre-start row does not trigger a pace verdict")
    func hasClosedPlanMonth_preStartRowIsIgnored() {
        let progress = makeProgress(months: [
            makePlanMonth(month: 6, state: .past, isLocked: true, isContributionEligible: false),
        ])

        #expect(progress.hasClosedPlanMonth == false)
    }

    @Test("empty timeline (legacy payload): no verdict, and no beat amount either")
    func emptyTimeline_hidesVerdictAndBeat() {
        let progress = makeProgress(months: [])

        #expect(progress.hasClosedPlanMonth == false)
        #expect(progress.currentMonthPlannedAmount == nil)
    }

    @Test("the day-1 beat carries the current month's planned amount")
    func currentMonthPlannedAmount_readsCurrentMonth() {
        let progress = makeProgress(months: [
            makePlanMonth(month: 7, state: .current, isLocked: false, planned: 250),
            makePlanMonth(month: 8, state: .future, isLocked: false, planned: 300),
        ])

        #expect(progress.currentMonthPlannedAmount == 250)
    }

    @Test("a gap current month funds no beat")
    func currentMonthPlannedAmount_gapMonthIsNil() {
        let progress = makeProgress(months: [
            makePlanMonth(month: 7, state: .current, isLocked: false, planned: 0),
        ])

        #expect(progress.currentMonthPlannedAmount == nil)
    }
}
