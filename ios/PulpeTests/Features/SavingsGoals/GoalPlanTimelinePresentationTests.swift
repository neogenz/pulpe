import Foundation
@testable import Pulpe
import Testing

@Suite("GoalPlanTimelinePresentation Tests")
struct GoalPlanTimelinePresentationTests {
    @Test("distinguishes a materialized month without a linked forecast from a missing budget")
    func distinguishesUnlinkedForecastFromMissingBudget() {
        let september = makeMonth(month: 9, state: .gap)
        let november = makeMonth(month: 11, state: .gap, isProvisionable: true)

        #expect(GoalPlanMonthAvailability(month: september) == .noLinkedForecast)
        #expect(GoalPlanMonthAvailability(month: september).label == "Aucune prévision liée")
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
        #expect(collapsed.unlinkedMonthCount == 3)
        #expect(expanded.visibleMonths.map(\.month) == [7, 8, 9, 10, 11])
        #expect(expanded.hiddenCount == 0)
    }

    private func makeMonth(
        month: Int,
        state: SavingsPlanMonthState,
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
            isLocked: false,
            isProvisionable: isProvisionable,
            plannedAmount: hasLinkedForecast ? 500 : 0,
            confirmedAmount: 0,
            plannedCumulative: month <= 8 ? Decimal(month - 6) * 500 : 1_000,
            confirmedCumulative: 1_000,
            lines: lines
        )
    }
}
