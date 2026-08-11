import Foundation
@testable import Pulpe
import Testing

/// PUL-329 — a withdrawal whose realization has started freezes ITS month without
/// settling the month's contribution. Mirrors `savings-goal-plan.spec.ts`.
/// Split from `SavingsPlanCalculatorWithdrawalTests` to stay under the file ceiling.
private func planMonth(
    month: Int,
    year: Int,
    state: SavingsPlanMonthState = .future,
    isLocked: Bool = false,
    confirmedAmount: Decimal = 0,
    withdrawnAmount: Decimal = 0,
    plannedWithdrawalAmount: Decimal = 0,
    remainingPlannedWithdrawalAmount: Decimal = 0,
    planLinkedWithdrawalAmount: Decimal = 0,
    planWithdrawalDestination: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination? = nil,
    planWithdrawalConsumedAmount: Decimal = 0
) -> SavingsGoalPlanMonth {
    SavingsGoalPlanMonth(
        month: month,
        year: year,
        state: state,
        isLocked: isLocked,
        isContributionEligible: true,
        isProvisionable: false,
        plannedAmount: 500,
        confirmedAmount: confirmedAmount,
        withdrawnAmount: withdrawnAmount,
        plannedWithdrawalAmount: plannedWithdrawalAmount,
        remainingPlannedWithdrawalAmount: remainingPlannedWithdrawalAmount,
        planOnlyWithdrawalAmount: 0,
        planLinkedWithdrawalAmount: planLinkedWithdrawalAmount,
        planWithdrawalDestination: planWithdrawalDestination,
        planWithdrawalConsumedAmount: planWithdrawalConsumedAmount,
        plannedCumulative: 0,
        confirmedCumulative: 0,
        lines: [
            SavingsGoalPlanLine(
                budgetLineId: "\(year)-\(month)",
                amount: 500,
                checkedAt: nil,
                isManuallyAdjusted: false
            ),
        ]
    )
}

/// Mai 2026 : prévision de 500 non pointée, retrait annoncé de 500 dont 300 déjà
/// réalisés — le mois est figé mais doit toujours sa contribution.
private let realizingMay = planMonth(
    month: 5,
    year: 2026,
    withdrawnAmount: 300,
    plannedWithdrawalAmount: 500,
    remainingPlannedWithdrawalAmount: 200,
    planLinkedWithdrawalAmount: 200,
    planWithdrawalDestination: .linkedIncome,
    planWithdrawalConsumedAmount: 300
)

@Suite("SavingsPlanCalculator.realization lock")
struct SavingsPlanRealizationLockTests {
    @Test("normalizes the same 10.05 = 0.01 + 10.04 residue as TypeScript")
    func floatingResidue_weighsNothing() throws {
        let residue = try #require(Decimal(string: "0.0000000000000017763568394002505"))
        let timeline = [
            planMonth(
                month: 5,
                year: 2026,
                withdrawnAmount: 10.05,
                plannedWithdrawalAmount: 10.05,
                remainingPlannedWithdrawalAmount: residue
            ),
        ]
        let exactTimeline = [
            planMonth(
                month: 5,
                year: 2026,
                withdrawnAmount: 10.05,
                plannedWithdrawalAmount: 10.05
            ),
        ]
        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline,
            targetAmount: 3000
        )
        let exactResult = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: exactTimeline,
            targetAmount: 3000
        )
        let simulation = try SavingsPlanCalculator.simulate(
            timeline: timeline,
            targetAmount: 3000
        )
        let exactSimulation = try SavingsPlanCalculator.simulate(
            timeline: exactTimeline,
            targetAmount: 3000
        )

        #expect(result.remainingEffort == exactResult.remainingEffort)
        #expect(simulation.simulatedFinal == exactSimulation.simulatedFinal)
    }

    /// A realization started on ONE month freezes that month, not the whole plan:
    /// mars, avril and juin stay valid redistribution targets.
    @Test("keeps redistributing the other months when one starts realizing")
    func frozenMonth_doesNotDisableRedistribution() {
        let timeline = [
            planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 2, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 3, year: 2026, state: .current),
            planMonth(month: 4, year: 2026),
            realizingMay,
            planMonth(month: 6, year: 2026),
        ]

        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline,
            targetAmount: 3000
        )

        #expect(result.isDistributable)
    }

    /// The month is frozen, not cancelled: its unpointed forecast is still due,
    /// exactly as `projectedCumulative` already counts it on the timeline side.
    @Test("keeps the unpointed forecast of a realizing month in the simulation")
    func frozenMonth_keepsItsForecastInSimulation() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: [realizingMay],
            targetAmount: 3000
        )

        #expect(result.months.first?.simulatedAmount == 500)
    }
}
