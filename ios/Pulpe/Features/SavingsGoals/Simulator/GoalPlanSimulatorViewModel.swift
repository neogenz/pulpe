import Foundation

/// Sandbox for the plan simulator: immutable server baseline, user overrides,
/// and a live client-side draft. The server stays authoritative at write time.
@Observable @MainActor
final class GoalPlanSimulatorViewModel {
    private let goalId: String
    private let currency: SupportedCurrency
    private let baseline: [SavingsGoalPlanMonth]
    private let targetAmount: Decimal?
    private let confirmedAmount: Decimal
    private let initialAmount: Decimal // PUL-293 seed for every simulate/redistribute call below
    private let service: any SavingsGoalServicing

    /// Deadline period for the early/on-time verdict — refined once payDay lands.
    private var deadlineDate: Date?
    private var deadlinePeriod: BudgetPeriod?

    private(set) var overrides: [Int: Decimal] = [:]
    private(set) var globalAmount: Decimal?
    private(set) var sliderValue: Double = 0
    private(set) var draft: SavingsPlanCalculator.SimulationResult
    private(set) var isDirty = false
    private(set) var isApplying = false
    private(set) var didApplySucceed = false
    private(set) var didEncounterPlanConflict = false
    private(set) var applyErrorMessage: String?

    let sliderMax: Double

    init(
        goal: SavingsGoal,
        progress: SavingsGoalProgress,
        currency: SupportedCurrency,
        payDay: Int?,
        service: any SavingsGoalServicing = SavingsGoalService.shared
    ) {
        goalId = goal.id
        self.currency = currency
        self.service = service
        baseline = progress.months
        targetAmount = progress.targetAmount
        confirmedAmount = progress.confirmed
        initialAmount = progress.initialAmount

        deadlineDate = goal.targetDateValue
        deadlinePeriod = goal.targetDateValue.map {
            BudgetPeriodCalculator.periodForDate($0, payDayOfMonth: payDay)
        }

        let openPlannedMax = progress.months
            .filter { SavingsPlanCalculator.isOpenPlanMonth($0) }
            .map(\.plannedAmount)
            .max() ?? 0
        let ceilingBase = max(progress.required ?? 0, progress.pace, openPlannedMax)
        let doubled = NSDecimalNumber(decimal: ceilingBase * 2).doubleValue
        sliderMax = max(100, (doubled / 100).rounded(.up) * 100)

        draft = (try? SavingsPlanCalculator.simulate(
            timeline: progress.months,
            targetAmount: progress.targetAmount,
            initialAmount: progress.initialAmount
        )) ?? SavingsPlanCalculator.SimulationResult(
            months: [],
            simulatedFinal: 0,
            gapToTarget: progress.targetAmount,
            isTargetMet: progress.targetAmount.map { $0.rounded(2) <= 0 },
            attainedPeriod: nil
        )
        syncGlobalControlFromDraft()
    }

    var chartSeries: GoalProjectionSeries {
        .simulation(from: draft, targetAmount: targetAmount, confirmedAmount: confirmedAmount)
    }

    /// The adjusted, contributive months — the write footprint and recap rows.
    /// Excludes a zero-valued gap creation unless it clears an existing plan
    /// withdrawal. The latter remains a real write and must reach the recap.
    var planChanges: [SavingsPlanCalculator.SimulatedMonth] {
        draft.months.filter {
            SavingsPlanCalculator.isContributivePlanMonth($0.month)
                && $0.isAdjusted
                && !(
                    $0.month.isProvisionable
                        && $0.simulatedAmount == 0
                        && !$0.replacesExistingPlanWithdrawal
                )
        }
    }

    var canApply: Bool {
        isDirty && !planChanges.isEmpty && !isApplying && !didEncounterPlanConflict
    }

    var hasVariableMonthlyAmounts: Bool {
        let amounts = draft.months
            .filter { SavingsPlanCalculator.isContributivePlanMonth($0.month) }
            .map(\.simulatedAmount)
        guard let first = amounts.first else { return false }
        return amounts.dropFirst().contains { $0 != first }
    }

