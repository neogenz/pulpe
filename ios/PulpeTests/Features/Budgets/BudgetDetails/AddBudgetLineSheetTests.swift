@testable import Pulpe
import Testing

struct AddBudgetLineSheetTests {
    @Test("Tag picker is visible only when the selected flow saves tags")
    func tagPickerVisibility() {
        #expect(AddBudgetLineSheet.showsTagPicker(spread: false, withdrawal: false))
        #expect(!AddBudgetLineSheet.showsTagPicker(spread: true, withdrawal: false))
        #expect(!AddBudgetLineSheet.showsTagPicker(spread: false, withdrawal: true))
    }
}
