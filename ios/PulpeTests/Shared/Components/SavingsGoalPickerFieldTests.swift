import Foundation
@testable import Pulpe
import Testing

private func goal(targetDate: String?) -> SavingsGoal {
    SavingsGoal(
        id: "goal-1",
        userId: "user-1",
        name: "Vacances",
        targetAmount: 3_000,
        targetDate: targetDate,
        status: .active,
        createdAt: Date(),
        updatedAt: Date()
    )
}

private func selectionState(
    hasLoadedOnce: Bool = true,
    isLoading: Bool = false,
    hasError: Bool = false,
    knownGoalIDs: Set<String> = [],
    linkableGoalIDs: Set<String> = [],
    pickedHere: Bool = false
) -> SavingsGoalPickerField.SelectionState {
    SavingsGoalPickerField.SelectionState(
        hasLoadedOnce: hasLoadedOnce,
        isLoading: isLoading,
        hasError: hasError,
        knownGoalIDs: knownGoalIDs,
        linkableGoalIDs: linkableGoalIDs,
        pickedHere: pickedHere
    )
}

struct SavingsGoalPickerFieldTests {
    @Test("a missing selection is preserved while goals are loading or failed")
    func missingSelection_preservedUntilSuccessfulLoad() {
        let loading = selectionState(hasLoadedOnce: false, isLoading: true)
        let failed = selectionState(hasLoadedOnce: false, hasError: true)

        #expect(loading.reconciled("missing") == "missing")
        #expect(failed.reconciled("missing") == "missing")
    }

    @Test("a successful load clears only selections absent from the response")
    func successfulLoad_reconcilesSelection() {
        let loaded = selectionState(
            knownGoalIDs: ["available"],
            linkableGoalIDs: ["available"]
        )

        #expect(loaded.reconciled("missing") == nil)
        #expect(loaded.reconciled("available") == "available")
        #expect(loaded.reconciled(nil) == nil)
    }

    // The two staleness reasons are not symmetric: a vanished goal can never be
    // saved again, but a goal merely out of horizon was legitimately linkable
    // when the line was saved — an edit sheet opens carrying it.
    @Test("an out-of-horizon goal is withdrawn only when it was picked here")
    func outOfHorizonGoal_withdrawnOnlyWhenPickedHere() {
        let pickedHere = selectionState(
            knownGoalIDs: ["expired"],
            linkableGoalIDs: [],
            pickedHere: true
        )
        let openedWith = selectionState(
            knownGoalIDs: ["expired"],
            linkableGoalIDs: []
        )

        #expect(pickedHere.reconciled("expired") == nil)
        #expect(openedWith.reconciled("expired") == "expired")
    }

    // PUL-313 — the picker must not offer a link `enforce_savings_goal_line_link`
    // would reject with a 422.
    @Test("a deadline before the budget period puts the goal out of horizon")
    func deadlineBeforeBudgetPeriod_isOutsideHorizon() {
        let deadline = SavingsGoalPickerField.exceededDeadline(
            for: goal(targetDate: "2027-08-01"),
            budgetPeriod: BudgetPeriod(month: 9, year: 2027),
            payDayOfMonth: 1
        )

        #expect(deadline == BudgetPeriod(month: 8, year: 2027))
    }

    @Test("a deadline at or after the budget period keeps the goal reachable")
    func deadlineAtOrAfterBudgetPeriod_staysInHorizon() {
        let sameMonth = SavingsGoalPickerField.exceededDeadline(
            for: goal(targetDate: "2027-08-01"),
            budgetPeriod: BudgetPeriod(month: 8, year: 2027),
            payDayOfMonth: 1
        )
        let laterDeadline = SavingsGoalPickerField.exceededDeadline(
            for: goal(targetDate: "2027-08-01"),
            budgetPeriod: BudgetPeriod(month: 3, year: 2027),
            payDayOfMonth: 1
        )

        #expect(sameMonth == nil)
        #expect(laterDeadline == nil)
    }

    @Test("an undated goal has no horizon to fall outside of")
    func undatedGoal_neverOutsideHorizon() {
        let deadline = SavingsGoalPickerField.exceededDeadline(
            for: goal(targetDate: nil),
            budgetPeriod: BudgetPeriod(month: 12, year: 2030),
            payDayOfMonth: 1
        )

        #expect(deadline == nil)
    }

    @Test("no budget period means no bound — the template-line case")
    func withoutBudgetPeriod_neverOutsideHorizon() {
        let deadline = SavingsGoalPickerField.exceededDeadline(
            for: goal(targetDate: "2027-08-01"),
            budgetPeriod: nil,
            payDayOfMonth: 1
        )

        #expect(deadline == nil)
    }

    // 28 August straddles the pay cycle: on payDay 1 it belongs to the August
    // period, on payDay 27 it opens the September one (règle quinzaine). The
    // same goal must therefore flip verdict on a September budget.
    @Test("the verdict follows the pay day")
    func verdictFollowsPayDay() {
        let september = BudgetPeriod(month: 9, year: 2027)

        let onCalendarPayDay = SavingsGoalPickerField.exceededDeadline(
            for: goal(targetDate: "2027-08-28"),
            budgetPeriod: september,
            payDayOfMonth: 1
        )
        let onLatePayDay = SavingsGoalPickerField.exceededDeadline(
            for: goal(targetDate: "2027-08-28"),
            budgetPeriod: september,
            payDayOfMonth: 27
        )

        #expect(onCalendarPayDay == BudgetPeriod(month: 8, year: 2027))
        #expect(onLatePayDay == nil)
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

    // Same fixture as the webapp suite: both clients and the server compare the
    // same cent-rounded difference. The balance can arrive a hair under zero.
    @Test("a balance a hair under the amount still empties the goal")
    func withdrawalState_absorbsRoundingUnderTheTolerance() {
        let inBand = state(option: option(available: 149.999), amount: 150)

        #expect(inBand.remainingAmount == 0)
        #expect(!inBand.hasInsufficientBalance)
        #expect(inBand.isReady)
    }

    @Test("an overshoot of one cent blocks")
    func withdrawalState_blocksOneCentOver() {
        let outOfBand = state(option: option(available: 150), amount: 150.01)

        #expect(outOfBand.hasInsufficientBalance)
        #expect(!outOfBand.isReady)
    }

    @Test("a completed goal can still fund an income")
    func withdrawalState_acceptsACompletedGoal() {
        let completed = state(option: option(available: 800, status: .completed), amount: 300)

        #expect(completed.isReady)
        #expect(completed.remainingAmount == 500)
    }
}
