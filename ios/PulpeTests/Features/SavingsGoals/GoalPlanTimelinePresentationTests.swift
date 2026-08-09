import Foundation
@testable import Pulpe
import Testing

@Suite("GoalPlanTimelinePresentation Tests")
struct GoalPlanTimelinePresentationTests {
    @Test("distinguishes a materialized month without a linked forecast from a missing budget")
    func distinguishesUnlinkedForecastFromMissingBudget() {
        let august = makeMonth(month: 8, state: .future, hasLinkedForecast: true)
        let september = makeMonth(month: 9, state: .gap, hasBudget: true, isProvisionable: true)
        let november = makeMonth(month: 11, state: .gap, hasBudget: false, isProvisionable: true)

        #expect(GoalPlanMonthAvailability(month: august, canRepair: true).icon == nil)
        #expect(GoalPlanMonthAvailability(month: september, canRepair: true) == .repairableForecast)
        #expect(GoalPlanMonthAvailability(month: september, canRepair: true).label == "Épargne à ajouter")
        #expect(GoalPlanMonthAvailability(month: november, canRepair: true) == .missingBudget)
        #expect(GoalPlanMonthAvailability(month: november, canRepair: true).label == "Pas de budget")
    }

    @Test("drops the repairable chip when the plan offers no repair")
    func repairableChipRequiresAPlanLevelRepairOffer() {
        // `canRepairPlan` is false whenever the goal is inactive or its
        // required amount floors at 0 (an initial amount already covering the
        // target), while its empty future months stay provisionable. The row
        // must not promise « Épargne à ajouter » with no recap behind it.
        let september = makeMonth(month: 9, state: .gap, hasBudget: true, isProvisionable: true)

        #expect(GoalPlanMonthAvailability(month: september, canRepair: false) == .noLinkedForecast)
    }

    @Test("keeps locked and non-provisionable budgets neutral")
    func distinguishesNeutralUnlinkedForecasts() {
        // `locked` models a reachable state: a past, materialized month with
        // no linked line. `isProvisionable` stays at its default (false) —
        // isLocked implies !isProvisionable (shared/src/calculators/
        // savings-goal-plan.spec.ts's invariant test), so a real locked month
        // is already non-provisionable; `isLocked: true` alone is enough to
        // exercise the neutral path.
        let locked = makeMonth(
            month: 9,
            state: .past,
            isLocked: true
        )
        let nonProvisionable = makeMonth(month: 10, state: .future)

        for month in [locked, nonProvisionable] {
            // canRepair: true so the neutral verdict comes from the month
            // itself, not from a plan that offers no repair at all.
            let availability = GoalPlanMonthAvailability(month: month, canRepair: true)
            #expect(availability == .noLinkedForecast)
            #expect(availability.label == "Aucune épargne prévue")
            #expect(availability.icon != nil)
        }
    }

    @Test("keeps the current month plus three future months collapsed and exposes the full plan expanded")
    func windowsAndExpandsThePlan() {
        let months = [
            makeMonth(month: 7, state: .current, hasLinkedForecast: true),
            makeMonth(month: 8, state: .future, hasLinkedForecast: true),
            makeMonth(month: 9, state: .gap),
            makeMonth(month: 10, state: .gap),
            makeMonth(month: 11, state: .gap, isProvisionable: true),
        ]

        let collapsed = GoalPlanTimelinePresentation(months: months, isExpanded: false)
        let expanded = GoalPlanTimelinePresentation(months: months, isExpanded: true)

        #expect(collapsed.visibleMonths.map(\.month) == [7, 8, 9, 10])
        #expect(collapsed.hiddenCount == 1)
        #expect(collapsed.remainingUnlinkedMonthCount == 3)
        #expect(collapsed.repairableMonths.map(\.month) == [11])
        #expect(expanded.visibleMonths.map(\.month) == [7, 8, 9, 10, 11])
        #expect(expanded.hiddenCount == 0)
    }

