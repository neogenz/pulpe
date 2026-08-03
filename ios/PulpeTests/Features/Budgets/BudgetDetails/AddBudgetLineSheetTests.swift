@testable import Pulpe
import Testing

struct AddBudgetLineSheetTests {
    @Test("Tag picker is visible only when the selected flow saves tags")
    func tagPickerVisibility() {
        #expect(AddBudgetLineSheet.showsTagPicker(spread: false, withdrawal: false))
        #expect(!AddBudgetLineSheet.showsTagPicker(spread: true, withdrawal: false))
        #expect(!AddBudgetLineSheet.showsTagPicker(spread: false, withdrawal: true))
    }

    @Test("Savings goal picker is visible for saving in both creation modes")
    func savingsGoalPickerVisibility() {
        #expect(AddBudgetLineSheet.showsSavingsGoalPicker(kind: .saving))
        #expect(!AddBudgetLineSheet.showsSavingsGoalPicker(kind: .expense))
        #expect(!AddBudgetLineSheet.showsSavingsGoalPicker(kind: .income))
    }

    // PUL-313 — a spread writes every selected month, so a goal whose deadline
    // covers the anchor but precedes a later month must still be refused: the
    // server rejects the whole fan-out, not just the offending tranche.
    @Test("The savings-goal horizon binds on the last spread month, not the anchor")
    func savingsGoalPeriodFollowsLastSpreadMonth() {
        let withoutSpread = AddBudgetLineSheet.savingsGoalPeriod(
            spreadMonths: [],
            anchorMonth: 6,
            anchorYear: 2026
        )
        let acrossYearEnd = AddBudgetLineSheet.savingsGoalPeriod(
            spreadMonths: [
                SpreadMonth(year: 2026, month: 11),
                SpreadMonth(year: 2026, month: 12),
                SpreadMonth(year: 2027, month: 1),
            ],
            anchorMonth: 11,
            anchorYear: 2026
        )

        #expect(withoutSpread == BudgetPeriod(month: 6, year: 2026))
        #expect(acrossYearEnd == BudgetPeriod(month: 1, year: 2027))
    }
}
