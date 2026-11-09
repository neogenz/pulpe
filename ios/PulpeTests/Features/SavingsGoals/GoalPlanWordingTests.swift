import Foundation
@testable import Pulpe
import Testing

@MainActor
@Suite("Goal plan wording Tests")
struct GoalPlanWordingTests {
    private func month(
        _ month: Int,
        provisionable: Bool = true,
        frozenBy consumed: Decimal = 0,
        hasBudget: Bool = true
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2026,
            state: .future,
            isLocked: false,
            hasBudget: hasBudget,
            isProvisionable: provisionable,
            plannedAmount: 0,
            confirmedAmount: 0,
            planWithdrawalConsumedAmount: consumed,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: []
        )
    }

    @Test("a contiguous open range is named from first to last")
    func label_contiguousRange_namesTheRange() {
        let label = GoalPlanSimulatorSheet.globalAmountLabel(months: [month(1), month(2), month(3)])

        let (from, to) = (Formatters.monthNameInText(for: 1), Formatters.monthNameInText(for: 3))
        #expect(label == AppLocale.string("Chaque mois, de \(from) à \(to), je mets"))
    }

    @Test("a frozen month inside the range falls back to the generic wording")
    func label_frozenMonthInside_isGeneric() {
        let label = GoalPlanSimulatorSheet.globalAmountLabel(months: [month(1), month(2, frozenBy: 50), month(3)])

        #expect(label == AppLocale.string("Chaque mois, je mets"))
    }

    @Test("the repair title names only the months the repair writes")
    func repairTitle_onlyRepairableMonths() {
        let title = GoalMonthByMonthPresentation.repairTitle([
            month(1, provisionable: false),
            month(2, hasBudget: false),
            month(3),
            month(4),
        ])

        let range = GoalMonthByMonthPresentation.rangeTitle([month(3), month(4)], capitalized: false)
        #expect(title == AppLocale.string("Planifier \(range)"))
        #expect(GoalMonthByMonthPresentation.repairTitle([month(1, provisionable: false)]) == nil)
    }
}
