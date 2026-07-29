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
}
