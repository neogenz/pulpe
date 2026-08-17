import Foundation

/// SAVINGS GOAL PLAN — client-side monthly simulation (PUL-12+).
///
/// iOS mirror of `shared/src/calculators/savings-goal-plan.ts`. All pure.
///
/// `buildSavingsGoalTimeline` is deliberately NOT mirrored: the server sends
/// `months[]` on `GET /savings-goals/:id/progress`, so the client reads
/// `[SavingsGoalPlanMonth]` directly and never rebuilds the timeline. The three
/// simulator functions ARE mirrored 1:1 with the TS so the live preview equals
/// what the server persists — the server stays authoritative at write time (it
/// recomputes progression after apply). Same doctrine as `SpreadSplit` / PUL-17.
///
/// Amounts run in `Decimal` (never `Double`) except the proportional
/// largest-remainder split in `allocateMonthAmountToLines`, which mirrors the TS
/// float ratios exactly so the two implementations can never drift.
enum SavingsPlanCalculator {
    private static let centsPerUnit = 100

    // MARK: - Types

    /// A per-month override targeting an open plan month.
    struct Adjustment: Sendable, Equatable {
        let month: Int
        let year: Int
        let amount: Decimal

        init(
            month: Int,
            year: Int,
            amount: Decimal
        ) {
            self.month = month
            self.year = year
            self.amount = amount
        }
    }

    /// A timeline month enriched with its simulated figures.
    struct SimulatedMonth: Sendable, Equatable, Identifiable {
        let month: SavingsGoalPlanMonth
        let simulatedAmount: Decimal
        let simulatedCumulative: Decimal
        let isAdjusted: Bool
        let replacesExistingPlanWithdrawal: Bool

        var id: Int { month.id }
    }

    struct SimulationResult: Sendable, Equatable {
        let months: [SimulatedMonth]
        /// Cumulé final : reality (locked months) + simulated plan (open months).
        let simulatedFinal: Decimal
        /// `targetAmount − simulatedFinal` — signed, nil without a target.
        let gapToTarget: Decimal?
        let isTargetMet: Bool?
        /// First month whose simulated cumulative reaches the target.
        let attainedPeriod: BudgetPeriod?
    }

    struct RedistributeResult: Sendable, Equatable {
        let adjustments: [Adjustment]
        let remainingEffort: Decimal
        let perRemainingMonth: Decimal
        let isDistributable: Bool
    }

    struct AllocatableLine: Sendable, Equatable {
        let budgetLineId: String
        let amount: Decimal
        let checkedAt: String?
    }

    struct LineAllocation: Sendable, Equatable {
        let budgetLineId: String
        let amount: Decimal
    }

    enum SimulationError: Error, Equatable {
        /// An adjustment targeted a locked, gap, or pre-start month — reveals a UI bug in dev
        /// (same doctrine as `splitTotalPreserving` throwing on a non-positive total).
        case adjustmentTargetsLockedOrGapMonth
    }

    // MARK: - Simulate

