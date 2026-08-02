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
}
