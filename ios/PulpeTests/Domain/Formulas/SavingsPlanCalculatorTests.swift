import Foundation
@testable import Pulpe
import Testing

/// PUL-12+ — the iOS mirror of `shared/src/calculators/savings-goal-plan.spec.ts`.
///
/// `SavingsPlanCalculator` is the live-preview half of the plan simulator: the
/// server is authoritative, but the sandbox the user drags must equal what gets
/// persisted. These fixtures/expectations are lifted 1:1 from the TS spec so the
/// two implementations can never drift. `buildSavingsGoalTimeline` is not mirrored
/// (the server sends `months[]`), so only the three simulator functions are tested.
@Suite("SavingsPlanCalculator")
struct SavingsPlanCalculatorTests {
    private func dec(_ value: String) -> Decimal {
        Decimal(string: value) ?? 0
    }

    private func sumCents(_ amount: Decimal) -> Int {
        NSDecimalNumber(decimal: (amount * 100).rounded(0, .plain)).intValue
    }

    /// Mirrors the TS `planMonth` factory: a single unchecked line worth
    /// `plannedAmount` unless the caller overrides `lines`.
    private func planMonth(
        month: Int,
        year: Int,
        state: SavingsPlanMonthState = .future,
        isLocked: Bool = false,
        plannedAmount: Decimal = 500,
        confirmedAmount: Decimal = 0,
        lines: [SavingsGoalPlanLine]? = nil
    ) -> SavingsGoalPlanMonth {
        let resolvedLines = lines ?? [
            SavingsGoalPlanLine(
                budgetLineId: "\(year)-\(month)",
                amount: plannedAmount,
                checkedAt: nil,
                isManuallyAdjusted: false
            )
        ]
        return SavingsGoalPlanMonth(
            month: month,
            year: year,
            state: state,
            isLocked: isLocked,
            plannedAmount: plannedAmount,
            confirmedAmount: confirmedAmount,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: resolvedLines
        )
    }

