@testable import Pulpe
import Testing

struct SavingsGoalPickerFieldTests {
    @Test("a missing selection is preserved while goals are loading or failed")
    func missingSelection_preservedUntilSuccessfulLoad() {
        let loading = SavingsGoalPickerField.SelectionState(
            hasLoadedOnce: false,
            isLoading: true,
            hasError: false,
            goalIDs: []
        )
        let failed = SavingsGoalPickerField.SelectionState(
            hasLoadedOnce: false,
            isLoading: false,
            hasError: true,
            goalIDs: []
        )

        #expect(loading.reconciled("missing") == "missing")
        #expect(failed.reconciled("missing") == "missing")
    }

    @Test("a successful load clears only selections absent from the response")
    func successfulLoad_reconcilesSelection() {
        let loaded = SavingsGoalPickerField.SelectionState(
            hasLoadedOnce: true,
            isLoading: false,
            hasError: false,
            goalIDs: ["available"]
        )

        #expect(loaded.reconciled("missing") == nil)
        #expect(loaded.reconciled("available") == "available")
        #expect(loaded.reconciled(nil) == nil)
    }
}