    @Test("counts only isRepairable months regardless of position, matching the recap and create set")
    func repairableMonths_ignoresPositionAndMatchesTheUnwindowedRepairableSet() {
        // month 5 sits BEFORE currentIndex (month 6) yet is genuinely
        // repairable (unlocked, provisionable, no lines) — the old
        // `months.dropFirst(currentIndex)` windowing would have dropped it.
        // `isLocked` is decoded straight off the DTO, not recomputed, so a
        // past-but-unlocked month is a real, constructible server state.
        let months = [
            makeMonth(month: 4, state: .past, isLocked: true, hasLinkedForecast: true),
            makeMonth(month: 5, state: .past, isLocked: false, isProvisionable: true),
            makeMonth(month: 6, state: .current, isProvisionable: true),
            makeMonth(month: 7, state: .future, isProvisionable: true),
            makeMonth(month: 8, state: .future, hasLinkedForecast: true),
        ]

        let presentation = GoalPlanTimelinePresentation(months: months, isExpanded: false)

        #expect(presentation.repairableMonths.map(\.month) == [5, 6, 7])
        #expect(presentation.repairableMonths.count == 3)
    }

    @Test("uses natural agreement for one or several repairable forecasts")
    func repairMessage_usesNaturalAgreement() {
        let current = makeMonth(month: 7, state: .current, hasLinkedForecast: true)
        let august = makeMonth(month: 8, state: .gap, isProvisionable: true)
        let september = makeMonth(month: 9, state: .gap, isProvisionable: true)

        let singular = GoalPlanTimelinePresentation(
            months: [current, august],
            isExpanded: false
        )
        let plural = GoalPlanTimelinePresentation(
            months: [current, august, september],
            isExpanded: false
        )

        #expect(
            singular.repairMessage
                == "1 prévision Épargne peut maintenant être ajoutée automatiquement."
        )
        #expect(
            plural.repairMessage
                == "2 prévisions Épargne peuvent maintenant être ajoutées automatiquement."
        )
    }

    @Test("starts the collapsed window at the current month when the plan contains history")
    func excludesPastMonthsFromCollapsedWindow() {
        let months = [
            makeMonth(month: 4, state: .past, hasLinkedForecast: true),
            makeMonth(month: 5, state: .past, hasLinkedForecast: true),
            makeMonth(month: 6, state: .past, hasLinkedForecast: true),
            makeMonth(month: 7, state: .current, hasLinkedForecast: true),
            makeMonth(month: 8, state: .future, hasLinkedForecast: true),
            makeMonth(month: 9, state: .gap),
            makeMonth(month: 10, state: .gap),
            makeMonth(month: 11, state: .gap, isProvisionable: true),
        ]

        let collapsed = GoalPlanTimelinePresentation(months: months, isExpanded: false)

        #expect(collapsed.visibleMonths.map(\.month) == [7, 8, 9, 10])
        #expect(collapsed.hiddenCount == 4)
    }

    @Test("counts unlinked forecasts from the current month while preserving history")
    func countsRemainingUnlinkedForecasts() {
        let months = [
            makeMonth(month: 4, state: .gap, isLocked: true),
            makeMonth(month: 5, state: .past, isLocked: true, hasLinkedForecast: true),
            makeMonth(month: 6, state: .gap, isLocked: true),
            makeMonth(month: 7, state: .current),
            makeMonth(month: 8, state: .future, hasLinkedForecast: true),
            makeMonth(month: 9, state: .gap),
            makeMonth(month: 10, state: .gap, isProvisionable: true),
        ]

        let collapsed = GoalPlanTimelinePresentation(months: months, isExpanded: false)
        let expanded = GoalPlanTimelinePresentation(months: months, isExpanded: true)

        #expect(expanded.visibleMonths.map(\.month) == [4, 5, 6, 7, 8, 9, 10])
        #expect(GoalPlanMonthAvailability(month: months[0]) == .noLinkedForecast)
        #expect(collapsed.remainingUnlinkedMonthCount == 3)
    }

    // MARK: - Announced withdrawals (PUL-329 v2)

    /// An announcement takes nothing out yet: it moves neither the contribution
    /// nor the cumulative shown here. Without a sub-line the month says nothing
    /// about the 500 it plans to release, and the simulator's editable field
    /// would look like the place to type it.
    @Test("States what a contributing month announces it will take out")
    func announcedWithdrawal_readsOnTheMonthThatCarriesIt() throws {
        let announced = try #require(GoalPlanMonthRow.plannedWithdrawalText(
            for: makeWithdrawalMonth(planned: 500, remaining: 500, withdrawn: 0),
            currency: .chf
        ))

        #expect(announced.contains("Retrait prévu"))
        // Signed and aggregated, like every other stock exit on this screen.
        #expect(announced.contains("500"))
        #expect(announced.contains("-"))
    }

    /// The gross announcement is what the month declares; the part already taken
    /// out lives in the confirmed stock. Keeping it gross is what stops the row
    /// from telling the same 500 twice.
    @Test("Keeps announcing the gross amount once the withdrawal is realized")
    func announcedWithdrawal_staysGrossAfterRealization() {
        let realized = GoalPlanMonthRow.plannedWithdrawalText(
            for: makeWithdrawalMonth(planned: 500, remaining: 0, withdrawn: 500),
            currency: .chf
        )
        let ordinary = GoalPlanMonthRow.plannedWithdrawalText(
            for: makeMonth(month: 8, state: .future, hasLinkedForecast: true),
            currency: .chf
        )

        #expect(realized?.contains("500") == true)
        #expect(ordinary == nil)
    }

    @Test("A frozen month opens only the plan-linked income budget from the same period")
    func frozenMonth_resolvesOnlyPlanLinkedBudgetForItsPeriod() {
        let month = makeWithdrawalMonth(
            planned: 500,
            remaining: 250,
            withdrawn: 250,
            consumed: 250
        )
        let neighboringIncome = makePlannedWithdrawal(
            budgetId: "budget-neighbor",
            month: 8,
            origin: nil
        )
        let otherPeriod = makePlannedWithdrawal(
            budgetId: "budget-other-month",
            month: 9,
            origin: .planLinked
        )
        let planLinkedIncome = makePlannedWithdrawal(
            budgetId: "budget-plan-linked",
            month: 8,
            origin: .planLinked
        )

        #expect(GoalPlanTimelinePresentation.budgetId(
            forFrozenMonth: month,
            plannedWithdrawals: [neighboringIncome, otherPeriod, planLinkedIncome]
        ) == "budget-plan-linked")
    }

    @Test("A frozen month without an identified plan origin stays non-interactive")
    func frozenMonth_withoutPlanLinkedOriginHasNoBudgetAction() {
        let month = makeWithdrawalMonth(
            planned: 500,
            remaining: 250,
            withdrawn: 250,
            consumed: 250
        )

        #expect(GoalPlanTimelinePresentation.budgetId(
            forFrozenMonth: month,
            plannedWithdrawals: [makePlannedWithdrawal(
                budgetId: "budget-unknown-origin",
                month: 8,
                origin: nil
            )]
        ) == nil)
    }

    private func makeWithdrawalMonth(
        planned: Decimal,
        remaining: Decimal,
        withdrawn: Decimal,
        consumed: Decimal = 0
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: 8,
            year: 2026,
            state: .future,
            isLocked: false,
            hasBudget: true,
            plannedAmount: 450,
            confirmedAmount: 0,
            withdrawnAmount: withdrawn,
            plannedWithdrawalAmount: planned,
            remainingPlannedWithdrawalAmount: remaining,
            planWithdrawalConsumedAmount: consumed,
            plannedCumulative: 3_600,
            confirmedCumulative: 0,
            projectedCumulative: 3_600 - remaining,
            lines: []
        )
    }

    private func makePlannedWithdrawal(
        budgetId: String,
        month: Int,
        origin: SavingsGoalPlannedWithdrawal.Origin?
    ) -> SavingsGoalPlannedWithdrawal {
        SavingsGoalPlannedWithdrawal(
            budgetLineId: "line-\(budgetId)",
            budgetId: budgetId,
            name: "Retrait Maison",
            month: month,
            year: 2026,
            plannedAmount: 500,
            realizedAmount: 250,
            remainingAmount: 250,
            status: .partiallyRealized,
            origin: origin
        )
    }

    private func makeMonth(
        month: Int,
        state: SavingsPlanMonthState,
        isLocked: Bool = false,
        hasBudget: Bool = true,
        isProvisionable: Bool = false,
        hasLinkedForecast: Bool = false
    ) -> SavingsGoalPlanMonth {
        let lines = hasLinkedForecast
            ? [
                SavingsGoalPlanLine(
                    budgetLineId: "line-\(month)",
                    amount: 500,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ]
            : []

        return SavingsGoalPlanMonth(
            month: month,
            year: 2026,
            state: state,
            isLocked: isLocked,
            hasBudget: hasBudget,
            isProvisionable: isProvisionable,
            plannedAmount: hasLinkedForecast ? 500 : 0,
            confirmedAmount: 0,
            plannedCumulative: month <= 8 ? Decimal(month - 6) * 500 : 1_000,
            confirmedCumulative: 1_000,
            lines: lines
        )
    }
}
