import Foundation
@testable import Pulpe
import Testing

/// PUL-329 — retrait cases for `simulate` and `redistributeRemainingEffort`,
/// mirrors `savings-goal-plan.spec.ts`. Split from `SavingsPlanCalculatorTests`
/// (own fixture copy) to keep both suites under the file length ceiling.
@Suite("SavingsPlanCalculator.withdrawals")
struct SavingsPlanCalculatorWithdrawalTests {
    /// Mirrors the TS `planMonth` factory: a single unchecked line worth
    /// `plannedAmount`.
    private func planMonth(
        month: Int,
        year: Int,
        state: SavingsPlanMonthState = .future,
        isLocked: Bool = false,
        isContributionEligible: Bool = true,
        plannedAmount: Decimal = 500,
        confirmedAmount: Decimal = 0,
        withdrawnAmount: Decimal = 0
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: year,
            state: state,
            isLocked: isLocked,
            isContributionEligible: isContributionEligible,
            isProvisionable: false,
            plannedAmount: plannedAmount,
            confirmedAmount: confirmedAmount,
            withdrawnAmount: withdrawnAmount,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: [
                SavingsGoalPlanLine(
                    budgetLineId: "\(year)-\(month)",
                    amount: plannedAmount,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ]
        )
    }

    /// Mirrors the TS spec: redistributing then simulating must land back on the
    /// target even when the retrait sits on an OPEN month. A withdrawal sum
    /// filtered on `isLocked` passes every other case and fails only this one.
    @Test("closes on the target when the withdrawal sits on an open month")
    func withdrawal_redistributionClosesOnTarget() throws {
        let timeline = [
            planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 2, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 3, year: 2026, state: .current, withdrawnAmount: 400),
            planMonth(month: 4, year: 2026, state: .future),
        ]

        let redistribution = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline,
            targetAmount: 3000
        )
        let result = try SavingsPlanCalculator.simulate(
            timeline: timeline,
            targetAmount: 3000,
            adjustments: redistribution.adjustments
        )

        #expect(redistribution.isDistributable == true)
        #expect(redistribution.remainingEffort == 2400)
        #expect(result.simulatedFinal == 3000)
    }

    /// Subtracting mid-loop is the first thing that can make the simulated curve
    /// go DOWN: the target can be crossed and then lost again.
    @Test("drops the attained period when a later withdrawal reopens the gap")
    func withdrawal_dropsStaleAttainedPeriod() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: [
                planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 600),
                planMonth(month: 2, year: 2026, state: .past, isLocked: true, confirmedAmount: 600),
                planMonth(
                    month: 3, year: 2026, state: .past, isLocked: true,
                    confirmedAmount: 0, withdrawnAmount: 400
                ),
            ],
            targetAmount: 1000
        )

        #expect(result.simulatedFinal == 800)
        #expect(result.isTargetMet == false)
        #expect(result.attainedPeriod == nil)
    }

    /// A retrait is a stock outflow, so it counts on a month that is closed to
    /// contributions too — past the target date, for instance. Gating it on
    /// `isContributionEligible` made the simulation ignore money that had
    /// genuinely left the goal.
    @Test("counts a withdrawal on a month closed to contributions")
    func withdrawal_countsOutsideTheContributionWindow() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: [
                planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 1000),
                planMonth(
                    month: 2, year: 2026, state: .future,
                    isContributionEligible: false, plannedAmount: 0, withdrawnAmount: 300
                ),
            ],
            targetAmount: 1000
        )

        #expect(result.simulatedFinal == 700)
        #expect(result.isTargetMet == false)
    }

    /// The closure property must hold outside the window too: the sum `simulate`
    /// subtracts and the sum `redistribute` adds back have to cover the same set.
    @Test("still closes on the target when the withdrawal sits outside the window")
    func withdrawal_closesWithWithdrawalOutsideTheWindow() throws {
        let timeline = [
            planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 600),
            planMonth(
                month: 2, year: 2026, state: .future,
                isContributionEligible: false, plannedAmount: 0, withdrawnAmount: 400
            ),
            planMonth(month: 3, year: 2026, state: .future),
            planMonth(month: 4, year: 2026, state: .future),
        ]

        let redistribution = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline,
            targetAmount: 3000
        )
        let result = try SavingsPlanCalculator.simulate(
            timeline: timeline,
            targetAmount: 3000,
            adjustments: redistribution.adjustments
        )

        #expect(redistribution.remainingEffort == 2800)
        #expect(result.simulatedFinal == 3000)
    }
}