    /// Simulates the plan: each locked month keeps its reality (`confirmedAmount`),
    /// each open month takes `adjustment ?? globalMonthlyAmount ?? plannedAmount`.
    /// Its cumulative value can never fall below the amount already confirmed that month.
    /// Targeting a locked or gap month via `adjustments` throws.
    /// `initialAmount` (PUL-293 stock de départ) seeds `simulatedCumulative`.
    static func simulate(
        timeline: [SavingsGoalPlanMonth],
        targetAmount: Decimal?,
        adjustments: [Adjustment] = [],
        globalMonthlyAmount: Decimal? = nil,
        initialAmount: Decimal = 0
    ) throws -> SimulationResult {
        let adjustmentsByKey = try validatedAdjustmentsByPeriod(
            adjustments,
            timeline: timeline
        )

        var months: [SimulatedMonth] = []
        var simulatedCumulative: Decimal = initialAmount
        var attainedPeriod: BudgetPeriod?

        for month in timeline {
            let key = periodKey(month: month.month, year: month.year)
            let isContributive = isContributivePlanMonth(month)
            let movement = resolveMonthMovement(
                month: month,
                isContributive: isContributive,
                adjustment: adjustmentsByKey[key],
                globalMonthlyAmount: globalMonthlyAmount
            )

            if month.isContributionEligible {
                simulatedCumulative += movement.isWithdrawal
                    ? max(month.plannedAmount, month.confirmedAmount) + movement.amount
                    : max(movement.amount, month.confirmedAmount)
            }

            // Outside the guard, and AFTER the max: a retrait is a stock outflow.
            // It never competes with the month's contribution, and it does not
            // depend on the contribution window — a goal opened with a starting
            // stock can be drawn on before its first planned line.
            //
            // A retrait ANNONCÉ weighs only for the part not yet taken, which the
            // server already deducted per month: adding the full announced amount
            // would count the realized part twice.
            let budgetPlannedWithdrawal = normalizedWithdrawalRemainder(
                month.remainingPlannedWithdrawalAmount - (
                    movement.replacesExistingPlanWithdrawal
                        ? month.planOnlyWithdrawalAmount + month.planLinkedWithdrawalAmount
                        : 0
                )
            )
            simulatedCumulative -= month.withdrawnAmount + budgetPlannedWithdrawal
            if let targetAmount,
               attainedPeriod == nil,
               month.isContributionEligible,
               targetAmount.rounded(2) > 0,
               simulatedCumulative.rounded(2) >= targetAmount.rounded(2) {
                attainedPeriod = month.period
            }

            months.append(SimulatedMonth(
                month: month, simulatedAmount: movement.amount,
                simulatedCumulative: simulatedCumulative, isAdjusted: movement.isAdjusted,
                replacesExistingPlanWithdrawal: movement.replacesExistingPlanWithdrawal
            ))
        }

        return simulationResult(
            months: months,
            simulatedFinal: simulatedCumulative,
            targetAmount: targetAmount,
            attainedPeriod: attainedPeriod
        )
    }

    private static func simulationResult(
        months: [SimulatedMonth],
        simulatedFinal: Decimal,
        targetAmount: Decimal?,
        attainedPeriod: BudgetPeriod?
    ) -> SimulationResult {
        let isTargetMet = targetAmount.map {
            $0.rounded(2) > 0 && simulatedFinal.rounded(2) >= $0.rounded(2)
        }
        return SimulationResult(
            months: months, simulatedFinal: simulatedFinal,
            gapToTarget: targetAmount.map {
                $0.rounded(2) - simulatedFinal.rounded(2)
            },
            isTargetMet: isTargetMet,
            // A retrait makes the curve non-monotonic: a cumulative can cross the
            // target and then fall back under it. Announcing « atteint en mars »
            // under a final below the target would make the verdict lie.
            attainedPeriod: isTargetMet == false ? nil : attainedPeriod
        )
    }

    private static func validatedAdjustmentsByPeriod(
        _ adjustments: [Adjustment],
        timeline: [SavingsGoalPlanMonth]
    ) throws -> [Int: Adjustment] {
        let adjustmentsByKey = latestAdjustmentsByPeriod(adjustments)
        let contributiveKeys = Set(timeline
            .filter(isContributivePlanMonth)
            .map { periodKey(month: $0.month, year: $0.year) })
        guard adjustmentsByKey.keys.allSatisfy(contributiveKeys.contains) else {
            throw SimulationError.adjustmentTargetsLockedOrGapMonth
        }
        return adjustmentsByKey
    }

    private static func latestAdjustmentsByPeriod(
        _ adjustments: [Adjustment]
    ) -> [Int: Adjustment] {
        Dictionary(
            adjustments.map { (periodKey(month: $0.month, year: $0.year), $0) },
            uniquingKeysWith: { _, latest in latest }
        )
    }
}

extension SavingsPlanCalculator {
    // MARK: - Redistribute remaining effort

