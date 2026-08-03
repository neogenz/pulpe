import Foundation
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

    // MARK: - Withdrawal mode (PUL-329)

    private func option(
        available: Decimal,
        status: SavingsGoalStatus = .active
    ) -> SavingsGoalWithdrawalOption {
        SavingsGoalWithdrawalOption(
            goalId: "goal-1",
            name: "Maison",
            status: status,
            availableAmount: available,
            currency: .chf
        )
    }

    private func state(
        option: SavingsGoalWithdrawalOption?,
        amount: Decimal?,
        isLoading: Bool = false,
        hasError: Bool = false
    ) -> SavingsGoalPickerField.WithdrawalState {
        SavingsGoalPickerField.WithdrawalState(
            selectedOption: option,
            withdrawalAmount: amount,
            isLoading: isLoading,
            hasError: hasError
        )
    }

    @Test("the preview subtracts the withdrawal from the confirmed balance")
    func withdrawalState_showsWhatIsLeft() {
        let ready = state(option: option(available: 10000), amount: 4500)

        #expect(ready.remainingAmount == 5500)
        #expect(!ready.hasInsufficientBalance)
        #expect(ready.isReady)
    }

    @Test("an overshoot blocks the submission before the network")
    func withdrawalState_blocksOnOvershoot() {
        let overshoot = state(option: option(available: 10000), amount: 10000.01)

        #expect(overshoot.hasInsufficientBalance)
        #expect(!overshoot.isReady)
    }

    @Test("spending the whole balance stays allowed")
    func withdrawalState_allowsEmptyingTheGoal() {
        let exact = state(option: option(available: 10000), amount: 10000)

        #expect(exact.remainingAmount == 0)
        #expect(exact.isReady)
    }

    @Test("no selection, no resolved amount, loading or failure all block")
    func withdrawalState_blocksWhileIncomplete() {
        #expect(!state(option: nil, amount: 4500).isReady)
        #expect(!state(option: option(available: 10000), amount: nil).isReady)
        #expect(!state(option: option(available: 10000), amount: 10, isLoading: true).isReady)
        #expect(!state(option: option(available: 10000), amount: 10, hasError: true).isReady)
    }

    @Test("a completed goal can still fund an income")
    func withdrawalState_acceptsACompletedGoal() {
        let completed = state(option: option(available: 800, status: .completed), amount: 300)

        #expect(completed.isReady)
        #expect(completed.remainingAmount == 500)
    }
}
