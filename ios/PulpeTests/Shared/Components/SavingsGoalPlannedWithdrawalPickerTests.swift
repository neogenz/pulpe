import Foundation
@testable import Pulpe
import Testing

/// The preview a planned withdrawal is judged on (PUL-329 v2): the pot's expected
/// balance at the BUDGET's own month, not what it holds today — a retrait planned
/// for August is judged on August.
///
/// `@MainActor` because the arithmetic hangs off a SwiftUI `View`, which carries
/// that isolation: calling it from a background test thread traps in Swift 6.
@MainActor
struct SavingsGoalPlannedWithdrawalPickerTests {
    private func month(
        _ month: Int,
        _ year: Int,
        projected: Decimal?
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: year,
            state: .future,
            isLocked: false,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            projectedCumulative: projected,
            lines: []
        )
    }

    private func progress(
        confirmed: Decimal,
        months: [SavingsGoalPlanMonth]
    ) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: "goal-1",
            status: .active,
            targetAmount: nil,
            targetDate: nil,
            plannedCumulative: 0,
            confirmed: confirmed,
            achievementPercent: nil,
            monthsElapsed: 0,
            monthsRemaining: nil,
            isOverdue: false,
            pace: 0,
            confirmedPace: 0,
            required: nil,
            projected: nil,
            paceStatus: nil,
            suggestCompletion: nil,
            linkedLineCount: 1,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months
        )
    }

    /// The wireframe case: 3'600 expected in August, 500 announced → 3'100. The
    /// later months of the plan must not leak into the figure.
    @Test("Reads the projection of the budget's own month, not the plan's last")
    func projection_followsThePeriod() {
        let result = SavingsGoalPlannedWithdrawalPicker.projection(
            from: progress(confirmed: 1_000, months: [
                month(7, 2026, projected: 3_000),
                month(8, 2026, projected: 3_600),
                month(9, 2026, projected: 4_200),
            ]),
            at: BudgetPeriod(month: 8, year: 2026),
            withdrawing: 500
        )

        #expect(result.before == 3_600)
        #expect(result.after == 3_100)
        #expect(!result.isOverProjection)
    }

    /// A budget opened before the plan window, or a goal with no plan at all:
    /// the confirmed balance is the only honest figure left.
    @Test("Falls back to the confirmed balance when no month at or before the period qualifies")
    func projection_fallsBackToConfirmed() {
        let noEarlierMonth = SavingsGoalPlannedWithdrawalPicker.projection(
            from: progress(confirmed: 1_000, months: [month(9, 2026, projected: 4_200)]),
            at: BudgetPeriod(month: 8, year: 2026),
            withdrawing: 500
        )
        let noPeriod = SavingsGoalPlannedWithdrawalPicker.projection(
            from: progress(confirmed: 1_000, months: [month(8, 2026, projected: 3_600)]),
            at: nil,
            withdrawing: 500
        )

        #expect(noEarlierMonth.before == 1_000)
        #expect(noPeriod.before == 1_000)
    }

    /// A server that predates the field sends months without `projectedCumulative`;
    /// they are skipped rather than read as zero.
    @Test("Ignores months served without a projection")
    func projection_skipsMonthsWithoutAProjection() {
        let result = SavingsGoalPlannedWithdrawalPicker.projection(
            from: progress(confirmed: 1_000, months: [
                month(7, 2026, projected: 3_000),
                month(8, 2026, projected: nil),
            ]),
            at: BudgetPeriod(month: 8, year: 2026),
            withdrawing: 500
        )

        #expect(result.before == 3_000)
        #expect(result.after == 2_500)
    }

    /// The typed amount has no rate yet. Showing "3'600 → 3'600" would announce a
    /// retrait of zero, so the "après" is dropped and nothing is blocked.
    @Test("Hides the after-figure while the converted amount is missing")
    func projection_withoutAnAmount_hasNoAfter() {
        let result = SavingsGoalPlannedWithdrawalPicker.projection(
            from: progress(confirmed: 1_000, months: [month(8, 2026, projected: 3_600)]),
            at: BudgetPeriod(month: 8, year: 2026),
            withdrawing: nil
        )

        #expect(result.before == 3_600)
        #expect(result.after == nil)
        #expect(!result.isOverProjection)
    }

    /// The warning is an aid, not a gate, using the same cent difference as the
    /// server: a sub-cent residue is zero and one cent is still meaningful.
    @Test("Warns only when the cent-rounded projection is negative")
    func projection_overdraftUsesCentPrecision() {
        let plan = progress(confirmed: 0, months: [month(8, 2026, projected: 500)])
        let period = BudgetPeriod(month: 8, year: 2026)

        let over = SavingsGoalPlannedWithdrawalPicker.projection(
            from: plan, at: period, withdrawing: 800
        )
        let roundingHair = SavingsGoalPlannedWithdrawalPicker.projection(
            from: plan, at: period, withdrawing: Decimal(string: "500.001") ?? 0
        )
        let oneCentOver = SavingsGoalPlannedWithdrawalPicker.projection(
            from: plan, at: period, withdrawing: Decimal(string: "500.01") ?? 0
        )

        #expect(over.after == -300)
        #expect(over.isOverProjection)
        #expect(roundingHair.after == 0)
        #expect(!roundingHair.isOverProjection)
        #expect(oneCentOver.after == Decimal(string: "-0.01"))
        #expect(oneCentOver.isOverProjection)
    }
}
