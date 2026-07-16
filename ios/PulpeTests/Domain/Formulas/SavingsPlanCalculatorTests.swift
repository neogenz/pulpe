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
        isProvisionable: Bool = false,
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
            isProvisionable: isProvisionable,
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

    @Test("includes 22 provisionable gaps in a 24-month global plan")
    func simulate_includesProvisionableGapsInGlobalPlan() throws {
        let timeline = (0 ..< 24).map { offset in
            let index = 2026 * 12 + 3 + offset
            let year = (index - 1) / 12
            let month = index - year * 12
            return planMonth(
                month: month,
                year: year,
                state: offset == 0 ? .current : offset < 2 ? .future : .gap,
                isProvisionable: offset >= 2,
                plannedAmount: 0,
                lines: offset < 2 ? nil : []
            )
        }

        let redistribution = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: timeline,
            targetAmount: 24_000
        )
        let simulation = try SavingsPlanCalculator.simulate(
            timeline: timeline,
            targetAmount: 24_000,
            globalMonthlyAmount: 1_000
        )

        #expect(timeline.filter(SavingsPlanCalculator.isOpenPlanMonth).count == 2)
        #expect(timeline.filter(SavingsPlanCalculator.isContributivePlanMonth).count == 24)
        #expect(redistribution.isDistributable == true)
        #expect(redistribution.perRemainingMonth == 1_000)
        #expect(redistribution.adjustments.count == 24)
        #expect(redistribution.adjustments.allSatisfy { $0.amount == 1_000 })
        #expect(simulation.simulatedFinal == 24_000)
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

    @Test("holds a provisionable pinned month fixed")
    func redistribute_holdsProvisionablePinnedFixed() {
        let gap = planMonth(
            month: 4,
            year: 2026,
            state: .gap,
            isProvisionable: true,
            plannedAmount: 0,
            lines: []
        )

        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: [planMonth(month: 3, year: 2026, state: .current), gap],
            targetAmount: 2_000,
            pinnedAdjustments: [.init(month: 4, year: 2026, amount: 700)]
        )

        #expect(result.adjustments == [.init(month: 3, year: 2026, amount: 1_300)])
    }

    @Test("blocks redistribution when a future gap cannot be provisioned")
    func redistribute_blocksNonProvisionableGap() {
        let unavailable = planMonth(
            month: 4,
            year: 2026,
            state: .gap,
            plannedAmount: 0,
            lines: []
        )

        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: [planMonth(month: 3, year: 2026, state: .current), unavailable],
            targetAmount: 1_000
        )

        #expect(result.isDistributable == false)
        #expect(result.adjustments.isEmpty)
    }

    @Test("splits cents over provisionable gaps exactly like shared")
    func redistribute_splitsProvisionableGapCentsExact() {
        let gaps = (3 ... 5).map { month in
            planMonth(
                month: month,
                year: 2026,
                state: .gap,
                isProvisionable: true,
                plannedAmount: 0,
                lines: []
            )
        }

        let result = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: gaps,
            targetAmount: dec("100.01")
        )

        #expect(result.adjustments.map(\.amount) == [dec("33.34"), dec("33.34"), dec("33.33")])
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

    @Test("keeps checked lines while preserving the requested month total")
    func allocate_skipsCheckedLines() {
        let result = SavingsPlanCalculator.allocateMonthAmountToLines(
            [
                .init(budgetLineId: "a", amount: 300, checkedAt: "2026-01-01T00:00:00.000Z"),
                .init(budgetLineId: "b", amount: 100, checkedAt: nil),
            ],
            newMonthAmount: 500
        )

        #expect(result == [.init(budgetLineId: "b", amount: 200)])
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

    // MARK: - suggestedMonthlyContribution (PUL-285 CA1/CA6 — mirror of shared spec)

    private static func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        components.hour = 12
        return Calendar.current.date(from: components)!
    }

    @Test("divides the target across remaining months, current and deadline inclusive")
    func suggestion_dividesAcrossRemainingMonths() {
        let suggestion = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 100_000,
            targetDate: Self.date(2030, 5, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        )

        #expect(suggestion == Decimal(string: "2083.34"))
    }

    @Test("rounds UP to the cent so suggestion × months covers the target")
    func suggestion_roundsUpToTheCent() throws {
        let suggestion = try #require(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 100_000,
            targetDate: Self.date(2030, 5, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        ))

        #expect(suggestion * 48 >= 100_000)
    }

    @Test("is payDay-aware — a payDay before today shifts the current period")
    func suggestion_isPayDayAware() {
        let withoutPayDay = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 1200,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 28)
        )
        let withPayDay = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 1200,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: 25,
            now: Self.date(2026, 6, 28)
        )

        #expect(withoutPayDay != withPayDay)
    }

    @Test("returns nil when the deadline is past or the target non-positive")
    func suggestion_nilOnDegenerateInputs() {
        #expect(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 5000,
            targetDate: Self.date(2026, 1, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        ) == nil)
        #expect(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 0,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        ) == nil)
    }
}