    /// « Réajuster la suite » — spreads the remaining effort over the open,
    /// non-pinned months cents-exact via `SpreadSplit`. Generalisation of PUL-290
    /// (`remainingToProvision` / `perRemainingMonth`).
    ///
    /// `remaining = max(0, target − initialAmount − Σ confirmed(locked months)
    /// + Σ (withdrawn + remainingPlannedWithdrawal)(every month) − Σ pinned
    /// open)`. A retrait enters with a plus — money taken back is effort to
    /// redo, announced or already gone. It is summed over EVERY month of the
    /// timeline, unconditionally: that is exactly the set `simulate` subtracts,
    /// and the equality is what makes the simulation land back on the target.
    /// `isDistributable = false` when no open, non-pinned month remains (overdue).
    /// `initialAmount` (PUL-293 stock de départ) is deducted before distributing.
    static func redistributeRemainingEffort(
        timeline: [SavingsGoalPlanMonth],
        targetAmount: Decimal?,
        pinnedAdjustments: [Adjustment] = [],
        initialAmount: Decimal = 0
    ) -> RedistributeResult {
        guard let targetAmount else {
            return RedistributeResult(
                adjustments: [],
                remainingEffort: 0,
                perRemainingMonth: 0,
                isDistributable: false
            )
        }

        let pinnedByKey = latestAdjustmentsByPeriod(pinnedAdjustments)

        let openMonths = timeline.filter { isContributivePlanMonth($0) }
        let openUnpinned = openMonths.filter { pinnedByKey[periodKey(month: $0.month, year: $0.year)] == nil }

        // A frozen month is not a hole: its amount is settled, not impossible.
        // Counting it here would cut redistribution across the WHOLE plan as soon
        // as one withdrawal starts being realized.
        let hasUnavailablePeriod = timeline.contains {
            $0.isContributionEligible && !$0.isLocked
                && !isPlanWithdrawalFrozenMonth($0) && !isContributivePlanMonth($0)
        }
        let willRedistribute = !hasUnavailablePeriod && !openUnpinned.isEmpty

        let lockedConfirmedSum = timeline
            .filter { $0.isContributionEligible && $0.isLocked }
            .reduce(Decimal(0)) { $0 + $1.confirmedAmount }

        let withdrawnSum = withdrawalEffort(
            timeline,
            pinnedByKey: pinnedByKey,
            willRedistribute: willRedistribute
        )
        let pinnedEffect = signedPinnedEffect(openMonths, pinnedByKey: pinnedByKey)

        let settled = initialAmount + lockedConfirmedSum - withdrawnSum - pinnedEffect
        let remaining = max(0, targetAmount.rounded(2) - settled.rounded(2))

        if hasUnavailablePeriod || openUnpinned.isEmpty {
            return RedistributeResult(
                adjustments: [],
                remainingEffort: remaining,
                perRemainingMonth: 0,
                isDistributable: false
            )
        }

        let shares: [Decimal] = remaining == 0
            ? Array(repeating: 0, count: openUnpinned.count)
            : SpreadSplit.splitTotalPreserving(total: remaining, partCount: openUnpinned.count)

        let adjustments = zip(openUnpinned, shares).map { month, share in
            Adjustment(month: month.month, year: month.year, amount: share)
        }

        return RedistributeResult(
            adjustments: adjustments,
            remainingEffort: remaining,
            perRemainingMonth: shares.first ?? 0,
            isDistributable: true
        )
    }

    private static func withdrawalEffort(
        _ timeline: [SavingsGoalPlanMonth],
        pinnedByKey: [Int: Adjustment],
        willRedistribute: Bool
    ) -> Decimal {
        timeline.reduce(Decimal(0)) { partial, month in
            let pinned = pinnedByKey[periodKey(month: month.month, year: month.year)]
            let replacesExisting = managedPlanWithdrawalAmount(month) > 0
                && (pinned != nil || (willRedistribute && isContributivePlanMonth(month)))
            let remaining = month.remainingPlannedWithdrawalAmount - (
                replacesExisting
                    ? month.planOnlyWithdrawalAmount + month.planLinkedWithdrawalAmount
                    : 0
            )
            return partial + month.withdrawnAmount + normalizedWithdrawalRemainder(remaining)
        }
    }

