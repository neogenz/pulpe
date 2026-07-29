import Foundation
@testable import Pulpe
import Testing

@Suite("GoalPlanTimelinePresentation Tests")
struct GoalPlanTimelinePresentationTests {
    @Test("distinguishes a materialized month without a linked forecast from a missing budget")
    func distinguishesUnlinkedForecastFromMissingBudget() {
        let august = makeMonth(month: 8, state: .future, hasLinkedForecast: true)
        let september = makeMonth(month: 9, state: .gap, hasBudget: true, isProvisionable: true)
        let november = makeMonth(month: 11, state: .gap, hasBudget: false, isProvisionable: true)

        #expect(GoalPlanMonthAvailability(month: august).icon == nil)
        #expect(GoalPlanMonthAvailability(month: september) == .noLinkedForecast)
        #expect(GoalPlanMonthAvailability(month: september).label == "Épargne à ajouter")
        #expect(GoalPlanMonthAvailability(month: november) == .missingBudget)
        #expect(GoalPlanMonthAvailability(month: november).label == "Pas de budget")
    }

    @Test("keeps the current month plus three future months collapsed and exposes the full plan expanded")
    func windowsAndExpandsThePlan() {
        let months = [
            makeMonth(month: 7, state: .current, hasLinkedForecast: true),
            makeMonth(month: 8, state: .future, hasLinkedForecast: true),
            makeMonth(month: 9, state: .gap),
            makeMonth(month: 10, state: .gap),
            makeMonth(month: 11, state: .gap, isProvisionable: true),
        ]

        let collapsed = GoalPlanTimelinePresentation(months: months, isExpanded: false)
        let expanded = GoalPlanTimelinePresentation(months: months, isExpanded: true)

        #expect(collapsed.visibleMonths.map(\.month) == [7, 8, 9, 10])
        #expect(collapsed.hiddenCount == 1)
        #expect(collapsed.remainingUnlinkedMonthCount == 3)
        #expect(collapsed.repairableMonths.map(\.month) == [11])
        #expect(expanded.visibleMonths.map(\.month) == [7, 8, 9, 10, 11])
        #expect(expanded.hiddenCount == 0)
    }

    @Test("starts the collapsed window at the current month when the plan contains history")
    func excludesPastMonthsFromCollapsedWindow() {
        let months = [
            makeMonth(month: 4, state: .past, hasLinkedForecast: true),
            makeMonth(month: 5, state: .past, hasLinkedForecast: true),
            makeMonth(month: 6, state: .past, hasLinkedForecast: true),
            makeMonth(month: 7, state: .current, hasLinkedForecast: true),
            makeMonth(month: 8, state: .future, hasLinkedForecast: true),
            makeMonth(month: 9, state: .gap),
            makeMonth(month: 10, state: .gap),
            makeMonth(month: 11, state: .gap, isProvisionable: true),
        ]

        let collapsed = GoalPlanTimelinePresentation(months: months, isExpanded: false)

        #expect(collapsed.visibleMonths.map(\.month) == [7, 8, 9, 10])
        #expect(collapsed.hiddenCount == 4)
    }

    @Test("counts unlinked forecasts from the current month while preserving history")
    func countsRemainingUnlinkedForecasts() {
        let months = [
            makeMonth(month: 4, state: .gap, isLocked: true),
            makeMonth(month: 5, state: .past, isLocked: true, hasLinkedForecast: true),
            makeMonth(month: 6, state: .gap, isLocked: true),
            makeMonth(month: 7, state: .current),
            makeMonth(month: 8, state: .future, hasLinkedForecast: true),
            makeMonth(month: 9, state: .gap),
            makeMonth(month: 10, state: .gap, isProvisionable: true),
        ]

        let collapsed = GoalPlanTimelinePresentation(months: months, isExpanded: false)
        let expanded = GoalPlanTimelinePresentation(months: months, isExpanded: true)

        #expect(expanded.visibleMonths.map(\.month) == [4, 5, 6, 7, 8, 9, 10])
        #expect(GoalPlanMonthAvailability(month: months[0]) == .noLinkedForecast)
        #expect(collapsed.remainingUnlinkedMonthCount == 3)
    }

    private func makeMonth(
        month: Int,
        state: SavingsPlanMonthState,
        isLocked: Bool = false,
        hasBudget: Bool = true,
        isProvisionable: Bool = false,
        hasLinkedForecast: Bool = false
    ) -> SavingsGoalPlanMonth {
        let lines = hasLinkedForecast
            ? [
                SavingsGoalPlanLine(
                    budgetLineId: "line-\(month)",
                    amount: 500,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ]
            : []

        return SavingsGoalPlanMonth(
            month: month,
            year: 2026,
            state: state,
            isLocked: isLocked,
            hasBudget: hasBudget,
            isProvisionable: isProvisionable,
            plannedAmount: hasLinkedForecast ? 500 : 0,
            confirmedAmount: 0,
            plannedCumulative: month <= 8 ? Decimal(month - 6) * 500 : 1_000,
            confirmedCumulative: 1_000,
            lines: lines
        )
    }
}