    private var simulateTimeline: [SavingsGoalPlanMonth] {
        [
            planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 2, year: 2026, state: .past, isLocked: true, confirmedAmount: 500),
            planMonth(month: 3, year: 2026, state: .current),
            planMonth(month: 4, year: 2026, state: .future),
        ]
    }

    // MARK: - simulate

    @Test("keeps reality on locked months and plan on open months")
    func simulate_keepsRealityOnLockedAndPlanOnOpen() throws {
        let result = try SavingsPlanCalculator.simulate(timeline: simulateTimeline, targetAmount: 3000)

        #expect(result.simulatedFinal == 2000)
        #expect(result.gapToTarget == 1000)
        #expect(result.isTargetMet == false)
        #expect(result.attainedPeriod == nil)
    }

    @Test("applies a global monthly amount to every open month")
    func simulate_appliesGlobalMonthlyAmount() throws {
        let result = try SavingsPlanCalculator.simulate(
            timeline: simulateTimeline,
            targetAmount: 3000,
            globalMonthlyAmount: 1000
        )

        #expect(result.simulatedFinal == 3000)
        #expect(result.isTargetMet == true)
        #expect(result.attainedPeriod == BudgetPeriod(month: 4, year: 2026))
    }

    @Test("throws when an adjustment targets a locked month")
    func simulate_throwsForLockedAdjustment() {
        #expect(throws: SavingsPlanCalculator.SimulationError.self) {
            try SavingsPlanCalculator.simulate(
                timeline: simulateTimeline,
                targetAmount: 3000,
                adjustments: [.init(month: 1, year: 2026, amount: 800)]
            )
        }
    }

    // MARK: - redistributeRemainingEffort

    @Test("splits the remaining effort over open months cents-exact")
    func redistribute_splitsRemainingCentsExact() {
        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: simulateTimeline,
            targetAmount: 3000
        )

        #expect(result.isDistributable == true)
        #expect(result.remainingEffort == 2000)
        #expect(result.adjustments == [
            .init(month: 3, year: 2026, amount: 1000),
            .init(month: 4, year: 2026, amount: 1000),
        ])
    }

    @Test("holds pinned months fixed and distributes the rest")
    func redistribute_holdsPinnedFixed() {
        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: simulateTimeline,
            targetAmount: 3000,
            pinnedAdjustments: [.init(month: 3, year: 2026, amount: 700)]
        )

        #expect(result.adjustments == [.init(month: 4, year: 2026, amount: 1300)])
    }

    @Test("is not distributable when no open month remains")
    func redistribute_notDistributableWhenOverdue() {
        let overdue = [planMonth(month: 1, year: 2026, state: .past, isLocked: true, confirmedAmount: 500)]

        let result = SavingsPlanCalculator.redistributeRemainingEffort(timeline: overdue, targetAmount: 3000)

        #expect(result.isDistributable == false)
        #expect(result.adjustments.isEmpty)
    }

    @Test("proposes zeros when the target is already covered")
    func redistribute_proposesZerosWhenCovered() {
        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: simulateTimeline,
            targetAmount: 800
        )

        #expect(result.adjustments == [
            .init(month: 3, year: 2026, amount: 0),
            .init(month: 4, year: 2026, amount: 0),
        ])
    }

    // MARK: - allocateMonthAmountToLines

    @Test("splits proportionally to the current line amounts")
    func allocate_splitsProportionally() {
        let result = SavingsPlanCalculator.allocateMonthAmountToLines(
            [
                .init(budgetLineId: "a", amount: 300, checkedAt: nil),
                .init(budgetLineId: "b", amount: 100, checkedAt: nil),
            ],
            newMonthAmount: 500
        )

        #expect(result == [
            .init(budgetLineId: "a", amount: 375),
            .init(budgetLineId: "b", amount: 125),
        ])
    }

    @Test("skips checked lines and only touches open ones")
    func allocate_skipsCheckedLines() {
        let result = SavingsPlanCalculator.allocateMonthAmountToLines(
            [
                .init(budgetLineId: "a", amount: 300, checkedAt: "2026-01-01T00:00:00.000Z"),
                .init(budgetLineId: "b", amount: 100, checkedAt: nil),
            ],
            newMonthAmount: 500
        )

        #expect(result == [.init(budgetLineId: "b", amount: 500)])
    }

    @Test("splits equally when current amounts sum to zero")
    func allocate_splitsEquallyWhenSumZero() {
        let result = SavingsPlanCalculator.allocateMonthAmountToLines(
            [
                .init(budgetLineId: "a", amount: 0, checkedAt: nil),
                .init(budgetLineId: "b", amount: 0, checkedAt: nil),
            ],
            newMonthAmount: 500
        )

        #expect(result == [
            .init(budgetLineId: "a", amount: 250),
            .init(budgetLineId: "b", amount: 250),
        ])
    }

    @Test("zeros every open line when the month amount is zero")
    func allocate_zerosEveryOpenLineWhenAmountZero() {
        let result = SavingsPlanCalculator.allocateMonthAmountToLines(
            [
                .init(budgetLineId: "a", amount: 300, checkedAt: nil),
                .init(budgetLineId: "b", amount: 100, checkedAt: nil),
            ],
            newMonthAmount: 0
        )

        #expect(result == [
            .init(budgetLineId: "a", amount: 0),
            .init(budgetLineId: "b", amount: 0),
        ])
    }

    @Test("preserves the total to the cent under rounding")
    func allocate_preservesTotalToTheCent() {
        let result = SavingsPlanCalculator.allocateMonthAmountToLines(
            [
                .init(budgetLineId: "a", amount: 100, checkedAt: nil),
                .init(budgetLineId: "b", amount: 100, checkedAt: nil),
                .init(budgetLineId: "c", amount: 100, checkedAt: nil),
            ],
            newMonthAmount: 100
        )

        let total = result.reduce(0) { $0 + sumCents($1.amount) }
        #expect(total == 10_000)
    }
}