    private static func normalizedWithdrawalRemainder(_ amount: Decimal) -> Decimal {
        let roundedAmount = amount.rounded(2)
        return roundedAmount > 0 ? roundedAmount : 0
    }

    private static func signedPinnedEffect(
        _ openMonths: [SavingsGoalPlanMonth],
        pinnedByKey: [Int: Adjustment]
    ) -> Decimal {
        openMonths.reduce(Decimal(0)) { partial, month in
            guard let pin = pinnedByKey[periodKey(month: month.month, year: month.year)] else {
                return partial
            }
            let preservedContribution = pin.amount < 0
                ? max(month.plannedAmount, month.confirmedAmount)
                : 0
            return partial - pin.amount - preservedContribution
        }
    }

    // MARK: - Allocate a month total across its lines

    /// Distributes a monthly total across the UNCHECKED lines of a month,
    /// cents-exact (largest-remainder), proportional to the current amounts.
    /// The requested amount is the complete month total, so checked amounts are
    /// deducted before distributing the remainder. Current open sum zero → equal
    /// split. No remainder → every open line at 0. Checked lines are untouched.
    static func allocateMonthAmountToLines(
        _ lines: [AllocatableLine],
        newMonthAmount: Decimal
    ) -> [LineAllocation] {
        let openLines = lines.filter { $0.checkedAt == nil }
        guard !openLines.isEmpty else { return [] }

        let checkedSum = lines
            .filter { $0.checkedAt != nil }
            .reduce(Decimal(0)) { $0 + $1.amount }
        let openTarget = max(0, newMonthAmount - checkedSum)

        if openTarget <= 0 {
            return openLines.map { LineAllocation(budgetLineId: $0.budgetLineId, amount: 0) }
        }

        let currentSum = openLines.reduce(Decimal(0)) { $0 + $1.amount }
        if currentSum <= 0 {
            let shares = SpreadSplit.splitTotalPreserving(total: openTarget, partCount: openLines.count)
            return zip(openLines, shares).map { LineAllocation(budgetLineId: $0.budgetLineId, amount: $1) }
        }

        let totalCents = NSDecimalNumber(
            decimal: (openTarget * Decimal(centsPerUnit)).rounded(0, .plain)
        ).intValue
        let currentSumDouble = NSDecimalNumber(decimal: currentSum).doubleValue

        let raw = openLines.map { line -> Double in
            let amount = NSDecimalNumber(decimal: line.amount).doubleValue
            return (amount / currentSumDouble) * Double(totalCents)
        }
        let floors = raw.map { Int($0.rounded(.down)) }
        var remainderCents = totalCents - floors.reduce(0, +)

        let order = raw.enumerated()
            .map { (index: $0.offset, frac: $0.element - $0.element.rounded(.down)) }
            .sorted { $0.frac > $1.frac }

        var cents = floors
        for entry in order {
            if remainderCents <= 0 { break }
            cents[entry.index] += 1
            remainderCents -= 1
        }

        return zip(openLines, cents).map { line, value in
            LineAllocation(budgetLineId: line.budgetLineId, amount: Decimal(value) / Decimal(centsPerUnit))
        }
    }

    // MARK: - Suggested monthly contribution (PUL-285 CA1/CA6)