    private var redistributePreview: SavingsPlanCalculator.RedistributeResult {
        SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: baseline,
            targetAmount: targetAmount,
            pinnedAdjustments: pinnedAdjustments,
            initialAmount: initialAmount
        )
    }

    var canRedistribute: Bool { redistributePreview.isDistributable }
    var redistributePerMonth: Decimal { redistributePreview.perRemainingMonth }

    var verdictText: String {
        guard targetAmount != nil else {
            return AppLocale.string(
                "Avec ce plan, tu auras prévu \(draft.simulatedFinal.asAdaptiveCurrency(currency))."
            )
        }
        guard let attained = draft.attainedPeriod else {
            let gap = draft.gapToTarget ?? 0
            return AppLocale.string("Avec ce plan, il te manque \(gap.asAdaptiveCurrency(currency)) pour ta cible.")
        }
        let label = "\(Formatters.monthNameInText(for: attained.month)) \(attained.year)"
        if let deadlinePeriod,
           BudgetPeriodCalculator.comparePeriods(attained, deadlinePeriod) < 0 {
            return AppLocale.string("Avec ce plan, tu atteins ta cible dès \(label), en avance.")
        }
        return AppLocale.string("Avec ce plan, tu atteins ta cible en \(label).")
    }

    func simulatedAmount(forKey key: Int) -> Decimal { draft.months.first { $0.id == key }?.simulatedAmount ?? 0 }

    func setPayDay(_ payDay: Int?) {
        deadlinePeriod = deadlineDate.map {
            BudgetPeriodCalculator.periodForDate($0, payDayOfMonth: payDay)
        }
    }

    /// Slider / twin field — sets a uniform amount and wipes per-month overrides.
    func setGlobalAmount(_ amount: Decimal) {
        guard amount >= 0 else { return }
        globalAmount = amount
        overrides = [:]
        sliderValue = min(NSDecimalNumber(decimal: amount).doubleValue, sliderMax)
        recompute()
    }

    /// Per-month inline edit — overrides that month, keeps the rest.
    func setMonth(key: Int, amount: Decimal) {
        let baselineAmount = globalAmount
            ?? baseline.first(where: { $0.id == key }).map(SavingsPlanCalculator.currentPlanMovement)
        if baselineAmount == amount { overrides.removeValue(forKey: key) } else { overrides[key] = amount }
        recompute()
    }

    /// « Réajuster la suite » — fills every open month with the redistributed share.
    func redistribute() {
        let result = redistributePreview
        guard result.isDistributable else { return }
        let redistributed = Dictionary(uniqueKeysWithValues: result.adjustments.map { adjustment in
            (adjustment.year * 12 + adjustment.month, adjustment.amount)
        })
        overrides.merge(redistributed) { _, redistributedAmount in redistributedAmount }
        globalAmount = nil
        recompute()
    }

    /// « Réinitialiser » — clears every edit back to the current plan.
    func revert() {
        overrides = [:]
        globalAmount = nil
        recompute()
    }

    func apply(
        withdrawalDestinations: GoalPlanWithdrawalDestinations = [:]
    ) async -> Bool {
        guard beginApplying() else { return false }
        defer { isApplying = false }

        let monthAdjustments = planChanges
            .filter { SavingsPlanCalculator.isOpenPlanMonth($0.month) && $0.simulatedAmount >= 0 }
            .flatMap { simMonth -> [SavingsGoalPlanApply.MonthAdjustment] in
                let lines: [SavingsPlanCalculator.AllocatableLine] = simMonth.month.lines.map {
                    .init(budgetLineId: $0.budgetLineId, amount: $0.amount, checkedAt: $0.checkedAt)
                }
                return SavingsPlanCalculator.allocateMonthAmountToLines(
                    lines,
                    newMonthAmount: simMonth.simulatedAmount
                )
                .map { .init(budgetLineId: $0.budgetLineId, amount: $0.amount) }
            }
        // A zero-valued creation describes nothing to create. The server drops
        // it too (older clients still send it), but there is no point spending
        // a round-trip carrying an instruction that means nothing.
        let missingMonthAdjustments: [SavingsGoalPlanApply.MissingMonthAdjustment] = planChanges
            .filter { $0.month.isProvisionable && $0.simulatedAmount > 0 }
            .map { .init(month: $0.month.month, year: $0.month.year, amount: $0.simulatedAmount) }
        let planWithdrawalAdjustments: [SavingsGoalPlanApply.PlanWithdrawalAdjustment] =
            planChanges.compactMap { simMonth in
                guard simMonth.simulatedAmount < 0
                        || simMonth.replacesExistingPlanWithdrawal else { return nil }
                return .init(
                    month: simMonth.month.month,
                    year: simMonth.month.year,
                    amount: min(0, simMonth.simulatedAmount),
                    destination: withdrawalDestination(
                        for: simMonth,
                        selections: withdrawalDestinations
                    )
                )
            }

        guard !monthAdjustments.isEmpty || !missingMonthAdjustments.isEmpty
                || !planWithdrawalAdjustments.isEmpty else { return false }

        let payload = SavingsGoalPlanApply(
            monthAdjustments: monthAdjustments,
            missingMonthAdjustments: missingMonthAdjustments,
            planWithdrawalAdjustments: planWithdrawalAdjustments
        )
        do {
            _ = try await service.applyPlan(id: goalId, payload)
            didApplySucceed = true
            return true
        } catch let error as APIError where error.requiresSavingsGoalPlanRefresh {
            invalidateAfterPlanConflict(error)
            return false
        } catch {
            applyErrorMessage = DomainErrorLocalizer.localize(error)
            return false
        }
    }

    private func beginApplying() -> Bool {
        guard !isApplying, !didEncounterPlanConflict else { return false }
        isApplying = true
        applyErrorMessage = nil
        return true
    }

    private func invalidateAfterPlanConflict(_ error: APIError) {
        didEncounterPlanConflict = true
        revert()
        applyErrorMessage = DomainErrorLocalizer.localize(error)
    }

    private func withdrawalDestination(
        for simMonth: SavingsPlanCalculator.SimulatedMonth,
        selections: GoalPlanWithdrawalDestinations
    ) -> SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination {
        // A zero adjustment deletes the existing withdrawal. Its destination
        // has no write effect, but preserving it avoids describing the deletion
        // as an implicit conversion.
        guard simMonth.simulatedAmount < 0 else {
            return simMonth.month.planWithdrawalDestination ?? .goalOnly
        }
        let selected = selections[simMonth.id]
            ?? simMonth.month.planWithdrawalDestination
            ?? .goalOnly
        guard !simMonth.month.hasBudget, selected == .linkedIncome else { return selected }
        return simMonth.month.planWithdrawalDestination == .linkedIncome ? .linkedIncome : .goalOnly
    }

    private func recompute() {
        let byKey = Dictionary(uniqueKeysWithValues: baseline.map { ($0.id, $0) })
        let adjustments = overrides.compactMap { key, amount -> SavingsPlanCalculator.Adjustment? in
            guard let month = byKey[key] else { return nil }
            return .init(
                month: month.month,
                year: month.year,
                amount: amount
            )
        }
        if let next = try? SavingsPlanCalculator.simulate(
            timeline: baseline,
            targetAmount: targetAmount,
            adjustments: adjustments,
            globalMonthlyAmount: globalAmount,
            initialAmount: initialAmount
        ) {
            draft = next
        }
        isDirty = !planChanges.isEmpty
        syncGlobalControlFromDraft()
    }

    private var pinnedAdjustments: [SavingsPlanCalculator.Adjustment] {
        let byKey = Dictionary(uniqueKeysWithValues: baseline.map { ($0.id, $0) })
        return overrides.compactMap { key, amount in
            guard let month = byKey[key] else { return nil }
            return .init(
                month: month.month,
                year: month.year,
                amount: amount
            )
        }
    }

    private func syncGlobalControlFromDraft() {
        if let globalAmount {
            sliderValue = min(NSDecimalNumber(decimal: globalAmount).doubleValue, sliderMax)
            return
        }

        let amounts = draft.months
            .filter { SavingsPlanCalculator.isContributivePlanMonth($0.month) }
            .map(\.simulatedAmount)
        guard let first = amounts.first else {
            globalAmount = nil
            sliderValue = 0
            return
        }
        if first < 0 {
            globalAmount = nil
            sliderValue = 0
            return
        }
        globalAmount = amounts.dropFirst().allSatisfy { $0 == first } ? first : nil
        sliderValue = min(NSDecimalNumber(decimal: first).doubleValue, sliderMax)
    }
}
