import Foundation
@testable import Pulpe
import Testing

@MainActor
struct GoalMonthByMonthPresentationTests {
    private func month(
        _ month: Int,
        _ state: SavingsPlanMonthState,
        linked: Bool,
        confirmed: Decimal = 0,
        hasBudget: Bool = true
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2026,
            state: state,
            isLocked: false,
            hasBudget: hasBudget,
            isProvisionable: false,
            plannedAmount: linked ? 300 : 0,
            confirmedAmount: confirmed,
            plannedCumulative: 0,
            confirmedCumulative: Decimal(month) * 100,
            lines: linked
                ? [SavingsGoalPlanLine(
                    budgetLineId: "l\(month)", amount: 300, checkedAt: nil, isManuallyAdjusted: false
                )]
                : []
        )
    }

    @Test func foldsPastAndSplitsFutureIntoPlannedAndEmptyRuns() {
        let presentation = GoalMonthByMonthPresentation(
            months: [
                month(3, .past, linked: true, confirmed: 300),
                month(4, .past, linked: true, confirmed: 300),
                month(5, .current, linked: true),
                month(6, .future, linked: true),
                month(7, .future, linked: false, hasBudget: false),
                month(8, .future, linked: false, hasBudget: false),
            ],
            initialAmount: 0,
            currency: .chf
        )
        #expect(presentation.segments.map(\.kind) == [.past, .current, .planned, .empty])
        #expect(presentation.segments[0].amount == 400)
        #expect(presentation.segments[0].subtitle == AppLocale.string("\(2) mois pointés"))
        #expect(presentation.segments[3].subtitle == AppLocale.string("Pas encore de budget"))
        #expect(presentation.firstEmptyRun?.months.map(\.month) == [7, 8])
        #expect(presentation.planTitle != nil)
    }

    @Test func fullyPlannedGoalOffersNoPlanningCTA() {
        let presentation = GoalMonthByMonthPresentation(
            months: [month(5, .current, linked: true), month(6, .future, linked: true)],
            initialAmount: 0,
            currency: .chf
        )
        #expect(presentation.planTitle == nil)
    }

    @Test func rowFactPrefersStateChips() {
        let goal = SavingsGoal(
            id: "g", userId: "u", name: "Voiture", targetAmount: 15_000, targetDate: "2028-12-01",
            status: .paused, createdAt: Date(timeIntervalSince1970: 0), updatedAt: Date(timeIntervalSince1970: 0),
            initialAmount: nil
        )
        #expect(SavingsGoalRowFact(goal: goal, progress: nil).chip == AppLocale.string("En pause"))
    }
}