    /// Mirror of shared `suggestedMonthlyContribution`: amount left to save ÷
    /// months remaining (payDay-aware, current AND deadline months inclusive —
    /// same base as formula 5 `required = max(0, target − confirmed) / months`,
    /// where confirmed at creation reduces to the initial amount), rounded UP
    /// to the cent so `suggestion × months ≥ remaining`. `nil` when the
    /// deadline is already past, the target is not positive, or the initial
    /// amount already covers the target (nothing left to decompose).
    static func suggestedMonthlyContribution(
        targetAmount: Decimal,
        targetDate: Date,
        payDayOfMonth: Int?,
        startDate: Date? = nil,
        initialAmount: Decimal = 0,
        now: Date = Date()
    ) -> Decimal? {
        let current = BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth)
        let start = startDate.map {
            BudgetPeriodCalculator.periodForDate($0, payDayOfMonth: payDayOfMonth)
        }
        let target = BudgetPeriodCalculator.periodForDate(targetDate, payDayOfMonth: payDayOfMonth)
        let currentIndex = periodKey(month: current.month, year: current.year)
        let startIndex = start.map { periodKey(month: $0.month, year: $0.year) } ?? currentIndex
        let effectiveStartIndex = max(currentIndex, startIndex)
        let monthsRemaining = periodKey(month: target.month, year: target.year)
            - effectiveStartIndex + 1
        guard monthsRemaining > 0, targetAmount > 0 else { return nil }
        let remaining = targetAmount.rounded(2) - initialAmount.rounded(2)
        guard remaining > 0 else { return nil }

        var rawCents = remaining / Decimal(monthsRemaining) * Decimal(centsPerUnit)
        var roundedCents = Decimal()
        NSDecimalRound(&roundedCents, &rawCents, 0, .up)
        return roundedCents / Decimal(centsPerUnit)
    }

    // MARK: - Helpers

    private static func periodKey(month: Int, year: Int) -> Int {
        year * 12 + month
    }
}

extension SavingsPlanCalculator {
    private struct ResolvedMonthMovement {
        let amount: Decimal
        let isAdjusted: Bool
        let isWithdrawal: Bool
        let replacesExistingPlanWithdrawal: Bool
    }

    private static func resolveMonthMovement(
        month: SavingsGoalPlanMonth,
        isContributive: Bool,
        adjustment: Adjustment?,
        globalMonthlyAmount: Decimal?
    ) -> ResolvedMonthMovement {
        if !month.isContributionEligible {
            return .init(amount: 0, isAdjusted: false, isWithdrawal: false,
                         replacesExistingPlanWithdrawal: false)
        }
        if !isContributive {
            // Same rule as `projectedCumulative`: a past cycle is worth only its
            // reality, while a month frozen later still owes the forecast it has
            // not pointed yet. Collapsing both onto `confirmedAmount` would erase
            // that contribution from the projection.
            let amount = month.isLocked
                ? month.confirmedAmount
                : max(month.plannedAmount, month.confirmedAmount)
            return .init(amount: amount, isAdjusted: false, isWithdrawal: false,
                         replacesExistingPlanWithdrawal: false)
        }
        if let adjustment {
            let isWithdrawal = adjustment.amount < 0
            return .init(
                amount: adjustment.amount,
                isAdjusted: adjustment.amount != currentPlanMovement(month),
                isWithdrawal: isWithdrawal,
                replacesExistingPlanWithdrawal: managedPlanWithdrawalAmount(month) > 0
            )
        }
        if let globalMonthlyAmount {
            return .init(
                amount: globalMonthlyAmount,
                isAdjusted: globalMonthlyAmount != currentPlanMovement(month),
                isWithdrawal: false,
                replacesExistingPlanWithdrawal: managedPlanWithdrawalAmount(month) > 0
            )
        }
        let managedWithdrawal = managedPlanWithdrawalAmount(month)
        if managedWithdrawal > 0 {
            return .init(amount: -managedWithdrawal, isAdjusted: false,
                         isWithdrawal: true, replacesExistingPlanWithdrawal: true)
        }
        return .init(amount: month.plannedAmount, isAdjusted: false, isWithdrawal: false,
                     replacesExistingPlanWithdrawal: false)
    }

    static func managedPlanWithdrawalAmount(_ month: SavingsGoalPlanMonth) -> Decimal {
        month.planOnlyWithdrawalAmount + month.planLinkedWithdrawalAmount
    }

    static func currentPlanMovement(_ month: SavingsGoalPlanMonth) -> Decimal {
        let withdrawal = managedPlanWithdrawalAmount(month)
        return withdrawal > 0 ? -withdrawal : month.plannedAmount
    }
}
