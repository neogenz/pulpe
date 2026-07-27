import Foundation
@testable import Pulpe
import Testing

struct SavingsGoalFormSheetTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return calendar
    }

    private func makeDeletionImpact(
        budgetCount: Int = 0,
        transactionCount: Int = 1
    ) -> SavingsGoalDeletionImpact {
        let budgets = (0..<budgetCount).reversed().map { index in
            SavingsGoalDeletionBudget(
                budgetId: "budget-\(index)",
                month: (index % 12) + 1,
                year: 2026 + index / 12,
                lines: []
            )
        }
        return SavingsGoalDeletionImpact(
            goalId: "goal-1",
            summary: SavingsGoalDeletionSummary(
                templateLineCount: 0,
                templateLineTotal: 0,
                budgetCount: budgetCount,
                budgetLineCount: 0,
                budgetLineTotal: 0,
                transactionCount: transactionCount,
                transactionTotal: 0
            ),
            templateLines: [],
            budgets: budgets,
            revision: SavingsGoalDeletionRevision(
                templateLines: [],
                budgetLines: [],
                transactions: []
            )
        )
    }

    @Test("the target date range covers at most 120 monthly periods")
    func targetDateRange_limitsNewGoalsTo120Periods() throws {
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 7, day: 13)))
        let expectedMaximum = try #require(calendar.date(from: DateComponents(year: 2036, month: 6, day: 30)))

        let range = SavingsGoalFormSheet.targetDateRange(
            goal: nil,
            now: now,
            calendar: calendar
        )

        #expect(range.lowerBound == now)
        #expect(range.upperBound == expectedMaximum)
    }

    @Test("editing preserves an existing target date outside the current range")
    func targetDateRange_preservesExistingTarget() throws {
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 7, day: 13)))
        let existingTarget = try #require(calendar.date(from: DateComponents(year: 2037, month: 1, day: 15)))
        let intermediateTarget = try #require(calendar.date(from: DateComponents(year: 2036, month: 9, day: 15)))
        let goal = SavingsGoal(
            id: "goal-1",
            userId: "user-1",
            name: "Maison",
            targetAmount: 100_000,
            targetDate: "2037-01-15",
            status: .active,
            createdAt: now,
            updatedAt: now
        )

        let range = SavingsGoalFormSheet.targetDateRange(
            goal: goal,
            now: now,
            calendar: calendar
        )
        let planningRange = SavingsGoalFormSheet.targetDateRange(
            goal: nil,
            now: now,
            calendar: calendar
        )

        #expect(range.upperBound == existingTarget)
        #expect(
            SavingsGoalFormSheet.isTargetDateSubmittable(
                existingTarget,
                original: goal,
                planningRange: planningRange,
                calendar: calendar
            )
        )
        #expect(
            !SavingsGoalFormSheet.isTargetDateSubmittable(
                intermediateTarget,
                original: goal,
                planningRange: planningRange,
                calendar: calendar
            )
        )
        #expect(
            SavingsGoalFormSheet.targetDateUpdate(
                for: existingTarget,
                original: goal,
                timeZone: calendar.timeZone
            ) == nil
        )
    }

    // MARK: - Initial amount patch diff (PUL-293)

    private func goalWithInitialAmount(_ amount: Decimal?) -> SavingsGoal {
        SavingsGoal(
            id: "goal-1",
            userId: "user-1",
            name: "Maison",
            targetAmount: 100_000,
            targetDate: "2030-05-15",
            status: .active,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0),
            initialAmount: amount
        )
    }

    @Test("an untouched initial amount omits the PATCH key")
    func initialAmountUpdate_omitsWhenUnchanged() {
        let goal = goalWithInitialAmount(5000)

        #expect(SavingsGoalFormSheet.initialAmountUpdate(for: 5000, original: goal) == nil)
    }

    @Test("a cleared field sends an explicit 0 — erasure, not omission")
    func initialAmountUpdate_clearedFieldSendsZero() {
        let goal = goalWithInitialAmount(5000)

        #expect(SavingsGoalFormSheet.initialAmountUpdate(for: nil, original: goal) == 0)
    }

    @Test("an empty field on a goal that never had one stays omitted (nil ≡ 0)")
    func initialAmountUpdate_neverSetStaysOmitted() {
        let goal = goalWithInitialAmount(nil)

        #expect(SavingsGoalFormSheet.initialAmountUpdate(for: nil, original: goal) == nil)
        #expect(SavingsGoalFormSheet.initialAmountUpdate(for: 0, original: goal) == nil)
    }

    @Test("a changed initial amount is sent")
    func initialAmountUpdate_sendsChangedValue() {
        let goal = goalWithInitialAmount(5000)

        #expect(SavingsGoalFormSheet.initialAmountUpdate(for: 7000, original: goal) == 7000)
    }

    @Test("a new decomposed goal rejects a zero monthly contribution")
    func monthlyContribution_zeroIsRejectedWhenDecomposing() {
        #expect(
            !SavingsGoalFormSheet.isMonthlyContributionSubmittable(
                isEditing: false,
                decomposeEnabled: true,
                hasRemainingToSave: true,
                contribution: 0
            )
        )
    }

    @Test("monthly contribution does not block creation when decomposition is disabled")
    func monthlyContribution_isIgnoredWithoutDecomposition() {
        #expect(
            SavingsGoalFormSheet.isMonthlyContributionSubmittable(
                isEditing: false,
                decomposeEnabled: false,
                hasRemainingToSave: true,
                contribution: 0
            )
        )
    }

    @Test("deletion presentation defaults to goal only")
    func deletionPresentation_defaultsToGoalOnly() {
        let presentation = GoalDeletionPresentation(
            impact: makeDeletionImpact()
        )

        #expect(presentation.mode == .goalOnly)
        #expect(presentation.command?.mode == .goalOnly)
    }

    @Test("transaction deletion requires forecasts and existing transactions")
    func deletionPresentation_transactionSelectionIsNested() {
        var presentation = GoalDeletionPresentation(
            impact: makeDeletionImpact()
        )

        presentation.setDeletesTransactions(true)
        #expect(presentation.mode == .goalOnly)

        presentation.setDeletesForecasts(true)
        presentation.setDeletesTransactions(true)
        #expect(presentation.mode == .goalForecastsAndTransactions)

        presentation.setDeletesForecasts(false)
        #expect(presentation.mode == .goalOnly)

        presentation.show(makeDeletionImpact(transactionCount: 0))
        presentation.setDeletesForecasts(true)
        presentation.setDeletesTransactions(true)
        #expect(presentation.mode == .goalAndForecasts)
    }

    @Test("deletion presentation keeps and sorts all 76 budgets")
    func deletionPresentation_keepsAllBudgets() {
        let presentation = GoalDeletionPresentation(
            impact: makeDeletionImpact(budgetCount: 76)
        )

        #expect(presentation.budgets.count == 76)
        #expect(presentation.budgets.first?.month == 1)
        #expect(presentation.budgets.first?.year == 2026)
        #expect(presentation.budgets.last?.month == 4)
        #expect(presentation.budgets.last?.year == 2032)
    }
}
