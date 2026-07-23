import Foundation
@testable import Pulpe
import Testing

/// `initialAmount` (PUL-293 stock de départ) seed cases for `simulate` and
/// `redistributeRemainingEffort` — mirrors `savings-goal-plan.spec.ts`. Split
/// from `SavingsPlanCalculatorTests` (own fixture copy) to keep both suites
/// under the `type_body_length` ceiling.
@Suite("SavingsPlanCalculator.initialAmount")
struct SavingsPlanCalculatorInitialAmountTests {
    /// Mirrors the TS `planMonth` factory: a single unchecked line worth
    /// `plannedAmount` unless the caller overrides `lines`.
    private func planMonth(
        month: Int,
        year: Int,
        state: SavingsPlanMonthState = .future,
        isLocked: Bool = false,
        plannedAmount: Decimal = 500,
        confirmedAmount: Decimal = 0
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: year,
            state: state,
            isLocked: isLocked,
            isProvisionable: false,
            plannedAmount: plannedAmount,
            confirmedAmount: confirmedAmount,
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

    private var timeline: [SavingsGoalPlanMonth] {
        [
            planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 2, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 3, year: 2026, state: .current),
            planMonth(month: 4, year: 2026, state: .future),
        ]
    }

    @Test("seeds simulatedCumulative with initialAmount and reaches the target earlier")
    func simulate_seedsCumulativeWithInitialAmount() throws {
        let result = try SavingsPlanCalculator.simulate(timeline: timeline, targetAmount: 3000, initialAmount: 2000)

        #expect(result.simulatedFinal == 4000)
        #expect(result.isTargetMet == true)
        #expect(result.attainedPeriod == BudgetPeriod(month: 2, year: 2026))
    }

    @Test("produces an identical simulation whether initialAmount is absent or zero")
    func simulate_seedZeroMatchesAbsent() throws {
        let absent = try SavingsPlanCalculator.simulate(timeline: timeline, targetAmount: 3000)
        let zero = try SavingsPlanCalculator.simulate(timeline: timeline, targetAmount: 3000, initialAmount: 0)

        #expect(zero == absent)
    }

    @Test("deducts the initial stock before distributing the remaining effort")
    func redistribute_deductsInitialAmount() {
        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline, targetAmount: 10_000, initialAmount: 5_000
        )

        #expect(result.isDistributable == true)
        #expect(result.remainingEffort == 4_000)
        #expect(result.adjustments == [
            .init(month: 3, year: 2026, amount: 2_000),
            .init(month: 4, year: 2026, amount: 2_000),
        ])
    }

    @Test("produces an identical redistribution whether initialAmount is absent or zero")
    func redistribute_seedZeroMatchesAbsent() {
        let absent = SavingsPlanCalculator.redistributeRemainingEffort(timeline: timeline, targetAmount: 3000)
        let zero = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline, targetAmount: 3000, initialAmount: 0
        )

        #expect(zero == absent)
    }
}
