import Foundation
@testable import Pulpe
import Testing

struct SavingsGoalFormSheetTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return calendar
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

    @Test("a name-only open pot is valid")
    func form_nameOnlyIsValid() {
        #expect(
            SavingsGoalFormSheet.isFormSubmittable(
                name: "Imprévus",
                targetAmount: nil,
                startDate: nil,
                targetDate: nil
            )
        )
    }

    @Test("all four target and deadline combinations are valid")
    func form_acceptsEveryTargetDeadlineCombination() throws {
        let deadline = try #require(calendar.date(from: DateComponents(year: 2027, month: 1, day: 1)))
        let combinations: [(Decimal?, Date?)] = [
            (nil, nil),
            (10_000, nil),
            (nil, deadline),
            (10_000, deadline),
        ]

        for (targetAmount, targetDate) in combinations {
            #expect(
                SavingsGoalFormSheet.isFormSubmittable(
                    name: "Projet",
                    targetAmount: targetAmount,
                    startDate: nil,
                    targetDate: targetDate,
                    calendar: calendar
                )
            )
        }
    }

    @Test("a deadline without a target exposes a manual monthly contribution")
    func form_deadlineOnlyShowsManualContribution() {
        #expect(
            SavingsGoalFormSheet.showsManualMonthlyContribution(
                isEditing: false,
                hasTargetDate: true,
                targetAmount: nil
            )
        )
        #expect(
            SavingsGoalFormSheet.manualMonthlyContributionHint(hasTargetDate: true)
                == "Ce montant sera prévu chaque mois, jusqu'à l'échéance."
        )
        #expect(
            SavingsGoalFormSheet.manualMonthlyContributionHint(hasTargetDate: false)
                == "Ce montant alimentera ton pot chaque mois, sans échéance imposée."
        )
    }

    @Test("a start after the deadline is rejected")
    func form_rejectsInvertedInterval() throws {
        let start = try #require(calendar.date(from: DateComponents(year: 2027, month: 2, day: 1)))
        let target = try #require(calendar.date(from: DateComponents(year: 2027, month: 1, day: 1)))

        #expect(
            !SavingsGoalFormSheet.isFormSubmittable(
                name: "Maison",
                targetAmount: 10_000,
                startDate: start,
                targetDate: target,
                calendar: calendar
            )
        )
    }

    @Test("clearing target fields creates explicit-null PATCH values")
    func optionalFieldUpdates_clearWithNull() throws {
        let goal = goalWithInitialAmount(nil)
        let date = try #require(SavingsGoalDateFormatter.parse("2030-05-15"))

        #expect(SavingsGoalFormSheet.targetAmountUpdate(for: nil, original: goal) == .some(nil))
        #expect(
            SavingsGoalFormSheet.targetDateUpdate(
                for: date,
                isEnabled: false,
                original: goal
            ) == .some(nil)
        )
    }

    @Test("editing returns one complete patch with simultaneous changes")
    func editPayload_preservesEveryEditedField() throws {
        let goal = goalWithInitialAmount(5000)
        let start = try #require(SavingsGoalDateFormatter.parse("2028-01-15"))
        let target = try #require(SavingsGoalDateFormatter.parse("2029-04-27"))

        let patch = SavingsGoalFormSheet.editPayload(
            name: "  Nouvelle maison  ",
            targetAmount: 120_000,
            initialAmount: 7000,
            startDate: start,
            hasStartDate: true,
            targetDate: target,
            hasTargetDate: true,
            status: .paused,
            original: goal
        )

        #expect(patch.name == "Nouvelle maison")
        #expect(patch.targetAmount == .some(120_000))
        #expect(patch.initialAmount == 7000)
        #expect(patch.startDate == .some("2028-01-15"))
        #expect(patch.targetDate == .some("2029-04-27"))
        #expect(patch.status == .paused)
    }

    @Test("deadline preview is payDay-aware and requires two non-null dates")
    func deadlinePreviewTarget_obeysPeriodTransitions() {
        #expect(
            SavingsGoalDetailView.deadlinePreviewTarget(
                previous: "2030-05-27",
                update: .some("2030-05-26"),
                payDayOfMonth: 27
            ) == "2030-05-26"
        )
        #expect(
            SavingsGoalDetailView.deadlinePreviewTarget(
                previous: "2030-05-26",
                update: .some("2030-05-20"),
                payDayOfMonth: 27
            ) == nil,
            "Two earlier dates in the same budget period need no preview"
        )
        #expect(
            SavingsGoalDetailView.deadlinePreviewTarget(
                previous: nil,
                update: .some("2030-05-20"),
                payDayOfMonth: 27
            ) == nil
        )
        #expect(
            SavingsGoalDetailView.deadlinePreviewTarget(
                previous: "2030-05-27",
                update: .some(nil),
                payDayOfMonth: 27
            ) == nil
        )
    }

    @Test("generation-stop sheet exposes distinct status and deadline contexts")
    func generationStopContexts_haveDistinctCopy() {
        let status = GoalGenerationStopContext.status(.paused)
        let deadline = GoalGenerationStopContext.deadline(targetDate: "2030-05-26")

        #expect(status.title == "Objectif en pause")
        #expect(deadline.title == "Échéance avancée")
        #expect(deadline.removeLabel == "Supprimer les prévisions")
        #expect(deadline.isRemovalDestructive)
    }
}
