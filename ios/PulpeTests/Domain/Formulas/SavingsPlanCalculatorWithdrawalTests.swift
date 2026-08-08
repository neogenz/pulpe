import Foundation
@testable import Pulpe
import Testing

/// PUL-329 — retrait cases for `simulate` and `redistributeRemainingEffort`,
/// mirrors `savings-goal-plan.spec.ts`. Split from `SavingsPlanCalculatorTests`
/// (own fixture copy) to keep both suites under the file length ceiling.
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
    withdrawnAmount: Decimal = 0,
    plannedWithdrawalAmount: Decimal = 0,
    remainingPlannedWithdrawalAmount: Decimal = 0,
    planOnlyWithdrawalAmount: Decimal = 0
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
        plannedWithdrawalAmount: plannedWithdrawalAmount,
        remainingPlannedWithdrawalAmount: remainingPlannedWithdrawalAmount,
        planOnlyWithdrawalAmount: planOnlyWithdrawalAmount,
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

@Suite("SavingsPlanCalculator.plan-only withdrawals")
struct SavingsPlanDirectWithdrawalTests {
    @Test("treats a negative monthly adjustment as one plan-only withdrawal")
    func planOnlyWithdrawal_signedSimulationFixture() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: [
                planMonth(
                    month: 9,
                    year: 2026,
                    state: .current,
                    plannedAmount: 1_260
                ),
            ],
            targetAmount: 10_000,
            adjustments: [
                .init(month: 9, year: 2026, amount: -4_500),
            ],
            initialAmount: 10_000
        )

        #expect(result.months.first?.simulatedAmount == -4_500)
        #expect(result.simulatedFinal == 6_760)
    }

    @Test("preserves the planned contribution when reloading a plan-only withdrawal")
    func planOnlyWithdrawal_reloadedContributionFixture() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: [
                planMonth(
                    month: 9,
                    year: 2026,
                    state: .current,
                    plannedAmount: 1_260,
                    plannedWithdrawalAmount: 4_500,
                    remainingPlannedWithdrawalAmount: 4_500,
                    planOnlyWithdrawalAmount: 4_500
                ),
            ],
            targetAmount: 10_000,
            initialAmount: 10_000
        )

        #expect(result.months.first?.simulatedAmount == -4_500)
        #expect(result.simulatedFinal == 6_760)
    }

    @Test("replaces a reloaded plan-only withdrawal instead of subtracting it twice")
    func planOnlyWithdrawal_reloadedReplacementFixture() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: [
                planMonth(
                    month: 9,
                    year: 2026,
                    state: .current,
                    plannedAmount: 1_260,
                    plannedWithdrawalAmount: 4_500,
                    remainingPlannedWithdrawalAmount: 4_500,
                    planOnlyWithdrawalAmount: 4_500
                ),
            ],
            targetAmount: 10_000,
            adjustments: [.init(month: 9, year: 2026, amount: -3_000)],
            initialAmount: 10_000
        )

        #expect(result.simulatedFinal == 8_260)
    }

    @Test("replaces a reloaded withdrawal with one positive contribution when explicitly cleared")
    func planOnlyWithdrawal_positiveReplacementFixture() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: [
                planMonth(
                    month: 9,
                    year: 2026,
                    state: .current,
                    plannedAmount: 500,
                    plannedWithdrawalAmount: 4_500,
                    remainingPlannedWithdrawalAmount: 4_500,
                    planOnlyWithdrawalAmount: 4_500
                ),
            ],
            targetAmount: 10_000,
            adjustments: [
                .init(
                    month: 9,
                    year: 2026,
                    amount: 1_260,
                    replacesPlanOnlyWithdrawal: true
                ),
            ],
            initialAmount: 10_000
        )

        #expect(result.months.first?.simulatedAmount == 1_260)
        #expect(result.simulatedFinal == 11_260)
    }

    @Test("replaces a reloaded direct withdrawal when redistributing a signed pin")
    func planOnlyWithdrawal_signedRedistributionFixture() throws {
        let timeline = [
            planMonth(
                month: 9,
                year: 2026,
                state: .current,
                plannedAmount: 0,
                plannedWithdrawalAmount: 4_500,
                remainingPlannedWithdrawalAmount: 4_500,
                planOnlyWithdrawalAmount: 4_500
            ),
            planMonth(month: 10, year: 2026, state: .future),
        ]
        let redistribution = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline,
            targetAmount: 12_000,
            pinnedAdjustments: [.init(month: 9, year: 2026, amount: -3_000)],
            initialAmount: 10_000
        )
        let result = try SavingsPlanCalculator.simulate(
            timeline: timeline,
            targetAmount: 12_000,
            adjustments: [
                .init(month: 9, year: 2026, amount: -3_000),
            ] + redistribution.adjustments,
            initialAmount: 10_000
        )

        #expect(redistribution.remainingEffort == 5_000)
        #expect(redistribution.adjustments == [
            .init(month: 10, year: 2026, amount: 5_000),
        ])
        #expect(result.simulatedFinal == 12_000)
    }

    @Test("compensates an unpinned reloaded withdrawal during redistribution")
    func planOnlyWithdrawal_unpinnedRedistributionFixture() throws {
        let timeline = [
            planMonth(
                month: 9,
                year: 2026,
                state: .current,
                plannedAmount: 1_260,
                plannedWithdrawalAmount: 4_500,
                remainingPlannedWithdrawalAmount: 4_500,
                planOnlyWithdrawalAmount: 4_500
            ),
            planMonth(month: 10, year: 2026, state: .future),
        ]
        let redistribution = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline,
            targetAmount: 12_000,
            initialAmount: 10_000
        )
        let result = try SavingsPlanCalculator.simulate(
            timeline: timeline,
            targetAmount: 12_000,
            adjustments: redistribution.adjustments,
            initialAmount: 10_000
        )

        #expect(redistribution.remainingEffort == 6_500)
        #expect(redistribution.adjustments == [
            .init(month: 9, year: 2026, amount: 3_250),
            .init(month: 10, year: 2026, amount: 3_250),
        ])
        #expect(result.simulatedFinal == 12_000)
    }

    @Test("counts a linked-income plan once when no plan-only twin exists")
    func linkedIncomePlan_noDoubleCountingFixture() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: [
                planMonth(
                    month: 9,
                    year: 2026,
                    state: .current,
                    plannedAmount: 0,
                    plannedWithdrawalAmount: 4_500,
                    remainingPlannedWithdrawalAmount: 4_500
                ),
            ],
            targetAmount: 10_000,
            initialAmount: 10_000
        )

        #expect(result.simulatedFinal == 5_500)
    }
}

@Suite("SavingsPlanCalculator.withdrawals")
struct SavingsPlanCalculatorWithdrawalTests {
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

    // MARK: - Retraits ANNONCÉS (PUL-329 v2)

    /// Same fixture as the TS `buildSavingsGoalTimeline planned withdrawals`
    /// block: objectif 3'000, janvier → juin 2026, 500 confirmés en janvier et
    /// février, 500 prévus chaque mois ensuite, un retrait de 500 annoncé pour
    /// mai. `withdrawn` / `remaining` shift between the two fields as the
    /// announcement gets realized; their SUM stays 500, so every case below must
    /// produce the exact same two numbers.
    private func announcedTimeline(
        withdrawnInMay: Decimal,
        remainingInMay: Decimal
    ) -> [SavingsGoalPlanMonth] {
        [
            planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 2, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 3, year: 2026, state: .current),
            planMonth(month: 4, year: 2026, state: .future),
            planMonth(
                month: 5, year: 2026, state: .future,
                withdrawnAmount: withdrawnInMay,
                plannedWithdrawalAmount: 500,
                remainingPlannedWithdrawalAmount: remainingInMay
            ),
            planMonth(month: 6, year: 2026, state: .future),
        ]
    }

    @Test(
        "counts an announced withdrawal exactly once, whatever part is realized",
        arguments: [
            (withdrawn: Decimal(0), remaining: Decimal(500)),
            (withdrawn: Decimal(300), remaining: Decimal(200)),
            (withdrawn: Decimal(500), remaining: Decimal(0)),
        ]
    )
    func plannedWithdrawal_closesOnTargetAtEveryRealizationStage(
        stage: (withdrawn: Decimal, remaining: Decimal)
    ) throws {
        let timeline = announcedTimeline(
            withdrawnInMay: stage.withdrawn,
            remainingInMay: stage.remaining
        )

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
        #expect(redistribution.remainingEffort == 2500)
        #expect(result.simulatedFinal == 3000)
    }

    /// A plan the user let pass, and a plan announced beyond the échéance, both
    /// reach the client with `remaining = 0`: the announcement is still readable
    /// but weighs nothing. Reading the gross amount instead would keep charging
    /// the goal for a retrait that never happened.
    @Test("ignores an announcement whose remainder the server zeroed")
    func plannedWithdrawal_lapsedAnnouncementWeighsNothing() throws {
        let timeline = announcedTimeline(withdrawnInMay: 0, remainingInMay: 0)

        let redistribution = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline,
            targetAmount: 3000
        )
        let result = try SavingsPlanCalculator.simulate(
            timeline: timeline,
            targetAmount: 3000,
            adjustments: redistribution.adjustments
        )

        #expect(redistribution.remainingEffort == 2000)
        #expect(result.simulatedFinal == 3000)
    }

    /// Réel supérieur au prévu (600 sorti sur une annonce de 500, reliquat zéro)
    /// à côté d'un retrait libre du même plan. Chacun compte une fois et une
    /// seule, dans l'effort restant comme dans le cumul simulé.
    @Test("closes on the target with an over-realized plan next to a free withdrawal")
    func plannedWithdrawal_overRealizedNextToAFreeWithdrawal() throws {
        var timeline = announcedTimeline(withdrawnInMay: 600, remainingInMay: 0)
        timeline[3] = planMonth(month: 4, year: 2026, state: .future, withdrawnAmount: 200)

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
